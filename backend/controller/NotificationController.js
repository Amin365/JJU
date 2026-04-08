import Notification from "../models/Notification.js";
import { Op, col, fn, where as sqlWhere } from "sequelize";
import User from "../models/user.js";
import Role from "../models/Role.js";
import ModeratorMember from "../models/ModeratorMember.js";

function extractMetaMember(meta) {
  if (!meta || typeof meta !== "object") return null;
  return meta.member ?? null;
}

// Helper to get user role info
async function getUserRoleInfo(userId) {
  const currentUser = await User.findByPk(userId, {
    include: [{ model: Role, as: "roleInfo", attributes: ["role", "plural"] }],
  });

  const roleName = (
    currentUser?.roleInfo?.role ||
    currentUser?.roleInfo?.plural ||
    ""
  ).toLowerCase();
  const isSuperAdmin = /super\s*admin/i.test(roleName);
  const isModerator = /moderator/i.test(roleName);

  return { currentUser, roleName, isSuperAdmin, isModerator };
}

function buildBaseFilter(roleInfo, extraFilters = {}) {
  const { isSuperAdmin } = roleInfo;
  let notifFilter = { ...extraFilters };

  if (isSuperAdmin) {
    notifFilter[Op.and] = [
      ...(notifFilter[Op.and] || []),
      sqlWhere(fn("JSON_UNQUOTE", fn("JSON_EXTRACT", col("meta"), "$.kind")), {
        [Op.ne]: "missed-daily-report",
      }),
    ];
  }

  return notifFilter;
}

// List notifications for the logged in user with proper scoping
export const listNotifications = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { page = 1, limit = 10, type, category, read } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.max(1, Math.min(50, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * perPage;

    const roleInfo = await getUserRoleInfo(userId);
    const { isSuperAdmin, isModerator } = roleInfo;

    const extraFilters = {};
    if (type) extraFilters.type = type;
    if (category) extraFilters.category = category;
    if (read !== undefined) extraFilters.read = read === "true";

    let where = buildBaseFilter(roleInfo, extraFilters);
    if (!isSuperAdmin && !isModerator) {
      where.user_id = userId;
    } else if (isModerator) {
      where.user_id = userId;
    }

    const { rows, count } = await Notification.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      offset,
      limit: perPage,
    });

    let items = rows;
    if (isModerator && !isSuperAdmin) {
      const assignedMemberIds = await ModeratorMember.findAll({
        where: { moderator_id: userId },
        attributes: ["member_id"],
        raw: true,
      });
      const assignedSet = new Set(assignedMemberIds.map((m) => String(m.member_id)));
      items = rows.filter((notif) => {
        if (notif.user_id === userId) return true;
        const metaMember = extractMetaMember(notif.meta);
        return metaMember !== null && assignedSet.has(String(metaMember));
      });
    }

    return res.json({
      data: items,
      total: isModerator && !isSuperAdmin ? items.length : count,
      page: pageNum,
      limit: perPage,
      totalPages: Math.ceil((isModerator && !isSuperAdmin ? items.length : count) / perPage),
    });
  } catch (err) {
    return next(err);
  }
};

// Mark ALL notifications for user (or scope) as read
export const markAllRead = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const roleInfo = await getUserRoleInfo(userId);
    const { isSuperAdmin, isModerator } = roleInfo;

    if (isSuperAdmin) {
      const where = buildBaseFilter(roleInfo, { read: false });
      await Notification.update({ read: true }, { where });
      return res.json({ success: true });
    }

    if (isModerator) {
      const assignedMemberIds = await ModeratorMember.findAll({
        where: { moderator_id: userId },
        attributes: ["member_id"],
        raw: true,
      });
      const assignedSet = new Set(assignedMemberIds.map((m) => String(m.member_id)));
      const candidateRows = await Notification.findAll({
        where: { read: false },
        attributes: ["id", "user_id", "meta"],
      });
      const idsToUpdate = candidateRows
        .filter((row) => {
          if (row.user_id === userId) return true;
          const member = extractMetaMember(row.meta);
          return member !== null && assignedSet.has(String(member));
        })
        .map((row) => row.id);
      if (idsToUpdate.length > 0) {
        await Notification.update({ read: true }, { where: { id: { [Op.in]: idsToUpdate } } });
      }
      return res.json({ success: true });
    }

    await Notification.update(
      { read: true },
      { where: { user_id: userId, read: false } }
    );
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
};

// Mark ONE notification as read
export const markOneRead = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const notif = await Notification.findByPk(id);
    if (!notif) return res.status(404).json({ message: "Notification not found" });

    const roleInfo = await getUserRoleInfo(userId);
    const { isSuperAdmin, isModerator } = roleInfo;

    let allowed = false;
    if (isSuperAdmin) allowed = true;
    else if (notif.user_id === userId) allowed = true;
    else if (isModerator) {
      const assignedMemberIds = await ModeratorMember.findAll({
        where: { moderator_id: userId },
        attributes: ["member_id"],
        raw: true,
      });
      const assignedSet = new Set(assignedMemberIds.map((m) => String(m.member_id)));
      const member = extractMetaMember(notif.meta);
      allowed = member !== null && assignedSet.has(String(member));
    }

    if (!allowed) return res.status(403).json({ message: "Forbidden" });

    await notif.update({ read: true });
    return res.json({ data: notif });
  } catch (err) {
    return next(err);
  }
};

// Get notification statistics for the current user
export const getNotificationStats = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const roleInfo = await getUserRoleInfo(userId);
    const { isSuperAdmin, isModerator } = roleInfo;

    let where = buildBaseFilter(roleInfo, {});
    if (!isSuperAdmin && !isModerator) {
      where.user_id = userId;
    } else if (isModerator) {
      where.user_id = userId;
    }

    const [total, unread, byTypeRows, byCategoryRows] = await Promise.all([
      Notification.count({ where }),
      Notification.count({ where: { ...where, read: false } }),
      Notification.findAll({
        where,
        attributes: ["type", [fn("COUNT", col("id")), "count"]],
        group: ["type"],
        raw: true,
      }),
      Notification.findAll({
        where,
        attributes: ["category", [fn("COUNT", col("id")), "count"]],
        group: ["category"],
        raw: true,
      }),
    ]);

    const byType = byTypeRows.reduce((acc, item) => {
      acc[item.type || "unknown"] = Number(item.count || 0);
      return acc;
    }, {});

    const byCategory = byCategoryRows.reduce((acc, item) => {
      acc[item.category || "unknown"] = Number(item.count || 0);
      return acc;
    }, {});

    return res.json({
      data: {
        total,
        unread,
        read: total - unread,
        byType,
        byCategory,
      },
    });
  } catch (err) {
    return next(err);
  }
};

// Delete a single notification
export const deleteNotification = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const notif = await Notification.findByPk(id);
    if (!notif) return res.status(404).json({ message: "Notification not found" });

    const roleInfo = await getUserRoleInfo(userId);
    const { isSuperAdmin } = roleInfo;

    if (!isSuperAdmin && notif.user_id !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await notif.destroy();
    return res.json({ success: true, message: "Notification deleted" });
  } catch (err) {
    return next(err);
  }
};

// Delete all read notifications for user
export const deleteAllRead = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const roleInfo = await getUserRoleInfo(userId);
    const { isSuperAdmin } = roleInfo;

    const where = { read: true };
    if (!isSuperAdmin) where.user_id = userId;

    const deletedCount = await Notification.destroy({ where });
    return res.json({
      success: true,
      message: `Deleted ${deletedCount} notifications`,
    });
  } catch (err) {
    return next(err);
  }
};
