import Notification from "../models/Notification.js";
import { Op } from 'sequelize';
import User from "../models/user.js";
import Role from "../models/Role.js";
import ModeratorMember from "../models/ModeratorMember.js";

// Helper to get user role info
async function getUserRoleInfo(userId) {
  const currentUser = await User.findByPk(userId)
    .populate("role", "role plural")
    
    ;

  const roleName = (currentUser?.role?.role || currentUser?.role?.plural || "").toLowerCase();
  const isSuperAdmin = /super\s*admin/i.test(roleName);
  const isModerator = /moderator/i.test(roleName);

  return { currentUser, roleName, isSuperAdmin, isModerator };
}

// Helper to build notification filter based on role
async function buildNotificationFilter(userId, roleInfo, extraFilters = {}) {
  const { isSuperAdmin, isModerator } = roleInfo;
  let notifFilter = { ...extraFilters };

  if (isSuperAdmin) {
    // Super admin: see all notifications except member missed-report reminders
    notifFilter = { ...notifFilter, "meta.kind": { [Op.ne]: "missed-daily-report" } };
  } else if (isModerator) {
    // Moderator: notifications targeted at them OR about assigned members
    const assignedMemberIds = await ModeratorMember.find({ moderator: userId }).distinct("member");
    if (assignedMemberIds && assignedMemberIds.length > 0) {
      notifFilter = {
        ...notifFilter,
        [Op.or]: [
          { user: userId },
          { "meta.member": { [Op.in]: assignedMemberIds.map((m) => m) } },
        ],
      };
    } else {
      notifFilter = { ...notifFilter, user: userId };
    }
  } else {
    // Regular user: only notifications for themselves
    notifFilter = { ...notifFilter, user: userId };
  }

  return notifFilter;
}

// List notifications for the logged in user with proper scoping
export const listNotifications = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { page = 1, limit = 10, type, category, read } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.max(1, Math.min(50, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * perPage;

    // Determine role of current user to scope notifications
    const roleInfo = await getUserRoleInfo(userId);

    // Build extra filters from query params
    const extraFilters = {};
    if (type) extraFilters.type = type;
    if (category) extraFilters.category = category;
    if (read !== undefined) extraFilters.read = read === "true";

    const notifFilter = await buildNotificationFilter(userId, roleInfo, extraFilters);

    const [items, total] = await Promise.all([
      Notification.find(notifFilter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(perPage)
        
        ,
      Notification.countDocuments(notifFilter),
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

    const roleInfo = await getUserRoleInfo(userId);
    const updateFilter = await buildNotificationFilter(userId, roleInfo, { read: false });

    await Notification.updateMany(updateFilter, { $set: { read: true } });
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
    const notif = await Notification.findByPk(id);
    if (!notif) return res.status(404).json({ message: "Notification not found" });

    // Determine role
    const roleInfo = await getUserRoleInfo(userId);
    const { isSuperAdmin, isModerator } = roleInfo;

    let allowed = false;
    if (isSuperAdmin) allowed = true;
    else if (String(notif.user) === String(userId)) allowed = true;
    else if (isModerator) {
      // allow if notification relates to a member assigned to this moderator
      const assignedMemberIds = await ModeratorMember.find({ moderator: userId }).distinct("member");
      if (assignedMemberIds && assignedMemberIds.length > 0 && notif.meta && notif.meta.member) {
        allowed = assignedMemberIds.some((m) => String(m) === String(notif.meta.member));
      }
    }

    if (!allowed) return res.status(403).json({ message: "Forbidden" });

    const updated = await Notification.findByIdAndUpdate(
      id,
      { $set: { read: true } },
      { new: true }
    );
    return res.json({ data: updated });
  } catch (err) {
    return next(err);
  }
};

// Get notification statistics for the current user
export const getNotificationStats = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const roleInfo = await getUserRoleInfo(userId);
    const baseFilter = await buildNotificationFilter(userId, roleInfo, {});

    const [total, unread, byType, byCategory] = await Promise.all([
      Notification.countDocuments(baseFilter),
      Notification.count({ where: { ...baseFilter, read: false } }),
      Notification.aggregate([
        { $match: baseFilter },
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]),
      Notification.aggregate([
        { $match: baseFilter },
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]),
    ]);

    return res.json({
      data: {
        total,
        unread,
        read: total - unread,
        byType: byType.reduce((acc, item) => {
          acc[item.id || "unknown"] = item.count;
          return acc;
        }, {}),
        byCategory: byCategory.reduce((acc, item) => {
          acc[item.id || "unknown"] = item.count;
          return acc;
        }, {}),
      },
    });
  } catch (err) {
    return next(err);
  }
};

// Delete a single notification
export const deleteNotification = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const notif = await Notification.findByPk(id);
    if (!notif) return res.status(404).json({ message: "Notification not found" });

    const roleInfo = await getUserRoleInfo(userId);
    const { isSuperAdmin } = roleInfo;

    // Only owner or super admin can delete
    if (!isSuperAdmin && String(notif.user) !== String(userId)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await (Notification.destroy({ where: { id: id } }).then(() => Notification.findByPk(id_deleted)));
    return res.json({ success: true, message: "Notification deleted" });
  } catch (err) {
    return next(err);
  }
};

// Delete all read notifications for user
export const deleteAllRead = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const roleInfo = await getUserRoleInfo(userId);
    const { isSuperAdmin } = roleInfo;

    let deleteFilter = { read: true };
    if (!isSuperAdmin) {
      deleteFilter.user = userId;
    }

    const result = await Notification.deleteMany(deleteFilter);
    return res.json({ 
      success: true, 
      message: `Deleted ${result.deletedCount} notifications` 
    });
  } catch (err) {
    return next(err);
  }
};