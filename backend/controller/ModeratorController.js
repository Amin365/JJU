
import User from "../models/user.js";
import Member from "../models/Members.js";
import ModeratorMember from "../models/ModeratorMember.js";
import Role from "../models/Role.js";
import mongoose from "mongoose";

// Get list of moderators (users with 'Moderator' role)
export const getModerators = async (req, res, next) => {
  try {
    // Find Role documents for 'Moderator' and 'Super Admin' (match name or plural, case-insensitive)
    const moderatorRole = await Role.findOne({
      $or: [
        { role: { $regex: "^Moderator$", $options: "i" } },
        { plural: { $regex: "^Moderators$", $options: "i" } },
      ],
    });

    const superAdminRole = await Role.findOne({
      $or: [
        { role: { $regex: "^Super Admin$", $options: "i" } },
        { plural: { $regex: "^Super Admins$", $options: "i" } },
      ],
    });

    // Collect role ids to include (Moderator + Super Admin when present)
    const roleIds = [];
    if (moderatorRole) roleIds.push(moderatorRole._id);
    if (superAdminRole) roleIds.push(superAdminRole._id);

    if (roleIds.length === 0) return res.status(200).json({ data: [] });

    const moderators = await User.find({ role: { $in: roleIds } })
      .select("_id username first_name last_name email role")
      .populate("role", "role plural")
      .lean();

    // Debug: show what Roles were found and how many users matched directly
    // console.debug("getModerators - roles:", { moderatorRole: moderatorRole?.role, superAdminRole: superAdminRole?.role });
    // console.debug("getModerators - direct moderators count:", Array.isArray(moderators) ? moderators.length : 0);

    let finalModerators = moderators;

    // Migrate legacy string roles (if any) to proper ObjectId references, per-role
    const migrationTasks = [];
    if (moderatorRole) {
      migrationTasks.push(
        User.collection.updateMany(
          { role: { $regex: `^${moderatorRole.role}$`, $options: "i" } },
          { $set: { role: moderatorRole._id } }
        )
      );
    }
    if (superAdminRole) {
      migrationTasks.push(
        User.collection.updateMany(
          { role: { $regex: `^${superAdminRole.role}$`, $options: "i" } },
          { $set: { role: superAdminRole._id } }
        )
      );
    }

    if (migrationTasks.length > 0) {
      const results = await Promise.all(migrationTasks);
      // If any migration updated documents, re-query
      const updated = results.some((r) => r && (r.matchedCount > 0 || r.modifiedCount > 0 || r.result?.nModified > 0));
        if (updated) {
        finalModerators = await User.find({ role: { $in: roleIds } })
          .select("_id username first_name last_name email role")
          .populate("role", "role plural")
          .lean();
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
    if (!mongoose.Types.ObjectId.isValid(moderatorId)) {
      return res.status(400).json({ message: "Invalid moderator ID" });
    }

    // If the selected user is a Super Admin, return all members
    const user = await User.findById(moderatorId).select("role").lean();
    if (!user) return res.status(404).json({ message: "Moderator not found" });

    const superAdminRole = await Role.findOne({
      $or: [
        { role: { $regex: "^Super Admin$", $options: "i" } },
        { plural: { $regex: "^Super Admins$", $options: "i" } },
      ],
    });

    // role may be an ObjectId or a legacy string
    const isSuperAdmin = superAdminRole && (
      (typeof user.role === "string" && user.role.toString().toLowerCase().includes("super")) ||
      (user.role && user.role.toString() === superAdminRole._id.toString())
    );

    if (isSuperAdmin) {
      const allMembers = await Member.find({}).select("_id first_name last_name email code full_name");
      return res.status(200).json({ data: allMembers });
    }

    const assignedMembers = await ModeratorMember.find({ moderator: moderatorId })
      .populate("member", "_id first_name last_name email code full_name")
      .lean();

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

    if (!mongoose.Types.ObjectId.isValid(moderatorId) || !mongoose.Types.ObjectId.isValid(memberId)) {
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

    if (!mongoose.Types.ObjectId.isValid(moderatorId) || !mongoose.Types.ObjectId.isValid(memberId)) {
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