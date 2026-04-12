import User from "../models/user.js";
import { Op } from "sequelize";
import Member from "../models/Members.js";
import ModeratorMember from "../models/ModeratorMember.js";
import Role from "../models/Role.js";
import Issue from "../models/Issue.js";
import DailyReport from "../models/DailyReport.js";

const isValidId = (id) => Number.isInteger(Number(id)) && Number(id) > 0;

const roleNameFrom = (role) =>
  String(role?.role || role?.plural || "").toLowerCase();

const isSuperAdminRole = (role) => /super\s*admin/i.test(roleNameFrom(role));
const isModeratorRole = (role) => /moderator/i.test(roleNameFrom(role));

const hasAnyPermission = (req, perms = []) => {
  const userPerms = new Set((req.user?.permissions || []).map((p) => String(p).toLowerCase()));
  return perms.some((p) => userPerms.has(String(p).toLowerCase()));
};

const getActor = async (req) => {
  if (!req.user?.id) return null;
  return User.findByPk(Number(req.user.id), {
    attributes: ["id", "role_id", "member_id_fk"],
    include: [{ model: Role, as: "role", attributes: ["id", "role", "plural"], required: false }],
  });
};

const canAdminModeratorAssignments = (req, actor) =>
  isSuperAdminRole(actor?.role) || hasAnyPermission(req, ["Manage Members"]);

const canViewModeratorScope = (req, actor, moderatorId) => {
  if (canAdminModeratorAssignments(req, actor)) return true;
  if (isModeratorRole(actor?.role) && Number(actor?.id) === Number(moderatorId)) return true;
  return false;
};

