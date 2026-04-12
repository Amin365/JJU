import Comment from "../models/Comments.js";
import { Op, literal } from "sequelize";
import BlogPost from "../models/BlogPost.js";
import User from "../models/user.js";

/**
 * Helper: Check if user is admin/moderator
 */
const isModeratorOrAdmin = async (userId) => {
  const user = await User.findByPk(userId, {
    include: [{ model: Role, as: "role", attributes: ["role", "plural"], required: false }],
  });
  if (!user) return false;

  const roleName = (user.role?.role || user.role?.plural || "").toLowerCase();
  return /super\s*admin/i.test(roleName) || /moderator/i.test(roleName) || /admin/i.test(roleName);
};

const isValidId = (id) => Number.isInteger(Number(id)) && Number(id) > 0;

const hasAnyPermission = (req, perms = []) => {
  const userPerms = new Set((req.user?.permissions || []).map((p) => String(p).toLowerCase()));
  return perms.some((p) => userPerms.has(String(p).toLowerCase()));
};

const hasPrivilegedRole = (req) => {
  const roleName = String(req.user?.role?.role || req.user?.role?.plural || req.user?.role || "").toLowerCase();
  return /super\s*admin/i.test(roleName) || /moderator/i.test(roleName) || /admin/i.test(roleName);
};

const canModerateComments = async (req) => {
  if (hasPrivilegedRole(req)) return true;
  if (hasAnyPermission(req, ["Manage Members", "Manage Issues", "View Members"])) return true;
  return isModeratorOrAdmin(req.user?.id);
};

/**
 * GET /comments/moderation/queue
 * Get comments in moderation queue (pending, reported, or hidden)
 */
