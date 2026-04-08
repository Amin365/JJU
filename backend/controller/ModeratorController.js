
import User from "../models/user.js";
import { Op } from 'sequelize';
import Member from "../models/Members.js";
import ModeratorMember from "../models/ModeratorMember.js";
import Role from "../models/Role.js";
import Issue from "../models/Issue.js";
import DailyReport from "../models/DailyReport.js";

// Get list of moderators (users with 'Moderator' role)
export const getModerators = async (req, res, next) => {
  try {
    // Find Role documents for 'Moderator' and 'Super Admin' (match name or plural, case-insensitive)
    const moderatorRole = await Role.findOne({
      [Op.or]: [
        { role: { [Op.like]: "^Moderator$", $options: "i" } },
        { plural: { [Op.like]: "^Moderators$", $options: "i" } },
      ],
    });

    const superAdminRole = await Role.findOne({
      [Op.or]: [
        { role: { [Op.like]: "^Super Admin$", $options: "i" } },
        { plural: { [Op.like]: "^Super Admins$", $options: "i" } },
      ],
    });

    // Collect role ids to include (Moderator + Super Admin when present)
    const roleIds = [];
    if (moderatorRole) roleIds.push(moderatorRole.id);
    if (superAdminRole) roleIds.push(superAdminRole.id);

    if (roleIds.length === 0) return res.status(200).json({ data: [] });

    const moderators = await User.find({ role: { [Op.in]: roleIds } })
      .select("_id username first_name last_name email role")
      .populate("role", "role plural")
      ;

    // Debug: show what Roles were found and how many users matched directly
    // console.debug("getModerators - roles:", { moderatorRole: moderatorRole?.role, superAdminRole: superAdminRole?.role });
    // console.debug("getModerators - direct moderators count:", Array.isArray(moderators) ? moderators.length : 0);

    let finalModerators = moderators;

    // Migrate legacy string roles (if any) to proper ObjectId references, per-role
    const migrationTasks = [];
    if (moderatorRole) {
      migrationTasks.push(
        User.collection.updateMany(
          { role: { [Op.like]: `^${moderatorRole.role}$`, $options: "i" } },
          { $set: { role: moderatorRole.id } }
        )
      );
    }
    if (superAdminRole) {
      migrationTasks.push(
        User.collection.updateMany(
          { role: { [Op.like]: `^${superAdminRole.role}$`, $options: "i" } },
          { $set: { role: superAdminRole.id } }
        )
      );
    }

    if (migrationTasks.length > 0) {
      const results = await Promise.all(migrationTasks);
      // If any migration updated documents, re-query
      const updated = results.some((r) => r && (r.matchedCount > 0 || r.modifiedCount > 0 || r.result?.nModified > 0));
        if (updated) {
        finalModerators = await User.find({ role: { [Op.in]: roleIds } })
          .select("_id username first_name last_name email role")
          .populate("role", "role plural")
          ;
      }
    }

    return res.status(200).json({ data: finalModerators || [] });
  } catch (err) {
    return next(err);
  }
};

// Get members assigned to a specific moderator
export const getAssignedMembers = async (req, res, next) => {
  try {
    const { moderatorId } = req.params;
    if (!Number.isInteger(Number(moderatorId))) {
      return res.status(400).json({ message: "Invalid moderator ID" });
    }

    // If the selected user is a Super Admin, return all members
    const user = await User.findByPk(moderatorId).select("role");
    if (!user) return res.status(404).json({ message: "Moderator not found" });

    const superAdminRole = await Role.findOne({
      [Op.or]: [
        { role: { [Op.like]: "^Super Admin$", $options: "i" } },
        { plural: { [Op.like]: "^Super Admins$", $options: "i" } },
      ],
    });

    // role may be an ObjectId or a legacy string
    const isSuperAdmin = superAdminRole && (
      (typeof user.role === "string" && user.role.toString().toLowerCase().includes("super")) ||
      (user.role && user.role.toString() === superAdminRole.id.toString())
    );

    if (isSuperAdmin) {
      const allMembers = await Member.find({}).select("_id first_name last_name email code full_name");
      return res.status(200).json({ data: allMembers });
    }

    const assignedMembers = await ModeratorMember.find({ moderator: moderatorId })
      .populate("member", "_id first_name last_name email code full_name")
      ;

    return res.status(200).json({ data: assignedMembers });
  } catch (err) {
    return next(err);
  }
};

