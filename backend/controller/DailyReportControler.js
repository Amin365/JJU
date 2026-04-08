 
import DailyReport from "../models/DailyReport.js";
import { Op } from 'sequelize';
import Book from "../models/Books.js"; 
import Notification from "../models/Notification.js";
import Role from "../models/Role.js";
import User from "../models/user.js";
import ModeratorMember from "../models/ModeratorMember.js";
import StreakRestore from "../models/StreakRestore.js";
import { checkAndUnlockAchievements } from "./AchievementController.js";
import { syncGoalStatesForUser } from "./ReadingGoalController.js";
import { calcLongestStreak } from "../utility/streakUtils.js";
                       
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

const getRoleName = (user) => String(user?.role?.role || user?.role?.plural || user?.role || "").toLowerCase();

const isSuperAdminUser = (user) => /super\s*admin/i.test(getRoleName(user));
const isModeratorUser = (user) => /moderator/i.test(getRoleName(user));

const intersectObjectIdArrays = (left = [], right = []) => {
  const rightSet = new Set(right.map((id) => String(id)));
  return left.filter((id) => rightSet.has(String(id)));
};

async function getScopedReportUserIds(currentUser) {
  if (!currentUser?.id) return [];

  if (isSuperAdminUser(currentUser)) {
    return null;
  }

  if (isModeratorUser(currentUser)) {
    const assignments = await ModeratorMember.find({ moderator: currentUser.id }).select("member");
    const memberIds = assignments.map((assignment) => assignment.member).filter(Boolean);
    if (!memberIds.length) return [];

    const users = await User.find({ member: { [Op.in]: memberIds } }).select("_id");
    return users.map((user) => user.id);
  }

  return [currentUser.id];
}

// POST /daily-reports
export const createDailyReport = async (req, res, next) => {
  try {
    const createdBy = req.user?.id 
    const { book, readingDate, pagesFrom, pagesTo, timeSpent, summary, rating } = req.body;

    if (!createdBy) return res.status(401).json({ message: "Unauthorized" });
    if (!book || !readingDate || pagesFrom === undefined || pagesTo === undefined || !timeSpent || !summary || !rating) {
      return res.status(400).json({ message: "book, readingDate, pagesFrom, pagesTo, timeSpent, summary, rating are required" });
    }

    if (!Number.isInteger(Number(createdBy))) return res.status(400).json({ message: "Invalid createdBy" });
    if (!Number.isInteger(Number(book))) return res.status(400).json({ message: "Invalid book id" });

    // Validate book exists
    const bookDoc = await Book.findByPk(book);
    if (!bookDoc) return res.status(404).json({ message: "Book not found" });

    // 48 hours rule: only today and yesterday
    if (!isAllowed48Hours(readingDate)) {
      return res.status(400).json({ message: "You can only submit a report for today or yesterday (48 hours rule)." });
    }

    const pf = Number(pagesFrom);
    const pt = Number(pagesTo);
    if (Number.isNaN(pf) || Number.isNaN(pt) || pt <= pf) {
      return res.status(400).json({ message: "pagesTo must be greater than pagesFrom" });
    }

    const last = await DailyReport.findOne({ createdBy, book })
  .sort({ readingDate: -1, createdAt: -1 })
  .select("pagesTo")
  
  ;

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
      createdBy:createdBy,
      book,
      readingDate: rd,
      pagesFrom: pf,
      pagesTo: pt,
      timeSpent: Number(timeSpent),
      summary,
      rating: Number(rating),
      status: "Pending",
    });

    const populated = await DailyReport.findByPk(report.id)
      .populate("createdBy", "username first_name last_name email role")
      .populate("book", "title author isbn status")
      
      ;

    // Notify user about their submitted report
    try {
      const submitterName =
        [req.user?.first_name, req.user?.middle_name, req.user?.last_name].filter(Boolean).join(" ") ||
        req.user?.username ||
        "User";

      await Notification.create({
        user: createdBy,
        title: `Report submitted: ${bookDoc.title}`,
        message: `${submitterName} submitted a reading report on ${new Date(readingDate).toLocaleDateString()}.`,
        type: "success",
        meta: { report: report.id, kind: "report-submitted" },
      });
    } catch (e) {}

    // Additionally notify the assigned moderator (if any) and all super admins
    try {
      const memberId = req.user?.member;
      if (memberId) {
        const assignment = await ModeratorMember.findOne({ member: memberId }).populate("moderator", "_id first_name last_name username email");
        if (assignment && assignment.moderator) {
          await Notification.create({
            user: assignment.moderator.id,
            title: `Member report: ${bookDoc.title}`,
            message: `${submitterName} (member) submitted a reading report.`,
            type: "info",
            meta: { report: report.id, member: memberId, kind: "report-submitted" },
          });
        }
      }

      // Notify super admins
      const superAdminRole = await Role.findOne({
        [Op.or]: [
          { role: { [Op.like]: "^Super Admin$", $options: "i" } },
          { plural: { [Op.like]: "^Super Admins$", $options: "i" } },
        ],
      });

      if (superAdminRole) {
        const superAdmins = await User.find({ role: superAdminRole.id }).select("_id");
        if (superAdmins && superAdmins.length > 0) {
          const notifDocs = superAdmins.map((sa) => ({
            user: sa.id,
            title: `Member report: ${bookDoc.title}`,
            message: `${submitterName} submitted a reading report.`,
            type: "info",
            meta: { report: report.id, member: req.user?.member, kind: "report-submitted" },
            createdAt: new Date(),
            updatedAt: new Date(),
          }));
          if (notifDocs.length > 0) await Notification.bulkCreate(notifDocs);
        }
      }
    } catch (e) {
      // swallow notification errors so report creation still succeeds
    }

    checkAndUnlockAchievements(req.user.id).catch((err) => console.error("Achievement check failed:", err));
    syncGoalStatesForUser(req.user.id, { sendNotifications: true }).catch((err) =>
      console.error("Goal sync failed:", err)
    );

    return res.status(201).json({ data: populated });
  } catch (err) {
    if (err && err.code === 11000) {
      // duplicate report per day
      return res.status(409).json({ message: "You already submitted a report for this book on this date." });
    }
    return next(err);
  }
};

