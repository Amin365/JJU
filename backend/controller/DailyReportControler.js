import DailyReport from "../models/DailyReport.js";
import { Op, fn, col, literal } from "sequelize";
import Book from "../models/Books.js";
import Notification from "../models/Notification.js";
import Role from "../models/Role.js";
import User from "../models/user.js";
import ModeratorMember from "../models/ModeratorMember.js";
import StreakRestore from "../models/StreakRestore.js";
import { checkAndUnlockAchievements } from "./AchievementController.js";
import { syncGoalStatesForUser } from "./ReadingGoalController.js";
import { calcLongestStreak } from "../utility/streakUtils.js";

const escapeLike = (s) =>
  String(s)
    .replace(/\\/g, "\\\\")
    .replace(/[%_]/g, "\\$&");

const toDateOnlyUTC = (d) => {
  const dt = new Date(d);
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
};

const isAllowed48Hours = (readingDate) => {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const yesterday = new Date(today);
  yesterday.setUTCDate(today.getUTCDate() - 1);

  const rd = toDateOnlyUTC(readingDate);
  return rd.getTime() === today.getTime() || rd.getTime() === yesterday.getTime();
};

const getRoleName = (user) =>
  String(user?.role?.role || user?.role?.plural || user?.role || "").toLowerCase();

const isSuperAdminUser = (user) => /super\s*admin/i.test(getRoleName(user));
const isModeratorUser = (user) => /moderator/i.test(getRoleName(user));

const hasAnyPermission = (req, perms = []) => {
  const userPerms = new Set((req.user?.permissions || []).map((p) => String(p).toLowerCase()));
  return perms.some((p) => userPerms.has(String(p).toLowerCase()));
};

const canReviewReports = (req) => hasAnyPermission(req, ["Manage Members", "Manage Issues", "View Members"]);

async function getScopedReportUserIds(currentUser) {
  if (!currentUser?.id) return [];

  if (isSuperAdminUser(currentUser)) return null;

  if (isModeratorUser(currentUser)) {
    const assignments = await ModeratorMember.findAll({
      where: { moderator_id: currentUser.id },
      attributes: ["member_id"],
      raw: true,
    });

    const memberIds = assignments.map((a) => a.member_id).filter(Boolean);
    if (!memberIds.length) return [];

    const users = await User.findAll({
      where: { member_id: { [Op.in]: memberIds } },
      attributes: ["id"],
      raw: true,
    });

    return users.map((u) => u.id);
  }

  return [currentUser.id];
}