// Get unassigned members for assignment
export const getMembersForAssignment = async (req, res, next) => {
  try {
    const unassignedMembers = await Member.find({
      _id: { $nin: await ModeratorMember.distinct("member") },
    }).select("_id first_name last_name email code full_name");

    return res.status(200).json({ data: unassignedMembers });
  } catch (err) {
    return next(err);
  }
};

// Assign a member to a moderator
export const assignMemberToModerator = async (req, res, next) => {
  try {
    const { moderatorId } = req.params;
    const { memberId } = req.body;

    if (!Number.isInteger(Number(moderatorId)) || !Number.isInteger(Number(memberId))) {
      return res.status(400).json({ message: "Invalid moderator or member ID" });
    }

    // Ensure member is not already assigned
    const existing = await ModeratorMember.findOne({ member: memberId });
    if (existing) {
      return res.status(409).json({ message: "Member is already assigned to a moderator" });
    }

    // Assign member to moderator
    const assignment = await ModeratorMember.create({ moderator: moderatorId, member: memberId });

    return res.status(201).json({ data: assignment });
  } catch (err) {
    return next(err);
  }
};

// Unassign a member from a moderator
export const unassignMemberFromModerator = async (req, res, next) => {
  try {
    const { moderatorId, memberId } = req.params;

    if (!Number.isInteger(Number(moderatorId)) || !Number.isInteger(Number(memberId))) {
      return res.status(400).json({ message: "Invalid moderator or member ID" });
    }

    const unassignment = await ModeratorMember.findOneAndDelete({
      moderator: moderatorId,
      member: memberId,
    });

    if (!unassignment) {
      return res.status(404).json({ message: "No assignment found for the specified moderator and member" });
    }

    return res.status(200).json({ message: "Member unassigned successfully" });
  } catch (err) {
    return next(err);
  }
};
/**
 * @desc Moderator workspace - summary counts + assigned members with indicators
 * @route GET /moderators/:moderatorId/workspace
 * @access Protected
 */
export const getModeratorWorkspace = async (req, res, next) => {
  try {
    const { moderatorId } = req.params;
    if (!Number.isInteger(Number(moderatorId))) {
      return res.status(400).json({ message: "Invalid moderator ID" });
    }

    const user = await User.findByPk(moderatorId).select("role first_name last_name username email");
    if (!user) return res.status(404).json({ message: "Moderator not found" });

    // Check if super admin => all members
    const superAdminRole = await Role.findOne({
      [Op.or]: [
        { role: { [Op.like]: "^Super Admin$", $options: "i" } },
        { plural: { [Op.like]: "^Super Admins$", $options: "i" } },
      ],
    });

    const isSuperAdmin = superAdminRole && user.role &&
      user.role.toString() === superAdminRole.id.toString();

    let memberIds;
    if (isSuperAdmin) {
      memberIds = await Member.distinct("_id");
    } else {
      memberIds = await ModeratorMember.find({ moderator: moderatorId }).distinct("member");
    }

    const members = await Member.find({ _id: { [Op.in]: memberIds } })
      .select("_id first_name last_name email code status department study_year")
      ;

    // Fetch overdue issues for assigned members
    const overdueIssues = await Issue.find({
      member: { [Op.in]: memberIds },
      status: "Overdue",
    }).select("member book issueDate returnDate");

    const overdueByMember = {};
    overdueIssues.forEach((i) => {
      const key = String(i.member);
      overdueByMember[key] = (overdueByMember[key] || 0) + 1;
    });

    // Find members missing daily reports in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get all users linked to these members
    const linkedUsers = await User.find({ member: { [Op.in]: memberIds } })
      .select("_id member")
      ;
    const memberToUser = {};
    linkedUsers.forEach((u) => { memberToUser[String(u.member)] = u.id; });

    const userIds = linkedUsers.map((u) => u.id);
    const recentReports = await DailyReport.find({
      createdBy: { [Op.in]: userIds },
      readingDate: { [Op.gte]: sevenDaysAgo },
    }).select("createdBy readingDate");

    const usersWithRecentReports = new Set(recentReports.map((r) => String(r.createdBy)));

    // Build enriched member list
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
      withOverdue: Object.keys(overdueByMember).length,
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
