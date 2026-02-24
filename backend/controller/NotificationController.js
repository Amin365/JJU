import Notification from "../models/Notification.js";
import User from "../models/user.js";
import Role from "../models/Role.js";
import ModeratorMember from "../models/ModeratorMember.js";
import mongoose from "mongoose";

// List notifications for the logged in user with proper scoping
export const listNotifications = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.max(1, Math.min(50, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * perPage;

    // Determine role of current user to scope notifications
    const currentUser = await User.findById(userId)
      .populate("role", "role plural")
      .lean()
      .exec();

    const roleName = (currentUser?.role?.role || currentUser?.role?.plural || "").toLowerCase();
    const isSuperAdmin = /super\s*admin/i.test(roleName);
    const isModerator = /moderator/i.test(roleName);

    let notifFilter = {};

    if (isSuperAdmin) {
      // Super admin: see all notifications except member missed-report reminders
      notifFilter = { "meta.kind": { $ne: "missed-daily-report" } };
    } else if (isModerator) {
      // Moderator: notifications targeted at them OR about assigned members
      const assignedMemberIds = await ModeratorMember.find({ moderator: userId }).distinct("member").exec();
      if (assignedMemberIds && assignedMemberIds.length > 0) {
        notifFilter = {
          $or: [
            { user: new mongoose.Types.ObjectId(userId) },
            { "meta.member": { $in: assignedMemberIds.map((m) => new mongoose.Types.ObjectId(m)) } },
          ],
        };
      } else {
        notifFilter = { user: new mongoose.Types.ObjectId(userId) };
      }
    } else {
      // Regular user: only notifications for themselves
      notifFilter = { user: new mongoose.Types.ObjectId(userId) };
    }

    const [items, total] = await Promise.all([
      Notification.find(notifFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(perPage)
        .lean()
        .exec(),
      Notification.countDocuments(notifFilter).exec(),
    ]);

    return res.json({
      data: items,
      total,
      page: pageNum,
      limit: perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (err) {
    return next(err);
  }
};

// Mark ALL notifications for user (or scope) as read
export const markAllRead = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // Determine role to scope which notifications can be marked
    const currentUser = await User.findById(userId)
      .populate("role", "role plural")
      .lean()
      .exec();
    const roleName = (currentUser?.role?.role || currentUser?.role?.plural || "").toLowerCase();
    const isSuperAdmin = /super\s*admin/i.test(roleName);
    const isModerator = /moderator/i.test(roleName);

    let updateFilter = {};
    if (isSuperAdmin) {
      updateFilter = { read: false };
    } else if (isModerator) {
      const assignedMemberIds = await ModeratorMember.find({ moderator: userId }).distinct("member").exec();
      if (assignedMemberIds && assignedMemberIds.length > 0) {
        updateFilter = {
          read: false,
          $or: [
            { user: new mongoose.Types.ObjectId(userId) },
            { "meta.member": { $in: assignedMemberIds.map((m) => new mongoose.Types.ObjectId(m)) } },
          ],
        };
      } else {
        updateFilter = { user: new mongoose.Types.ObjectId(userId), read: false };
      }
    } else {
      updateFilter = { user: new mongoose.Types.ObjectId(userId), read: false };
    }

    await Notification.updateMany(updateFilter, { $set: { read: true } }).exec();
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
};

// Mark ONE notification as read
export const markOneRead = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    // fetch notification and enforce scoping rules
    const notif = await Notification.findById(id).lean().exec();
    if (!notif) return res.status(404).json({ message: "Notification not found" });

    // Determine role
    const currentUser = await User.findById(userId).populate("role", "role plural").lean().exec();
    const roleName = (currentUser?.role?.role || currentUser?.role?.plural || "").toLowerCase();
    const isSuperAdmin = /super\s*admin/i.test(roleName);
    const isModerator = /moderator/i.test(roleName);

    let allowed = false;
    if (isSuperAdmin) allowed = true;
    else if (String(notif.user) === String(userId)) allowed = true;
    else if (isModerator) {
      // allow if notification relates to a member assigned to this moderator
      const assignedMemberIds = await ModeratorMember.find({ moderator: userId }).distinct("member").exec();
      if (assignedMemberIds && assignedMemberIds.length > 0 && notif.meta && notif.meta.member) {
        allowed = assignedMemberIds.some((m) => String(m) === String(notif.meta.member));
      }
    }

    if (!allowed) return res.status(403).json({ message: "Forbidden" });

    const updated = await Notification.findByIdAndUpdate(
      id,
      { $set: { read: true } },
      { new: true }
    ).lean().exec();
    return res.json({ data: updated });
  } catch (err) {
    return next(err);
  }
};