// POST /daily-reports
export const createDailyReport = async (req, res, next) => {
  try {
    const createdBy = req.user?.id;
    const { book, readingDate, pagesFrom, pagesTo, timeSpent, summary, rating } = req.body;

    if (!createdBy) return res.status(401).json({ message: "Unauthorized" });
    if (!book || !readingDate || pagesFrom === undefined || pagesTo === undefined || !timeSpent || !summary || !rating) {
      return res.status(400).json({
        message: "book, readingDate, pagesFrom, pagesTo, timeSpent, summary, rating are required",
      });
    }

    if (!Number.isInteger(Number(createdBy))) {
      return res.status(400).json({ message: "Invalid createdBy" });
    }
    if (!Number.isInteger(Number(book))) {
      return res.status(400).json({ message: "Invalid book id" });
    }

    const bookDoc = await Book.findByPk(Number(book));
    if (!bookDoc) return res.status(404).json({ message: "Book not found" });

    if (!isAllowed48Hours(readingDate)) {
      return res.status(400).json({
        message: "You can only submit a report for today or yesterday (48 hours rule).",
      });
    }

    const pf = Number(pagesFrom);
    const pt = Number(pagesTo);
    if (Number.isNaN(pf) || Number.isNaN(pt) || pt <= pf) {
      return res.status(400).json({ message: "pagesTo must be greater than pagesFrom" });
    }

    const last = await DailyReport.findOne({
      where: { createdBy: Number(createdBy), book: Number(book) },
      order: [["readingDate", "DESC"], ["createdAt", "DESC"]],
      attributes: ["pagesTo"],
    });

    if (!last) {
      if (pf !== 1) {
        return res.status(400).json({ message: "First report must start from page 1." });
      }
    } else {
      const expectedFrom = Number(last.pagesTo) + 1;
      if (pf !== expectedFrom) {
        return res.status(400).json({
          message: `pagesFrom must be ${expectedFrom} based on your previous report.`,
        });
      }
    }

    const rd = toDateOnlyUTC(readingDate);

    const report = await DailyReport.create({
      createdBy: Number(createdBy),
      book: Number(book),
      readingDate: rd,
      pagesFrom: pf,
      pagesTo: pt,
      timeSpent: Number(timeSpent),
      summary,
      rating: Number(rating),
      status: "Pending",
    });

    const populated = await DailyReport.findByPk(report.id, {
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "username", "first_name", "last_name", "email", "role_id", "member_id"],
          required: false,
        },
        {
          model: Book,
          as: "bookRef",
          attributes: ["id", "title", "author", "isbn", "status"],
          required: false,
        },
      ],
    });

    // notifications
    try {
      const submitterName =
        [req.user?.first_name, req.user?.middle_name, req.user?.last_name].filter(Boolean).join(" ") ||
        req.user?.username ||
        "User";

      await Notification.create({
        user_id: Number(createdBy),
        title: `Report submitted: ${bookDoc.title}`,
        message: `${submitterName} submitted a reading report on ${new Date(readingDate).toLocaleDateString()}.`,
        type: "success",
        meta: { report: report.id, kind: "report-submitted" },
      });

      const memberId = req.user?.member_id || req.user?.member;
      if (memberId) {
        const assignment = await ModeratorMember.findOne({
          where: { member_id: memberId },
          attributes: ["moderator_id"],
        });

        if (assignment?.moderator_id) {
          await Notification.create({
            user_id: assignment.moderator_id,
            title: `Member report: ${bookDoc.title}`,
            message: `${submitterName} (member) submitted a reading report.`,
            type: "info",
            meta: { report: report.id, member: memberId, kind: "report-submitted" },
          });
        }
      }

      const superAdminRole = await Role.findOne({
        where: {
          [Op.or]: [
            { role: { [Op.like]: "Super Admin" } },
            { plural: { [Op.like]: "Super Admins" } },
          ],
        },
      });

      if (superAdminRole) {
        const superAdmins = await User.findAll({
          where: { role_id: superAdminRole.id },
          attributes: ["id"],
          raw: true,
        });

        if (superAdmins.length) {
          await Notification.bulkCreate(
            superAdmins.map((sa) => ({
              user_id: sa.id,
              title: `Member report: ${bookDoc.title}`,
              message: `${submitterName} submitted a reading report.`,
              type: "info",
              meta: { report: report.id, member: req.user?.member_id || req.user?.member, kind: "report-submitted" },
            }))
          );
        }
      }
    } catch {
      // swallow notification errors
    }

    checkAndUnlockAchievements(req.user.id).catch((err) => console.error("Achievement check failed:", err));
    syncGoalStatesForUser(req.user.id, { sendNotifications: true }).catch((err) =>
      console.error("Goal sync failed:", err)
    );

    return res.status(201).json({ data: populated });
  } catch (err) {
    if (err?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "You already submitted a report for this book on this date." });
    }
    return next(err);
  }
};