export const getModerationQueue = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const canModerate = await canModerateComments(req);
    if (!canModerate) return res.status(403).json({ message: "Permission denied" });

    const { status, hasReports, page = 1, limit = 20 } = req.query;

    const where = {};

    if (status && ["approved", "pending", "hidden", "deleted"].includes(status)) {
      where.status = status;
    } else {
      where.status = { [Op.in]: ["pending", "hidden"] };
    }

    if (hasReports === "true") {
      where[Op.and] = [literal(`JSON_LENGTH(reports) > 0`)];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * perPage;

    const { rows: comments, count: total } = await Comment.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      offset,
      limit: perPage,
      include: [
        { model: BlogPost, as: "post", attributes: ["id", "title", "slug"], required: false },
        { model: User, as: "moderator", attributes: ["id", "first_name", "last_name", "email"], required: false },
      ],
    });

    return res.status(200).json({
      data: comments,
      total,
      page: pageNum,
      limit: perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (err) {
    console.error("getModerationQueue:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

/**
 * GET /comments/moderation/stats
 * Get moderation statistics
 */
export const getModerationStats = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const canModerate = await canModerateComments(req);
    if (!canModerate) return res.status(403).json({ message: "Permission denied" });

    const [pending, hidden, reported, total] = await Promise.all([
      Comment.count({ where: { status: "pending" } }),
      Comment.count({ where: { status: "hidden" } }),
      Comment.count({
        where: {
          status: { [Op.ne]: "deleted" },
          [Op.and]: [literal(`JSON_LENGTH(reports) > 0`)],
        },
      }),
      Comment.count({ where: { status: { [Op.ne]: "deleted" } } }),
    ]);

    return res.status(200).json({
      data: {
        pending,
        hidden,
        reported,
        total,
        approved: Math.max(0, total - pending - hidden),
      },
    });
  } catch (err) {
    console.error("getModerationStats:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

/**
 * PUT /comments/:commentId/moderate
 * Approve, hide, or delete a comment
 */
export const moderateComment = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const canModerate = await canModerateComments(req);
    if (!canModerate) return res.status(403).json({ message: "Permission denied" });

    const { commentId } = req.params;
    const { action, note } = req.body;

    if (!isValidId(commentId)) return res.status(400).json({ message: "Invalid comment ID" });

    if (!["approve", "hide", "delete", "restore"].includes(action)) {
      return res.status(400).json({ message: "Invalid action. Use: approve, hide, delete, or restore" });
    }

    const comment = await Comment.findByPk(Number(commentId));
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    comment.moderatedBy = userId;
    comment.moderatedAt = new Date();
    if (note) comment.moderationNote = String(note).trim();

    switch (action) {
      case "approve":
      case "restore":
        comment.status = "approved";
        break;
      case "hide":
        comment.status = "hidden";
        break;
      case "delete":
        comment.status = "deleted";
        break;
      default:
        break;
    }

    await comment.save();

    return res.status(200).json({
      data: comment,
      message: `Comment ${action}d successfully`,
    });
  } catch (err) {
    console.error("moderateComment:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

/**
 * POST /comments/:commentId/report
 * Report a comment for abuse
 */
export const reportComment = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { commentId } = req.params;
    const { reason, details } = req.body;

    if (!isValidId(commentId)) return res.status(400).json({ message: "Invalid comment ID" });
    if (!reason?.trim()) return res.status(400).json({ message: "Report reason is required" });

    const comment = await Comment.findByPk(Number(commentId));
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const reports = Array.isArray(comment.reports) ? [...comment.reports] : [];

    const alreadyReported = reports.some((r) => String(r.reportedBy) === String(userId));
    if (alreadyReported) {
      return res.status(400).json({ message: "You have already reported this comment" });
    }

    reports.push({
      reportedBy: userId,
      reason: reason.trim(),
      details: details?.trim() || "",
      createdAt: new Date(),
    });

    comment.reports = reports;
    await comment.save();

    return res.status(200).json({
      message: "Comment reported successfully",
      reportCount: reports.length,
    });
  } catch (err) {
    console.error("reportComment:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

/**
 * DELETE /comments/:commentId/reports
 * Clear reports from a comment (after review)
 */
export const clearReports = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const canModerate = await canModerateComments(req);
    if (!canModerate) return res.status(403).json({ message: "Permission denied" });

    const { commentId } = req.params;
    if (!isValidId(commentId)) return res.status(400).json({ message: "Invalid comment ID" });

    const comment = await Comment.findByPk(Number(commentId));
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    comment.reports = [];
    comment.moderatedBy = userId;
    comment.moderatedAt = new Date();
    await comment.save();

    return res.status(200).json({
      message: "Reports cleared successfully",
      data: comment,
    });
  } catch (err) {
    console.error("clearReports:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

/**
 * PUT /comments/:commentId/pin
 * Toggle pin status of a comment
 */
export const togglePinComment = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const canModerate = await canModerateComments(req);
    if (!canModerate) return res.status(403).json({ message: "Permission denied" });

    const { commentId } = req.params;
    if (!isValidId(commentId)) return res.status(400).json({ message: "Invalid comment ID" });

    const comment = await Comment.findByPk(Number(commentId));
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    comment.isPinned = !comment.isPinned;
    await comment.save();

    return res.status(200).json({
      data: comment,
      message: comment.isPinned ? "Comment pinned" : "Comment unpinned",
    });
  } catch (err) {
    console.error("togglePinComment:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

/**
 * PUT /comments/:commentId/best-insight
 * Toggle best insight status of a comment
 */
export const toggleBestInsight = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const canModerate = await canModerateComments(req);
    if (!canModerate) return res.status(403).json({ message: "Permission denied" });

    const { commentId } = req.params;
    if (!isValidId(commentId)) return res.status(400).json({ message: "Invalid comment ID" });

    const comment = await Comment.findByPk(Number(commentId));
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    comment.isBestInsight = !comment.isBestInsight;
    await comment.save();

    return res.status(200).json({
      data: comment,
      message: comment.isBestInsight ? "Marked as best insight" : "Removed best insight status",
    });
  } catch (err) {
    console.error("toggleBestInsight:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

export default {
  getModerationQueue,
  getModerationStats,
  moderateComment,
  reportComment,
  clearReports,
  togglePinComment,
  toggleBestInsight,
};