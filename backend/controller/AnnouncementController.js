import { Op, fn, col, literal } from "sequelize";
import Notification from "../models/Notification.js";
import User from "../models/user.js";
import Member from "../models/Members.js";
import Issue from "../models/Issue.js";
import DailyReport from "../models/DailyReport.js";
import Role from "../models/Role.js";
import { sendMail, buildEmailHtml } from "./EmailController.js";
import { sendPushToUser } from "../utility/push.js";
import {
  checkUserPreference,
  isInQuietHours,
} from "./NotificationPreferencesController.js";

const APP_NAME = process.env.APP_NAME || "JJU Reading Club";
const VALID_AUDIENCES = ["all", "members", "moderators", "inactive", "overdue"];

const hasAnyPermission = (req, perms = []) => {
  const userPerms = new Set((req.user?.permissions || []).map((p) => String(p).toLowerCase()));
  return perms.some((p) => userPerms.has(String(p).toLowerCase()));
};

const hasAnnouncementAccess = (req) => {
  const roleName = String(req.user?.role?.role || req.user?.role?.plural || req.user?.role || "").toLowerCase();
  if (/super\s*admin/i.test(roleName) || /admin/i.test(roleName) || /moderator/i.test(roleName)) {
    return true;
  }
  return hasAnyPermission(req, ["Manage Members", "Manage Issues", "Edit Role"]);
};

// Helper to determine if user is admin/superadmin
async function isAdmin(userId) {
  const user = await User.findByPk(userId, {
    include: [{ model: Role, as: "role", attributes: ["id", "role", "plural"] }],
  });

  const roleName = (user?.role?.role || user?.role?.plural || "").toLowerCase();
  return /super\s*admin/i.test(roleName) || /admin/i.test(roleName);
}

// Get all users for a target audience (Sequelize/MySQL)
async function getTargetAudience(targetAudience) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const baseUserQuery = {
    where: { status: "Active" },
    attributes: ["id", "email", "member_id", "role_id"],
    include: [
      {
        model: Member,
        as: "member",
        attributes: ["id", "first_name", "last_name", "email", "status"],
        required: false,
      },
    ],
  };

  switch (targetAudience) {
    case "all":
      return User.findAll(baseUserQuery);

    case "members": {
      const memberRole = await Role.findOne({
        where: { role: { [Op.regexp]: "^members?$" } },
        attributes: ["id"],
      });
      if (!memberRole) return [];

      return User.findAll({
        ...baseUserQuery,
        where: { ...baseUserQuery.where, role_id: memberRole.id },
      });
    }

    case "moderators": {
      const modRole = await Role.findOne({
        where: { role: { [Op.regexp]: "^moderator$" } },
        attributes: ["id"],
      });
      if (!modRole) return [];

      return User.findAll({
        ...baseUserQuery,
        where: { ...baseUserQuery.where, role_id: modRole.id },
      });
    }

    case "inactive": {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentReports = await DailyReport.findAll({
        where: { date: { [Op.gte]: sevenDaysAgo } },
        attributes: [[fn("DISTINCT", col("member_id")), "member_id"]],
        raw: true,
      });

      const activeMemberIds = recentReports.map((r) => r.member_id).filter(Boolean);

      const inactiveMembers = await Member.findAll({
        where: {
          status: { [Op.ne]: "archived" },
          ...(activeMemberIds.length ? { id: { [Op.notIn]: activeMemberIds } } : {}),
        },
        attributes: ["id"],
        raw: true,
      });

      const inactiveMemberIds = inactiveMembers.map((m) => m.id);
      if (!inactiveMemberIds.length) return [];

      return User.findAll({
        ...baseUserQuery,
        where: {
          ...baseUserQuery.where,
          member_id: { [Op.in]: inactiveMemberIds },
        },
      });
    }

    case "overdue": {
      const overdueRows = await Issue.findAll({
        where: {
          returnDate: { [Op.lt]: today },
          returnedAt: null,
        },
        attributes: [[fn("DISTINCT", col("member_id")), "member_id"]],
        raw: true,
      });

      const overdueMemberIds = overdueRows.map((r) => r.member_id).filter(Boolean);
      if (!overdueMemberIds.length) return [];

      return User.findAll({
        ...baseUserQuery,
        where: {
          ...baseUserQuery.where,
          member_id: { [Op.in]: overdueMemberIds },
        },
      });
    }

    default:
      return [];
  }
}