// GET /daily-reports
export const getDailyReports = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, sort = "-readingDate", book, createdBy, q } = req.query;

    const where = {};
    if (req.user?.id && !createdBy) where.createdBy = req.user.id;
    if (createdBy) where.createdBy = Number(createdBy);
    if (book) where.book = Number(book);

    if (q) {
      where.summary = { [Op.like]: `%${escapeLike(q)}%` };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.max(1, Math.min(200, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * perPage;

    const sortField = String(sort).startsWith("-") ? String(sort).slice(1) : String(sort);
    const sortDir = String(sort).startsWith("-") ? "DESC" : "ASC";

    const { rows: items, count: total } = await DailyReport.findAndCountAll({
      where,
      include: [
        { model: User, as: "creator", attributes: ["id", "username", "first_name", "last_name", "email", "role_id"], required: false },
        { model: Book, as: "bookRef", attributes: ["id", "title", "author", "isbn", "status"], required: false },
      ],
      order: [[sortField || "readingDate", sortDir]],
      offset,
      limit: perPage,
    });

    return res.status(200).json({
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

// PATCH /daily-reports/:id/status
export const updateDailyReportStatus = async (req, res, next) => {
  try {
    const currentUser = req.user;
    if (!currentUser?.id) return res.status(401).json({ message: "Unauthorized" });

    if (!canReviewReports(req)) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (!isSuperAdminUser(currentUser) && !isModeratorUser(currentUser)) {
      return res.status(403).json({ message: "Only moderators or super admins can review reports" });
    }

    const { id } = req.params;
    const { status } = req.body || {};

    if (!Number.isInteger(Number(id))) return res.status(400).json({ message: "Invalid report id" });

    const allowedStatuses = ["Approved", "Needs Improvement", "Pending"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${allowedStatuses.join(", ")}` });
    }

    const report = await DailyReport.findByPk(Number(id), {
      include: [
        { model: User, as: "creator", attributes: ["id", "first_name", "last_name", "username", "member_id"], required: false },
        { model: Book, as: "bookRef", attributes: ["id", "title", "author", "isbn"], required: false },
      ],
    });

    if (!report) return res.status(404).json({ message: "Report not found" });

    if (isModeratorUser(currentUser) && !isSuperAdminUser(currentUser)) {
      const assignment = await ModeratorMember.findOne({
        where: { moderator_id: currentUser.id, member_id: report.creator?.member_id },
        attributes: ["id"],
      });

      if (!assignment) {
        return res.status(403).json({ message: "You can only review reports from your assigned members" });
      }
    }

    report.status = status;
    await report.save();

    try {
      await Notification.create({
        user_id: report.creator?.id,
        title: `Report ${status.toLowerCase()}: ${report.bookRef?.title || "Book"}`,
        message:
          status === "Approved"
            ? `Your reading report for "${report.bookRef?.title || "this book"}" was approved.`
            : status === "Needs Improvement"
            ? `Your reading report for "${report.bookRef?.title || "this book"}" needs improvement.`
            : `Your reading report for "${report.bookRef?.title || "this book"}" was moved back to pending review.`,
        type: status === "Approved" ? "success" : status === "Needs Improvement" ? "warning" : "info",
        meta: { report: report.id, kind: "report-status-updated", status },
      });
    } catch {
      // ignore notification failure
    }

    const populated = await DailyReport.findByPk(report.id, {
      include: [
        { model: User, as: "creator", attributes: ["id", "username", "first_name", "last_name", "email", "role_id", "member_id"], required: false },
        { model: Book, as: "bookRef", attributes: ["id", "title", "author", "isbn", "status"], required: false },
      ],
    });

    return res.status(200).json({ data: populated });
  } catch (err) {
    return next(err);
  }
};

// GET /daily-reports/admin
export const getDailyReportsByMember = async (req, res, next) => {
  try {
    if (!req.user?.id || !canReviewReports(req)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { memberId, from, to, book, limit = 5000 } = req.query;
    if (!memberId) return res.status(400).json({ message: "memberId is required" });

    const users = await User.findAll({
      where: { member_id: Number(memberId) },
      attributes: ["id"],
      raw: true,
    });
    const userIds = users.map((u) => u.id);

    if (!userIds.length) return res.status(200).json({ data: [] });

    const where = { createdBy: { [Op.in]: userIds } };
    if (book) where.book = Number(book);

    if (from || to) {
      where.readingDate = {};
      if (from) where.readingDate[Op.gte] = new Date(from);
      if (to) where.readingDate[Op.lte] = new Date(to);
    }

    const reports = await DailyReport.findAll({
      where,
      include: [
        { model: User, as: "creator", attributes: ["id", "username", "first_name", "last_name", "email", "role_id", "member_id"], required: false },
        { model: Book, as: "bookRef", attributes: ["id", "title", "author", "isbn", "status"], required: false },
      ],
      order: [["readingDate", "DESC"]],
      limit: Math.min(Number(limit) || 5000, 5000),
    });

    return res.status(200).json({ data: reports });
  } catch (err) {
    return next(err);
  }
};

// GET /daily-reports/:id (or public passthrough)
export const getDailyReportById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (id === "public") return getDailyReportsPublic(req, res, next);
    if (!Number.isInteger(Number(id))) return res.status(400).json({ message: "Invalid report id" });

    const report = await DailyReport.findByPk(Number(id), {
      include: [
        { model: User, as: "creator", attributes: ["id", "username", "first_name", "last_name", "email", "role_id"], required: false },
        { model: Book, as: "bookRef", attributes: ["id", "title", "author", "isbn", "status"], required: false },
      ],
    });

    if (!report) return res.status(404).json({ message: "Report not found" });

    if (req.user?.id && String(report.creator?.id || report.createdBy) !== String(req.user.id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.status(200).json({ data: report });
  } catch (err) {
    return next(err);
  }
};

// GET /daily-reports/scope
export const getDailyReportsScope = async (req, res, next) => {
  try {
    const { memberId, from, to, limit = 5000 } = req.query;
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });

    if (!canReviewReports(req)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const currentUser = await User.findByPk(req.user.id, {
      include: [{ model: Role, as: "role", attributes: ["role", "plural"], required: false }],
    });

    const roleName = (currentUser?.role?.role || currentUser?.role?.plural || "").toLowerCase();
    const isSuperAdmin = /super\s*admin/i.test(roleName);
    const isModerator = /moderator/i.test(roleName);

    const where = {};

    if (from || to) {
      where.readingDate = {};
      if (from) where.readingDate[Op.gte] = new Date(from);
      if (to) where.readingDate[Op.lte] = new Date(to);
    }

    if (isSuperAdmin) {
      if (memberId) {
        if (!Number.isInteger(Number(memberId))) {
          return res.status(400).json({ message: "Invalid memberId" });
        }

        const users = await User.findAll({
          where: { member_id: Number(memberId) },
          attributes: ["id"],
          raw: true,
        });
        const ids = users.map((u) => u.id);
        if (!ids.length) return res.status(200).json({ data: [] });
        where.createdBy = { [Op.in]: ids };
      }
    } else if (isModerator) {
      if (memberId) {
        if (!Number.isInteger(Number(memberId))) {
          return res.status(400).json({ message: "Invalid memberId" });
        }

        const assigned = await ModeratorMember.findOne({
          where: { moderator_id: req.user.id, member_id: Number(memberId) },
          attributes: ["id"],
        });

        if (!assigned) {
          return res.status(403).json({ message: "Forbidden: member not assigned to this moderator" });
        }

        const users = await User.findAll({
          where: { member_id: Number(memberId) },
          attributes: ["id"],
          raw: true,
        });
        const ids = users.map((u) => u.id);
        if (!ids.length) return res.status(200).json({ data: [] });
        where.createdBy = { [Op.in]: ids };
      } else {
        const assigned = await ModeratorMember.findAll({
          where: { moderator_id: req.user.id },
          attributes: ["member_id"],
          raw: true,
        });

        const memberIds = assigned.map((a) => a.member_id);
        if (!memberIds.length) return res.status(200).json({ data: [] });

        const users = await User.findAll({
          where: { member_id: { [Op.in]: memberIds } },
          attributes: ["id"],
          raw: true,
        });

        const ids = users.map((u) => u.id);
        if (!ids.length) return res.status(200).json({ data: [] });
        where.createdBy = { [Op.in]: ids };
      }
    } else {
      where.createdBy = req.user.id;
    }

    const items = await DailyReport.findAll({
      where,
      include: [
        { model: User, as: "creator", attributes: ["id", "username", "first_name", "last_name", "email", "role_id", "member_id"], required: false },
        { model: Book, as: "bookRef", attributes: ["id", "title", "author", "isbn", "status"], required: false },
      ],
      order: [["readingDate", "DESC"]],
      limit: Math.min(Number(limit) || 5000, 5000),
    });

    return res.status(200).json({ data: items });
  } catch (err) {
    return next(err);
  }
};

const getMonthKey = (date = new Date()) => {
  const d = new Date(date);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

// GET /daily-reports/streak-restore
export const getStreakRestoreStatus = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const month = getMonthKey();
    const doc = await StreakRestore.findOne({
      where: { user_id: userId, month },
      attributes: ["count", "restoredForDate", "month"],
    });

    return res.status(200).json({
      count: doc?.count ?? 0,
      restoredForDate: doc?.restoredForDate ? doc.restoredForDate.toISOString().slice(0, 10) : null,
      month,
    });
  } catch (err) {
    return next(err);
  }
};

// POST /daily-reports/streak-restore
export const restoreStreak = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { restoredForDate } = req.body || {};
    if (!restoredForDate) return res.status(400).json({ message: "restoredForDate is required" });

    const rd = toDateOnlyUTC(restoredForDate);
    if (Number.isNaN(rd.getTime())) return res.status(400).json({ message: "Invalid restoredForDate" });

    const month = getMonthKey();

    let doc = await StreakRestore.findOne({ where: { user_id: userId, month } });
    if (doc && doc.count >= 5) {
      return res.status(400).json({ message: "No restores left this month" });
    }

    if (!doc) {
      doc = await StreakRestore.create({
        user_id: userId,
        month,
        count: 1,
        restoredForDate: rd,
      });
    } else {
      doc.count = Number(doc.count || 0) + 1;
      doc.restoredForDate = rd;
      await doc.save();
    }

    return res.status(200).json({
      count: doc.count ?? 0,
      restoredForDate: doc.restoredForDate ? doc.restoredForDate.toISOString().slice(0, 10) : null,
      month: doc.month ?? month,
    });
  } catch (err) {
    return next(err);
  }
};

// GET /daily-reports/public
export const getDailyReportsPublic = async (req, res, next) => {
  try {
    const { from, to, limit = 5000 } = req.query;

    const where = {};
    if (from || to) {
      where.readingDate = {};
      if (from) where.readingDate[Op.gte] = new Date(from);
      if (to) where.readingDate[Op.lte] = new Date(to);
    }

    const items = await DailyReport.findAll({
      where,
      attributes: ["id", "createdBy", "readingDate"],
      include: [{ model: User, as: "creator", attributes: ["id", "username", "first_name", "last_name"], required: false }],
      order: [["readingDate", "DESC"]],
      limit: Math.min(Number(limit) || 5000, 5000),
    });

    return res.status(200).json({ data: items });
  } catch (err) {
    return next(err);
  }
};

// GET /daily-reports/leaderboard
export const getLeaderboardEnhanced = async (req, res, next) => {
  try {
    const { period = "all-time", department, study_year, sortBy = "reports" } = req.query;

    const where = { status: "Approved" };

    if (period === "weekly") {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      where.readingDate = { [Op.gte]: since };
    } else if (period === "monthly") {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      where.readingDate = { [Op.gte]: since };
    }

    const reports = await DailyReport.findAll({
      where,
      attributes: ["createdBy", "pagesFrom", "pagesTo", "timeSpent", "readingDate"],
      raw: true,
    });

    if (!reports.length) return res.status(200).json({ data: [] });

    const grouped = new Map();

    for (const r of reports) {
      const uid = String(r.createdBy);
      if (!grouped.has(uid)) {
        grouped.set(uid, {
          userId: r.createdBy,
          reportsCount: 0,
          pagesRead: 0,
          minutesRead: 0,
          readingDates: [],
        });
      }
      const g = grouped.get(uid);
      g.reportsCount += 1;
      g.pagesRead += Math.max(0, Number(r.pagesTo || 0) - Number(r.pagesFrom || 0));
      g.minutesRead += Number(r.timeSpent || 0);
      if (r.readingDate) g.readingDates.push(r.readingDate);
    }

    const userIds = [...grouped.values()].map((x) => x.userId);

    const users = await User.findAll({
      where: { id: { [Op.in]: userIds } },
      attributes: ["id", "first_name", "last_name", "username", "profile_picture", "department", "study_year"],
      raw: true,
    });

    const userMap = new Map(users.map((u) => [String(u.id), u]));

    let entries = [...grouped.values()]
      .map((a) => {
        const user = userMap.get(String(a.userId));
        if (!user) return null;

        if (department && user.department !== department) return null;
        if (study_year && String(user.study_year) !== String(study_year)) return null;

        const streak = calcLongestStreak(a.readingDates || []);

        return {
          user: {
            _id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            username: user.username,
            profile_picture: user.profile_picture || "",
            department: user.department || null,
            study_year: user.study_year || null,
          },
          reportsCount: a.reportsCount,
          pagesRead: a.pagesRead,
          minutesRead: a.minutesRead,
          streak,
        };
      })
      .filter(Boolean);

    const sortMap = {
      streak: "streak",
      pages: "pagesRead",
      minutes: "minutesRead",
      reports: "reportsCount",
    };

    const sortField = sortMap[sortBy] || "reportsCount";
    entries.sort((a, b) => Number(b[sortField] || 0) - Number(a[sortField] || 0));
    entries = entries.slice(0, 100);

    return res.status(200).json({ data: entries });
  } catch (err) {
    return next(err);
  }
};

export default {
  createDailyReport,
  getDailyReports,
  updateDailyReportStatus,
  getDailyReportsByMember,
  getDailyReportById,
  getDailyReportsScope,
  getStreakRestoreStatus,
  restoreStreak,
  getDailyReportsPublic,
  getLeaderboardEnhanced,
};