// GET /daily-reports?book=&createdBy=&page=&limit=&q=
export const getDailyReports = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = "-readingDate",
      book,
      createdBy, // allow admin filtering or self
      q,
    } = req.query;

    const filter = {};

    // default: only current user's reports if auth exists and createdBy not provided
    if (req.user?.id && !createdBy) filter.createdBy = req.user.id;
    if (createdBy) filter.createdBy = createdBy;

    if (book) filter.book = book;

    if (q) {
      const re = new RegExp(escapeRegex(q), "i");
      filter.summary = re;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.max(1, Math.min(200, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * perPage;

    const [items, total] = await Promise.all([
      DailyReport.find(filter)
        .populate("createdBy", "username first_name last_name email role")
        .populate("book", "title author isbn status")
        .sort(sort)
        .skip(skip)
        .limit(perPage)
        
        ,
      DailyReport.countDocuments(filter),
    ]);

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
    if (!currentUser?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!isSuperAdminUser(currentUser) && !isModeratorUser(currentUser)) {
      return res.status(403).json({ message: "Only moderators or super admins can review reports" });
    }

    const { id } = req.params;
    const { status } = req.body || {};

    if (!Number.isInteger(Number(id))) {
      return res.status(400).json({ message: "Invalid report id" });
    }

    const allowedStatuses = ["Approved", "Needs Improvement", "Pending"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${allowedStatuses.join(", ")}` });
    }

    const report = await DailyReport.findByPk(id)
      .populate({ path: "createdBy", select: "_id first_name last_name username member" })
      .populate("book", "title author isbn")
      ;

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    if (isModeratorUser(currentUser) && !isSuperAdminUser(currentUser)) {
      const assignment = await ModeratorMember.findOne({
        moderator: currentUser.id,
        member: report.createdBy?.member,
      })
        .select("_id")
        
        ;

      if (!assignment) {
        return res.status(403).json({ message: "You can only review reports from your assigned members" });
      }
    }

    report.status = status;
    await report.save();

    try {
      await Notification.create({
        user: report.createdBy?.id,
        title: `Report ${status.toLowerCase()}: ${report.book?.title || "Book"}`,
        message:
          status === "Approved"
            ? `Your reading report for "${report.book?.title || "this book"}" was approved.`
            : status === "Needs Improvement"
              ? `Your reading report for "${report.book?.title || "this book"}" needs improvement.`
              : `Your reading report for "${report.book?.title || "this book"}" was moved back to pending review.`,
        type: status === "Approved" ? "success" : status === "Needs Improvement" ? "warning" : "info",
        meta: { report: report.id, kind: "report-status-updated", status },
      });
    } catch (error) {
      // ignore notification failure
    }

    const populated = await DailyReport.findByPk(report.id)
      .populate("createdBy", "username first_name last_name email role member")
      .populate("book", "title author isbn status")
      
      ;

    return res.status(200).json({ data: populated });
  } catch (err) {
    return next(err);
  }
};

// GET /daily-reports/admin?memberId=...&from=YYYY-MM-DD&to=YYYY-MM-DD&book=
export const getDailyReportsByMember = async (req, res, next) => {
  try {
    const { memberId, from, to, book, limit = 5000 } = req.query;

    if (!memberId) return res.status(400).json({ message: "memberId is required" });

    // find users that belong to this member
    const users = await User.find({ member: memberId }).select("_id");
    const userIds = users.map((u) => u.id);

    if (userIds.length === 0) return res.status(200).json({ data: [] });

    const filter = { createdBy: { [Op.in]: userIds } };

    if (book) filter.book = book;

    if (from || to) {
      filter.readingDate = {};
      if (from) filter.readingDate.$gte = new Date(from);
      if (to) filter.readingDate.$lte = new Date(to);
    }

    const reports = await DailyReport.find(filter)
      .populate("createdBy", "username first_name last_name email role member member_id")
      .populate("book", "title author isbn status")
      .sort("-readingDate")
      .limit(Math.min(Number(limit) || 5000, 5000))
      
      ;

    return res.status(200).json({ data: reports });
  } catch (err) {
    return next(err);
  }
};
// Optional: GET /daily-reports/:id
export const getDailyReportById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (id === "public") {
      return getDailyReportsPublic(req, res, next);
    }
    if (!Number.isInteger(Number(id))) return res.status(400).json({ message: "Invalid report id" });

    const report = await DailyReport.findByPk(id)
      .populate("createdBy", "username first_name last_name email role")
      .populate("book", "title author isbn status")
      
      ;

    if (!report) return res.status(404).json({ message: "Report not found" });

    // If you want strict privacy:
    if (req.user?.id && String(report.createdBy?.id || report.createdBy) !== String(req.user.id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.status(200).json({ data: report });
  } catch (err) {
    return next(err);
  }
};



// GET /daily-reports/scope?memberId=&from=&to=&limit=
export const getDailyReportsScope = async (req, res, next) => {
  try {
    const { memberId, from, to, limit = 5000 } = req.query;
    // require logged in
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });

    // load current user role (to determine if super admin or moderator)
    const currentUser = await User.findByPk(req.user.id).populate("role", "role plural");
    const roleName = (currentUser?.role?.role || currentUser?.role?.plural || "").toLowerCase();
    const isSuperAdmin = /super\s*admin/i.test(roleName);
    const isModerator = /moderator/i.test(roleName);
   
    const filter = {};

    // optional date range
    if (from || to) {
      filter.readingDate = {};
      if (from) filter.readingDate.$gte = new Date(from);
      if (to) filter.readingDate.$lte = new Date(to);
    }

    // Behavior:
    // - Super Admin: can view all reports (optionally filtered by memberId)
    // - Moderator: can view reports only for members assigned to that moderator
    // - Regular user: only their own reports

    if (isSuperAdmin) {
      // if memberId provided, validate and filter by it
      if (memberId) {
        if (!Number.isInteger(Number(memberId))) {
          return res.status(400).json({ message: "Invalid memberId" });
        }

        const users = await User.find({ member: memberId }).select("_id");
        const ids = users.map((u) => u.id);
        if (ids.length === 0) return res.status(200).json({ data: [] });
        filter.createdBy = { [Op.in]: ids };
      }
    } else if (isModerator) {
      // moderator: restrict to members assigned to this moderator
      // if moderator asks for a specific member, ensure assignment exists
      if (memberId) {
        if (!Number.isInteger(Number(memberId))) {
          return res.status(400).json({ message: "Invalid memberId" });
        }

        const assigned = await ModeratorMember.findOne({ moderator: req.user.id, member: memberId });

        if (!assigned) return res.status(403).json({ message: "Forbidden: member not assigned to this moderator" });

        const users = await User.find({ member: memberId }).select("_id");
        const ids = users.map((u) => u.id);
        if (ids.length === 0) return res.status(200).json({ data: [] });
        filter.createdBy = { [Op.in]: ids };
      } else {
        // no memberId: get all members assigned to moderator and return reports for users in those members
        const assigned = await ModeratorMember.find({ moderator: req.user.id }).select("member");
        const memberIds = assigned.map((a) => a.member);
        if (memberIds.length === 0) return res.status(200).json({ data: [] });

        const users = await User.find({ member: { [Op.in]: memberIds } }).select("_id");
        const ids = users.map((u) => u.id);
        if (ids.length === 0) return res.status(200).json({ data: [] });
        filter.createdBy = { [Op.in]: ids };
      }
    } else {
      // regular user: only their own reports
      filter.createdBy = req.user.id;
    }

    const items = await DailyReport.find(filter)
      .populate("createdBy", "username first_name last_name email role member member_id")
      .populate("book", "title author isbn status")
      .sort("-readingDate")
      .limit(Math.min(Number(limit) || 5000, 5000))
      
      ;

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
    const doc = await StreakRestore.findOne({ user: userId, month })
      .select("count restoredForDate month")
      
      ;

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
    if (Number.isNaN(rd.getTime())) {
      return res.status(400).json({ message: "Invalid restoredForDate" });
    }

    const month = getMonthKey();
    const existing = await StreakRestore.findOne({ user: userId, month });
    if (existing && existing.count >= 5) {
      return res.status(400).json({ message: "No restores left this month" });
    }

    const updated = await StreakRestore.findOneAndUpdate(
      { user: userId, month },
      {
        $inc: { count: 1 },
        $set: { restoredForDate: rd },
      },
      { new: true, upsert: true }
    )
      .select("count restoredForDate month")
      
      ;

    return res.status(200).json({
      count: updated?.count ?? 0,
      restoredForDate: updated?.restoredForDate ? updated.restoredForDate.toISOString().slice(0, 10) : null,
      month: updated?.month ?? month,
    });
  } catch (err) {
    return next(err);
  }
};

// GET /daily-reports/public?from=&to=&limit=
export const getDailyReportsPublic = async (req, res, next) => {
  try {
    const { from, to, limit = 5000 } = req.query;

    const filter = {};
    if (from || to) {
      filter.readingDate = {};
      if (from) filter.readingDate.$gte = new Date(from);
      if (to) filter.readingDate.$lte = new Date(to);
    }

    const items = await DailyReport.find(filter)
      .populate("createdBy", "username first_name last_name")
      .select("createdBy readingDate")
      .sort("-readingDate")
      .limit(Math.min(Number(limit) || 5000, 5000))
      
      ;

    return res.status(200).json({ data: items });
  } catch (err) {
    return next(err);
  }
};
// GET /daily-reports/leaderboard
export const getLeaderboardEnhanced = async (req, res, next) => {
  try {
    const { period = "all-time", department, study_year, sortBy = "reports" } = req.query;

    let dateFilter = {};
    if (period === "weekly") {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      dateFilter = { [Op.gte]: since };
    } else if (period === "monthly") {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      dateFilter = { [Op.gte]: since };
    }

    const matchStage = { status: "Approved" };
    if (dateFilter.$gte) matchStage.readingDate = dateFilter;

    // Aggregate reports by user
    const agg = await DailyReport.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$createdBy",
          reportsCount: { $sum: 1 },
          pagesRead: { $sum: { $max: [0, { $subtract: ["$pagesTo", "$pagesFrom"] }] } },
          minutesRead: { $sum: "$timeSpent" },
          readingDates: { $addToSet: "$readingDate" },
        },
      },
    ]);

    if (!agg.length) return res.status(200).json({ data: [] });

    const userIds = agg.map((a) => a.id);

    // Fetch user data with member info
    const users = await User.find({ _id: { [Op.in]: userIds } })
      .select("first_name last_name username profile_picture member")
      .populate({
        path: "member",
        select: "department study_year Profile_picture",
      })
      ;

    const userMap = new Map(users.map((u) => [String(u.id), u]));

    // Build leaderboard entries
    let entries = agg.map((a) => {
      const user = userMap.get(String(a.id));
      if (!user) return null;

      const memberData = user.member || {};
      if (department && memberData.department !== department) return null;
      if (study_year && String(memberData.study_year) !== String(study_year)) return null;

      // Compute streak from readingDates
      const streak = calcLongestStreak(a.readingDates || []);

      return {
        user: {
          _id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          username: user.username,
          profile_picture: memberData.Profile_picture || user.profile_picture || "",
          department: memberData.department || null,
          study_year: memberData.study_year || null,
        },
        reportsCount: a.reportsCount,
        pagesRead: a.pagesRead,
        minutesRead: a.minutesRead,
        streak,
      };
    }).filter(Boolean);

    const sortMap = { streak: "streak", pages: "pagesRead", minutes: "minutesRead", reports: "reportsCount" };
    const sortField = sortMap[sortBy] || "reportsCount";
    entries.sort((a, b) => b[sortField] - a[sortField]);
    entries = entries.slice(0, 100);

    return res.status(200).json({ data: entries });
  } catch (err) {
    return next(err);
  }
};