// Get list of moderators (users with Moderator or Super Admin role)
export const getModerators = async (req, res, next) => {
  try {
    const actor = await getActor(req);
    if (!actor) return res.status(401).json({ message: "Unauthorized" });
    if (!canAdminModeratorAssignments(req, actor) && !isModeratorRole(actor.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const roles = await Role.findAll({
      where: {
        [Op.or]: [
          { role: { [Op.like]: "%Moderator%" } },
          { plural: { [Op.like]: "%Moderator%" } },
          { role: { [Op.like]: "%Super Admin%" } },
          { plural: { [Op.like]: "%Super Admin%" } },
        ],
      },
      attributes: ["id", "role", "plural"],
      raw: true,
    });

    const roleIds = roles.map((r) => r.id);
    if (!roleIds.length) return res.status(200).json({ data: [] });

    const moderators = await User.findAll({
      where: { role_id: { [Op.in]: roleIds } },
      attributes: ["id", "username", "first_name", "last_name", "email", "role_id"],
      include: [{ model: Role, as: "role", attributes: ["id", "role", "plural"], required: false }],
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({ data: moderators || [] });
  } catch (err) {
    return next(err);
  }
};

// Get members assigned to a specific moderator
export const getAssignedMembers = async (req, res, next) => {
  try {
    const { moderatorId } = req.params;
    const actor = await getActor(req);
    if (!actor) return res.status(401).json({ message: "Unauthorized" });
    if (!canViewModeratorScope(req, actor, moderatorId)) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (!isValidId(moderatorId)) {
      return res.status(400).json({ message: "Invalid moderator ID" });
    }

    const user = await User.findByPk(Number(moderatorId), {
      attributes: ["id", "role_id"],
      include: [{ model: Role, as: "role", attributes: ["id", "role", "plural"], required: false }],
    });
    if (!user) return res.status(404).json({ message: "Moderator not found" });

    if (isSuperAdminRole(user.role)) {
      const allMembers = await Member.findAll({
        attributes: ["id", "first_name", "last_name", "email", "code", ],
        order: [["createdAt", "DESC"]],
      });
      return res.status(200).json({ data: allMembers });
    }

    const assignedMembers = await ModeratorMember.findAll({
      where: { moderator_id: Number(moderatorId) },
      include: [
        {
          model: Member,
          as: "member",
          attributes: ["id", "first_name", "last_name", "email", "code"],
          required: true,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({ data: assignedMembers });
  } catch (err) {
    return next(err);
  }
};

// Get unassigned members for assignment
export const getMembersForAssignment = async (req, res, next) => {
  try {
    const actor = await getActor(req);
    if (!actor) return res.status(401).json({ message: "Unauthorized" });
    if (!canAdminModeratorAssignments(req, actor)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const assignedRows = await ModeratorMember.findAll({
      attributes: ["member_id"],
      raw: true,
    });
    const assignedMemberIds = assignedRows.map((r) => r.member_id).filter(Boolean);

    const where = assignedMemberIds.length
      ? { id: { [Op.notIn]: assignedMemberIds } }
      : {};

    const unassignedMembers = await Member.findAll({
      where,
      attributes: ["id", "first_name", "last_name", "email", "code"],
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({ data: unassignedMembers });
  } catch (err) {
    return next(err);
  }
};

// Assign a member to a moderator
export const assignMemberToModerator = async (req, res, next) => {
  try {
    const actor = await getActor(req);
    if (!actor) return res.status(401).json({ message: "Unauthorized" });
    if (!canAdminModeratorAssignments(req, actor)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { moderatorId } = req.params;
    const { memberId } = req.body;

    if (!isValidId(moderatorId) || !isValidId(memberId)) {
      return res.status(400).json({ message: "Invalid moderator or member ID" });
    }

    const [moderator, member] = await Promise.all([
      User.findByPk(Number(moderatorId), {
        include: [{ model: Role, as: "role", attributes: ["role", "plural"], required: false }],
      }),
      Member.findByPk(Number(memberId)),
    ]);

    if (!moderator) return res.status(404).json({ message: "Moderator not found" });
    if (!member) return res.status(404).json({ message: "Member not found" });

    if (!isModeratorRole(moderator.role) && !isSuperAdminRole(moderator.role)) {
      return res.status(400).json({ message: "Selected user is not a moderator/super admin" });
    }

    const existing = await ModeratorMember.findOne({
      where: { member_id: Number(memberId) },
    });

    if (existing) {
      return res.status(409).json({ message: "Member is already assigned to a moderator" });
    }

    const assignment = await ModeratorMember.create({
      moderator_id: Number(moderatorId),
      member_id: Number(memberId),
    });

    return res.status(201).json({ data: assignment });
  } catch (err) {
    return next(err);
  }
};

// Unassign a member from a moderator
export const unassignMemberFromModerator = async (req, res, next) => {
  try {
    const actor = await getActor(req);
    if (!actor) return res.status(401).json({ message: "Unauthorized" });
    if (!canAdminModeratorAssignments(req, actor)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { moderatorId, memberId } = req.params;

    if (!isValidId(moderatorId) || !isValidId(memberId)) {
      return res.status(400).json({ message: "Invalid moderator or member ID" });
    }

    const assignment = await ModeratorMember.findOne({
      where: {
        moderator_id: Number(moderatorId),
        member_id: Number(memberId),
      },
    });

    if (!assignment) {
      return res.status(404).json({
        message: "No assignment found for the specified moderator and member",
      });
    }

    await assignment.destroy();

    return res.status(200).json({ message: "Member unassigned successfully" });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /moderators/:moderatorId/workspace
 */
export const getModeratorWorkspace = async (req, res, next) => {
  try {
    const { moderatorId } = req.params;
    const actor = await getActor(req);
    if (!actor) return res.status(401).json({ message: "Unauthorized" });
    if (!canViewModeratorScope(req, actor, moderatorId)) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (!isValidId(moderatorId)) {
      return res.status(400).json({ message: "Invalid moderator ID" });
    }

    const user = await User.findByPk(Number(moderatorId), {
      attributes: ["id", "role_id", "first_name", "last_name", "username", "email"],
      include: [{ model: Role, as: "role", attributes: ["id", "role", "plural"], required: false }],
    });

    if (!user) return res.status(404).json({ message: "Moderator not found" });

    let memberIds = [];

    if (isSuperAdminRole(user.role)) {
      const allMembers = await Member.findAll({ attributes: ["id"], raw: true });
      memberIds = allMembers.map((m) => m.id);
    } else {
      const assignments = await ModeratorMember.findAll({
        where: { moderator_id: Number(moderatorId) },
        attributes: ["member_id"],
        raw: true,
      });
      memberIds = assignments.map((a) => a.member_id).filter(Boolean);
    }

    if (!memberIds.length) {
      return res.status(200).json({
        data: {
          moderator: user,
          summary: {
            totalAssigned: 0,
            withOverdue: 0,
            missingReports: 0,
            lowActivity: 0,
          },
          members: [],
        },
      });
    }

    const members = await Member.findAll({
      where: { id: { [Op.in]: memberIds } },
      attributes: ["id", "first_name", "last_name", "email", "code", "status", "department", "study_year"],
      raw: true,
    });

    const overdueIssues = await Issue.findAll({
      where: {
        member_id: { [Op.in]: memberIds },
        status: "Overdue",
      },
      attributes: ["member_id"],
      raw: true,
    });

    const overdueByMember = overdueIssues.reduce((acc, i) => {
      const key = String(i.member_id);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const linkedUsers = await User.findAll({
      where: { member_id_fk: { [Op.in]: memberIds } },
      attributes: ["id", "member_id_fk"],
      raw: true,
    });

    const memberToUser = {};
    linkedUsers.forEach((u) => {
      memberToUser[String(u.member_id_fk)] = u.id;
    });

    const userIds = linkedUsers.map((u) => u.id);

    const recentReports = userIds.length
      ? await DailyReport.findAll({
          where: {
            created_by: { [Op.in]: userIds },
            readingDate: { [Op.gte]: sevenDaysAgo },
          },
          attributes: ["created_by"],
          raw: true,
        })
      : [];

    const usersWithRecentReports = new Set(recentReports.map((r) => String(r.created_by)));

    const enrichedMembers = members.map((m) => {
      const userId = memberToUser[String(m.id)];
      const hasRecentReport = userId ? usersWithRecentReports.has(String(userId)) : false;
      const overdueCount = overdueByMember[String(m.id)] || 0;

      return {
        ...m,
        overdueCount,
        missingRecentReport: !hasRecentReport,
        lowActivity: !hasRecentReport && overdueCount === 0,
      };
    });

    const summary = {
      totalAssigned: members.length,
      withOverdue: enrichedMembers.filter((m) => m.overdueCount > 0).length,
      missingReports: enrichedMembers.filter((m) => m.missingRecentReport).length,
      lowActivity: enrichedMembers.filter((m) => m.lowActivity).length,
    };

    return res.status(200).json({
      data: {
        moderator: user,
        summary,
        members: enrichedMembers,
      },
    });
  } catch (err) {
    return next(err);
  }
};

export default {
  getModerators,
  getAssignedMembers,
  getMembersForAssignment,
  assignMemberToModerator,
  unassignMemberFromModerator,
  getModeratorWorkspace,
};