// Create a bulk announcement
export const createAnnouncement = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    if (!hasAnnouncementAccess(req) && !(await isAdmin(userId))) {
      return res.status(403).json({ message: "Only admins can create announcements" });
    }

    const {
      title,
      message,
      targetAudience = "all",
      sendEmail = false,
      sendPush = true,
      ctaLabel,
      ctaUrl,
      expiresAt,
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({ message: "Title and message are required" });
    }

    if (!VALID_AUDIENCES.includes(targetAudience)) {
      return res.status(400).json({
        message: `Invalid target audience. Must be one of: ${VALID_AUDIENCES.join(", ")}`,
      });
    }

    const targetUsers = await getTargetAudience(targetAudience);
    if (!targetUsers.length) {
      return res.status(400).json({ message: "No users found for the selected audience" });
    }

    const notifications = targetUsers.map((u) => ({
      user_id: u.id,
      title,
      message,
      type: "announcement",
      category: "announcement",
      read: false,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      meta: {
        kind: "bulk-announcement",
        createdBy: userId,
        targetAudience,
        ctaLabel: ctaLabel || null,
        ctaUrl: ctaUrl || null,
      },
    }));

    await Notification.bulkCreate(notifications);

    if (sendPush) {
      for (const u of targetUsers) {
        try {
          const canSendPush = await checkUserPreference(u.id, "pushOnSystemAnnouncement");
          const inQuietHours = await isInQuietHours(u.id);

          if (canSendPush && !inQuietHours) {
            await sendPushToUser(u.id, {
              title: `📢 ${title}`,
              body: String(message).substring(0, 200),
              data: { url: ctaUrl || "/dashboard/notifications" },
            });
          }
        } catch (err) {
          console.error(`Push notification failed for user ${u.id}:`, err.message);
        }
      }
    }

    if (sendEmail) {
      for (const u of targetUsers) {
        try {
          const canSendEmail = await checkUserPreference(u.id, "emailOnAnnouncement");
          if (!canSendEmail) continue;

          const recipientEmail = u.email || u.member?.email;
          if (!recipientEmail) continue;

          const fullName =
            `${u.member?.first_name || ""} ${u.member?.last_name || ""}`.trim() || "Reader";

          await sendMail({
            to: recipientEmail,
            subject: `📢 ${title}`,
            text: `Dear ${fullName},\n\n${message}\n\nBest regards,\nThe ${APP_NAME} Team`,
            html: buildEmailHtml({
              title: `📢 ${title}`,
              preheader: String(message).substring(0, 100),
              greeting: `Dear ${fullName}`,
              bodyLines: [message],
              ctaLabel: ctaLabel || null,
              ctaUrl: ctaUrl || null,
              footerNote: `This announcement was sent from ${APP_NAME}.`,
            }),
          });
        } catch (err) {
          console.error(`Email failed for user ${u.id}:`, err.message);
        }
      }
    }

    return res.status(201).json({
      success: true,
      message: `Announcement sent to ${targetUsers.length} users`,
      data: { recipientCount: targetUsers.length, targetAudience, sendEmail, sendPush },
    });
  } catch (err) {
    return next(err);
  }
};

// Get announcement history (admin only)
export const getAnnouncementHistory = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    if (!hasAnnouncementAccess(req) && !(await isAdmin(userId))) {
      return res.status(403).json({ message: "Only admins can view announcement history" });
    }

    const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 20));
    const offset = (pageNum - 1) * perPage;

    // MySQL-safe grouping key from JSON meta + title + message + minute bucket
    const rows = await Notification.findAll({
      where: literal(`JSON_UNQUOTE(JSON_EXTRACT(meta, '$.kind')) = 'bulk-announcement'`),
      attributes: [
        "title",
        "message",
        [fn("MIN", col("createdAt")), "createdAt"],
        [literal(`JSON_UNQUOTE(JSON_EXTRACT(meta, '$.targetAudience'))`), "targetAudience"],
        [literal(`JSON_UNQUOTE(JSON_EXTRACT(meta, '$.createdBy'))`), "createdBy"],
        [fn("COUNT", col("id")), "recipientCount"],
        [fn("SUM", literal("CASE WHEN `read` = 1 THEN 1 ELSE 0 END")), "readCount"],
        [fn("DATE_FORMAT", col("createdAt"), "%Y-%m-%d %H:%i"), "timeBucket"],
      ],
      group: [
        "title",
        "message",
        literal(`JSON_UNQUOTE(JSON_EXTRACT(meta, '$.targetAudience'))`),
        literal(`JSON_UNQUOTE(JSON_EXTRACT(meta, '$.createdBy'))`),
        fn("DATE_FORMAT", col("createdAt"), "%Y-%m-%d %H:%i"),
      ],
      order: [[literal("createdAt"), "DESC"]],
      limit: perPage,
      offset,
      raw: true,
      subQuery: false,
    });

    // Count grouped announcements
    const totalGrouped = await Notification.count({
      where: literal(`JSON_UNQUOTE(JSON_EXTRACT(meta, '$.kind')) = 'bulk-announcement'`),
      distinct: true,
      col: "title",
    });

    return res.json({
      data: rows,
      total: totalGrouped,
      page: pageNum,
      limit: perPage,
      totalPages: Math.ceil(totalGrouped / perPage),
    });
  } catch (err) {
    return next(err);
  }
};

// Get audience preview
export const getAudiencePreview = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    if (!hasAnnouncementAccess(req) && !(await isAdmin(userId))) {
      return res.status(403).json({ message: "Only admins can preview audiences" });
    }

    const { targetAudience = "all" } = req.query;
    if (!VALID_AUDIENCES.includes(targetAudience)) {
      return res.status(400).json({ message: "Invalid target audience" });
    }

    const targetUsers = await getTargetAudience(targetAudience);

    return res.json({
      data: {
        targetAudience,
        count: targetUsers.length,
        preview: targetUsers.slice(0, 5).map((u) => ({
          id: u.id,
          email: u.email || u.member?.email || null,
          name: u.member
            ? `${u.member.first_name || ""} ${u.member.last_name || ""}`.trim() || "Unknown"
            : "Unknown",
        })),
      },
    });
  } catch (err) {
    return next(err);
  }
};

export default {
  createAnnouncement,
  getAnnouncementHistory,
  getAudiencePreview,
};