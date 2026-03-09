/**
 * Phase 5 - Admin Reporting Center Controller
 * Provides analytics and reporting endpoints for admin users.
 */

import mongoose from "mongoose";
import DailyReport from "../models/DailyReport.js";
import Member from "../models/Members.js";
import User from "../models/user.js";
import Issue from "../models/Issue.js";
import Book from "../models/Books.js";
import Role from "../models/Role.js";
import { calcLongestStreak, calcPagesRead } from "../utility/streakUtils.js";

// Helper to get date boundaries
const getDateBoundaries = (from, to) => {
  const filter = {};
  if (from || to) {
    filter.readingDate = {};
    if (from) filter.readingDate.$gte = new Date(from);
    if (to) filter.readingDate.$lte = new Date(to);
  }
  return filter;
};

// Helper to get month start/end
const getMonthBounds = (year, month) => {
  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
  return { start, end };
};

/**
 * GET /api/reporting/admin-reports
 * Comprehensive admin reporting with filters
 * Query params: from, to, status, department, study_year, userId, page, limit, sortBy
 */
export const getAdminReports = async (req, res, next) => {
  try {
    const {
      from,
      to,
      status,
      department,
      study_year,
      userId,
      page = 1,
      limit = 50,
      sortBy = "-readingDate",
    } = req.query;

    const filter = {};
    
    // Date range filter
    if (from || to) {
      filter.readingDate = {};
      if (from) filter.readingDate.$gte = new Date(from);
      if (to) filter.readingDate.$lte = new Date(to);
    }

    // Status filter
    if (status) {
      filter.status = status;
    }

    // User filter
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      filter.createdBy = userId;
    }

    // Department/study_year filter requires joining with member data
    let userIdsToFilter = null;
    if (department || study_year) {
      const memberFilter = {};
      if (department) memberFilter.department = department;
      if (study_year) memberFilter.study_year = study_year;
      
      const members = await Member.find(memberFilter).select("_id").lean();
      const memberIds = members.map((m) => m._id);
      
      const users = await User.find({ member: { $in: memberIds } }).select("_id").lean();
      userIdsToFilter = users.map((u) => u._id);
      
      if (userIdsToFilter.length === 0) {
        return res.status(200).json({ data: [], total: 0, page: 1, limit: parseInt(limit), totalPages: 0 });
      }
      filter.createdBy = { $in: userIdsToFilter };
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const perPage = Math.max(1, Math.min(100, parseInt(limit, 10)));
    const skip = (pageNum - 1) * perPage;

    const [reports, total] = await Promise.all([
      DailyReport.find(filter)
        .populate({
          path: "createdBy",
          select: "first_name last_name username email member",
          populate: { path: "member", select: "department study_year" }
        })
        .populate("book", "title author totalPages")
        .sort(sortBy)
        .skip(skip)
        .limit(perPage)
        .lean(),
      DailyReport.countDocuments(filter)
    ]);

    // Add computed fields
    const enriched = reports.map((r) => ({
      ...r,
      pagesRead: calcPagesRead(r),
      memberDepartment: r.createdBy?.member?.department || null,
      memberStudyYear: r.createdBy?.member?.study_year || null,
    }));

    return res.status(200).json({
      data: enriched,
      total,
      page: pageNum,
      limit: perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/reporting/top-readers
 * Top readers with detailed stats
 * Query params: from, to, limit, department, study_year
 */
export const getTopReadersReport = async (req, res, next) => {
  try {
    const { from, to, limit = 20, department, study_year } = req.query;

    const matchStage = { status: "Approved" };
    if (from || to) {
      matchStage.readingDate = {};
      if (from) matchStage.readingDate.$gte = new Date(from);
      if (to) matchStage.readingDate.$lte = new Date(to);
    }

    const agg = await DailyReport.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$createdBy",
          reportsCount: { $sum: 1 },
          pagesRead: { $sum: { $max: [0, { $subtract: ["$pagesTo", "$pagesFrom"] }] } },
          minutesRead: { $sum: "$timeSpent" },
          avgRating: { $avg: "$rating" },
          readingDates: { $addToSet: "$readingDate" },
          approvedCount: { $sum: { $cond: [{ $eq: ["$status", "Approved"] }, 1, 0] } },
          booksRead: { $addToSet: "$book" },
        },
      },
      { $sort: { reportsCount: -1 } },
      { $limit: Math.min(parseInt(limit) || 20, 100) },
    ]);

    const userIds = agg.map((a) => a._id);
    const users = await User.find({ _id: { $in: userIds } })
      .select("first_name last_name username email profile_picture member")
      .populate({ path: "member", select: "department study_year Profile_picture" })
      .lean();

    const userMap = new Map(users.map((u) => [String(u._id), u]));

    let entries = agg.map((a) => {
      const user = userMap.get(String(a._id));
      if (!user) return null;

      const memberData = user.member || {};
      if (department && memberData.department !== department) return null;
      if (study_year && String(memberData.study_year) !== String(study_year)) return null;

      const streak = calcLongestStreak(a.readingDates || []);

      return {
        user: {
          _id: user._id,
          first_name: user.first_name,
          last_name: user.last_name,
          username: user.username,
          email: user.email,
          profile_picture: memberData.Profile_picture || user.profile_picture || "",
          department: memberData.department || null,
          study_year: memberData.study_year || null,
        },
        reportsCount: a.reportsCount,
        pagesRead: a.pagesRead,
        minutesRead: a.minutesRead,
        avgRating: Math.round((a.avgRating || 0) * 10) / 10,
        streak,
        booksCount: a.booksRead?.length || 0,
      };
    }).filter(Boolean);

    return res.status(200).json({ data: entries });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/reporting/weakest-participation
 * Members with lowest participation (least reports, skipped days)
 * Query params: from, to, limit, department, study_year
 */
export const getWeakestParticipation = async (req, res, next) => {
  try {
    const { from, to, limit = 20, department, study_year } = req.query;

    // Get all active members
    const memberFilter = { status: "Active", isArchived: false };
    if (department) memberFilter.department = department;
    if (study_year) memberFilter.study_year = study_year;

    const members = await Member.find(memberFilter)
      .select("_id first_name last_name department study_year Profile_picture")
      .lean();

    const memberIds = members.map((m) => m._id);
    const users = await User.find({ member: { $in: memberIds }, status: "Active" })
      .select("_id member")
      .lean();

    const userToMemberMap = new Map(users.map((u) => [String(u._id), String(u.member)]));
    const memberMap = new Map(members.map((m) => [String(m._id), m]));

    // Get report counts per user
    const matchStage = { createdBy: { $in: users.map((u) => u._id) } };
    if (from || to) {
      matchStage.readingDate = {};
      if (from) matchStage.readingDate.$gte = new Date(from);
      if (to) matchStage.readingDate.$lte = new Date(to);
    }

    const reportAgg = await DailyReport.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$createdBy",
          reportsCount: { $sum: 1 },
          readingDates: { $addToSet: "$readingDate" },
          lastReportDate: { $max: "$readingDate" },
        },
      },
    ]);

    const reportMap = new Map(reportAgg.map((r) => [String(r._id), r]));

    // Build result for all users, sorted by lowest participation
    const results = users.map((u) => {
      const memberId = userToMemberMap.get(String(u._id));
      const member = memberMap.get(memberId);
      const reportData = reportMap.get(String(u._id));

      const reportsCount = reportData?.reportsCount || 0;
      const lastReport = reportData?.lastReportDate || null;
      const streak = calcLongestStreak(reportData?.readingDates || []);

      // Days since last report
      const daysSinceLastReport = lastReport
        ? Math.floor((Date.now() - new Date(lastReport).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        user: { _id: u._id },
        member: member ? {
          _id: member._id,
          name: [member.first_name, member.last_name].filter(Boolean).join(" "),
          department: member.department || null,
          study_year: member.study_year || null,
          profile_picture: member.Profile_picture || "",
        } : null,
        reportsCount,
        lastReport,
        daysSinceLastReport,
        streak,
      };
    });

    // Sort by lowest report count, then by days since last report (descending)
    results.sort((a, b) => {
      if (a.reportsCount !== b.reportsCount) return a.reportsCount - b.reportsCount;
      return (b.daysSinceLastReport || Infinity) - (a.daysSinceLastReport || Infinity);
    });

    return res.status(200).json({ data: results.slice(0, parseInt(limit) || 20) });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/reporting/reading-health
 * Reading health indicators: inactive readers, skipped reports, declining streaks
 */
export const getReadingHealth = async (req, res, next) => {
  try {
    const { daysInactive = 7, department, study_year } = req.query;

    // Get active members
    const memberFilter = { status: "Active", isArchived: false };
    if (department) memberFilter.department = department;
    if (study_year) memberFilter.study_year = study_year;

    const members = await Member.find(memberFilter)
      .select("_id first_name last_name department study_year")
      .lean();

    const memberIds = members.map((m) => m._id);
    const users = await User.find({ member: { $in: memberIds }, status: "Active" })
      .select("_id member")
      .lean();

    const userIds = users.map((u) => u._id);
    const userToMemberMap = new Map(users.map((u) => [String(u._id), String(u.member)]));
    const memberMap = new Map(members.map((m) => [String(m._id), m]));

    const now = new Date();
    const inactiveSince = new Date(now);
    inactiveSince.setDate(inactiveSince.getDate() - parseInt(daysInactive));

    // Get last report date per user
    const lastReportAgg = await DailyReport.aggregate([
      { $match: { createdBy: { $in: userIds } } },
      {
        $group: {
          _id: "$createdBy",
          lastReport: { $max: "$readingDate" },
          totalReports: { $sum: 1 },
          readingDates: { $addToSet: "$readingDate" },
        },
      },
    ]);

    const reportMap = new Map(lastReportAgg.map((r) => [String(r._id), r]));

    // Categorize users
    const inactiveReaders = [];
    const noReports = [];
    const lowStreak = [];

    users.forEach((u) => {
      const data = reportMap.get(String(u._id));
      const memberId = userToMemberMap.get(String(u._id));
      const member = memberMap.get(memberId);

      const memberInfo = member ? {
        _id: member._id,
        name: [member.first_name, member.last_name].filter(Boolean).join(" "),
        department: member.department || null,
        study_year: member.study_year || null,
      } : null;

      if (!data || data.totalReports === 0) {
        noReports.push({ user: { _id: u._id }, member: memberInfo, totalReports: 0 });
        return;
      }

      const lastReport = new Date(data.lastReport);
      const daysSinceReport = Math.floor((now - lastReport) / (1000 * 60 * 60 * 24));
      const streak = calcLongestStreak(data.readingDates || []);

      if (daysSinceReport >= parseInt(daysInactive)) {
        inactiveReaders.push({
          user: { _id: u._id },
          member: memberInfo,
          lastReport: data.lastReport,
          daysSinceReport,
          totalReports: data.totalReports,
        });
      }

      if (streak <= 2 && data.totalReports >= 3) {
        lowStreak.push({
          user: { _id: u._id },
          member: memberInfo,
          streak,
          totalReports: data.totalReports,
          lastReport: data.lastReport,
        });
      }
    });

    // Get overdue issues with inactive overlap
    const overdueIssues = await Issue.find({ status: "Overdue" })
      .populate("member", "first_name last_name department study_year")
      .populate("book", "title author")
      .lean();

    const overdueInactive = overdueIssues.filter((issue) => {
      const member = issue.member;
      if (!member) return false;
      
      // Check if this member has inactive reading
      const user = users.find((u) => String(userToMemberMap.get(String(u._id))) === String(member._id));
      if (!user) return false;
      
      const data = reportMap.get(String(user._id));
      if (!data) return true; // No reports = inactive
      
      const lastReport = new Date(data.lastReport);
      const daysSinceReport = Math.floor((now - lastReport) / (1000 * 60 * 60 * 24));
      return daysSinceReport >= parseInt(daysInactive);
    });

    return res.status(200).json({
      data: {
        inactiveReaders: inactiveReaders.slice(0, 50),
        noReports: noReports.slice(0, 50),
        lowStreak: lowStreak.slice(0, 50),
        overdueInactive: overdueInactive.slice(0, 30),
      },
      summary: {
        totalInactive: inactiveReaders.length,
        totalNoReports: noReports.length,
        totalLowStreak: lowStreak.length,
        totalOverdueInactive: overdueInactive.length,
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/reporting/monthly-comparison
 * Compare current month vs previous month stats
 */
export const getMonthlyComparison = async (req, res, next) => {
  try {
    const { department, study_year } = req.query;
    const now = new Date();
    const currentMonth = now.getUTCMonth();
    const currentYear = now.getUTCFullYear();

    const { start: curStart, end: curEnd } = getMonthBounds(currentYear, currentMonth);
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const { start: prevStart, end: prevEnd } = getMonthBounds(prevYear, prevMonth);

    // Filter by department/study_year if provided
    let userIdsFilter = null;
    if (department || study_year) {
      const memberFilter = {};
      if (department) memberFilter.department = department;
      if (study_year) memberFilter.study_year = study_year;

      const members = await Member.find(memberFilter).select("_id").lean();
      const users = await User.find({ member: { $in: members.map((m) => m._id) } }).select("_id").lean();
      userIdsFilter = users.map((u) => u._id);
    }

    const buildMatch = (start, end) => {
      const m = { readingDate: { $gte: start, $lte: end } };
      if (userIdsFilter) m.createdBy = { $in: userIdsFilter };
      return m;
    };

    const [currentStats, prevStats] = await Promise.all([
      DailyReport.aggregate([
        { $match: buildMatch(curStart, curEnd) },
        {
          $group: {
            _id: null,
            totalReports: { $sum: 1 },
            approvedReports: { $sum: { $cond: [{ $eq: ["$status", "Approved"] }, 1, 0] } },
            pagesRead: { $sum: { $max: [0, { $subtract: ["$pagesTo", "$pagesFrom"] }] } },
            minutesRead: { $sum: "$timeSpent" },
            avgRating: { $avg: "$rating" },
            uniqueReaders: { $addToSet: "$createdBy" },
            uniqueBooks: { $addToSet: "$book" },
          },
        },
      ]),
      DailyReport.aggregate([
        { $match: buildMatch(prevStart, prevEnd) },
        {
          $group: {
            _id: null,
            totalReports: { $sum: 1 },
            approvedReports: { $sum: { $cond: [{ $eq: ["$status", "Approved"] }, 1, 0] } },
            pagesRead: { $sum: { $max: [0, { $subtract: ["$pagesTo", "$pagesFrom"] }] } },
            minutesRead: { $sum: "$timeSpent" },
            avgRating: { $avg: "$rating" },
            uniqueReaders: { $addToSet: "$createdBy" },
            uniqueBooks: { $addToSet: "$book" },
          },
        },
      ]),
    ]);

    const cur = currentStats[0] || { totalReports: 0, approvedReports: 0, pagesRead: 0, minutesRead: 0, avgRating: 0, uniqueReaders: [], uniqueBooks: [] };
    const prev = prevStats[0] || { totalReports: 0, approvedReports: 0, pagesRead: 0, minutesRead: 0, avgRating: 0, uniqueReaders: [], uniqueBooks: [] };

    const calcChange = (curr, prev) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    };

    return res.status(200).json({
      data: {
        currentMonth: {
          month: currentMonth + 1,
          year: currentYear,
          name: new Date(currentYear, currentMonth).toLocaleString("default", { month: "long" }),
          totalReports: cur.totalReports,
          approvedReports: cur.approvedReports,
          pagesRead: cur.pagesRead,
          minutesRead: cur.minutesRead,
          avgRating: Math.round((cur.avgRating || 0) * 10) / 10,
          uniqueReaders: cur.uniqueReaders?.length || 0,
          uniqueBooks: cur.uniqueBooks?.length || 0,
        },
        previousMonth: {
          month: prevMonth + 1,
          year: prevYear,
          name: new Date(prevYear, prevMonth).toLocaleString("default", { month: "long" }),
          totalReports: prev.totalReports,
          approvedReports: prev.approvedReports,
          pagesRead: prev.pagesRead,
          minutesRead: prev.minutesRead,
          avgRating: Math.round((prev.avgRating || 0) * 10) / 10,
          uniqueReaders: prev.uniqueReaders?.length || 0,
          uniqueBooks: prev.uniqueBooks?.length || 0,
        },
        changes: {
          reportsChange: calcChange(cur.totalReports, prev.totalReports),
          pagesChange: calcChange(cur.pagesRead, prev.pagesRead),
          minutesChange: calcChange(cur.minutesRead, prev.minutesRead),
          readersChange: calcChange(cur.uniqueReaders?.length || 0, prev.uniqueReaders?.length || 0),
        },
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/reporting/department-comparison
 * Compare reading stats across departments
 */
export const getDepartmentComparison = async (req, res, next) => {
  try {
    const { from, to } = req.query;

    // Get all departments
    const departments = await Member.distinct("department", { department: { $ne: "" } });

    const matchStage = {};
    if (from || to) {
      matchStage.readingDate = {};
      if (from) matchStage.readingDate.$gte = new Date(from);
      if (to) matchStage.readingDate.$lte = new Date(to);
    }

    const results = await Promise.all(
      departments.map(async (dept) => {
        const members = await Member.find({ department: dept }).select("_id").lean();
        const users = await User.find({ member: { $in: members.map((m) => m._id) } }).select("_id").lean();
        const userIds = users.map((u) => u._id);

        if (userIds.length === 0) {
          return { department: dept, totalMembers: members.length, activeReaders: 0, totalReports: 0, pagesRead: 0, minutesRead: 0, avgRating: 0 };
        }

        const match = { ...matchStage, createdBy: { $in: userIds } };
        const agg = await DailyReport.aggregate([
          { $match: match },
          {
            $group: {
              _id: null,
              totalReports: { $sum: 1 },
              pagesRead: { $sum: { $max: [0, { $subtract: ["$pagesTo", "$pagesFrom"] }] } },
              minutesRead: { $sum: "$timeSpent" },
              avgRating: { $avg: "$rating" },
              activeReaders: { $addToSet: "$createdBy" },
            },
          },
        ]);

        const stats = agg[0] || { totalReports: 0, pagesRead: 0, minutesRead: 0, avgRating: 0, activeReaders: [] };

        return {
          department: dept,
          totalMembers: members.length,
          activeReaders: stats.activeReaders?.length || 0,
          totalReports: stats.totalReports,
          pagesRead: stats.pagesRead,
          minutesRead: stats.minutesRead,
          avgRating: Math.round((stats.avgRating || 0) * 10) / 10,
          avgReportsPerMember: members.length > 0 ? Math.round((stats.totalReports / members.length) * 10) / 10 : 0,
        };
      })
    );

    // Sort by total reports descending
    results.sort((a, b) => b.totalReports - a.totalReports);

    return res.status(200).json({ data: results });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/reporting/report-quality
 * Report quality summary: average rating, time spent, summary length
 */
export const getReportQuality = async (req, res, next) => {
  try {
    const { from, to, department, study_year } = req.query;

    const matchStage = { status: "Approved" };
    if (from || to) {
      matchStage.readingDate = {};
      if (from) matchStage.readingDate.$gte = new Date(from);
      if (to) matchStage.readingDate.$lte = new Date(to);
    }

    // Filter by department/study_year
    if (department || study_year) {
      const memberFilter = {};
      if (department) memberFilter.department = department;
      if (study_year) memberFilter.study_year = study_year;

      const members = await Member.find(memberFilter).select("_id").lean();
      const users = await User.find({ member: { $in: members.map((m) => m._id) } }).select("_id").lean();
      matchStage.createdBy = { $in: users.map((u) => u._id) };
    }

    const agg = await DailyReport.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalReports: { $sum: 1 },
          avgRating: { $avg: "$rating" },
          avgTimeSpent: { $avg: "$timeSpent" },
          avgPagesRead: { $avg: { $subtract: ["$pagesTo", "$pagesFrom"] } },
          ratingDistribution: {
            $push: "$rating",
          },
        },
      },
    ]);

    const stats = agg[0] || { totalReports: 0, avgRating: 0, avgTimeSpent: 0, avgPagesRead: 0, ratingDistribution: [] };

    // Calculate rating distribution
    const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    (stats.ratingDistribution || []).forEach((r) => {
      const rounded = Math.round(r);
      if (rounded >= 1 && rounded <= 5) ratingCounts[rounded]++;
    });

    return res.status(200).json({
      data: {
        totalApprovedReports: stats.totalReports,
        avgRating: Math.round((stats.avgRating || 0) * 100) / 100,
        avgTimeSpent: Math.round((stats.avgTimeSpent || 0) * 10) / 10,
        avgPagesRead: Math.round((stats.avgPagesRead || 0) * 10) / 10,
        ratingDistribution: ratingCounts,
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/reporting/export/csv
 * Export reports as CSV
 * Query params: from, to, status, department, study_year, type (reports|leaderboard|health)
 */
export const exportReportsCSV = async (req, res, next) => {
  try {
    const { from, to, status, department, study_year, type = "reports" } = req.query;

    let csvContent = "";
    let filename = "";

    if (type === "reports") {
      const filter = {};
      if (from || to) {
        filter.readingDate = {};
        if (from) filter.readingDate.$gte = new Date(from);
        if (to) filter.readingDate.$lte = new Date(to);
      }
      if (status) filter.status = status;

      // Filter by department/study_year
      if (department || study_year) {
        const memberFilter = {};
        if (department) memberFilter.department = department;
        if (study_year) memberFilter.study_year = study_year;

        const members = await Member.find(memberFilter).select("_id").lean();
        const users = await User.find({ member: { $in: members.map((m) => m._id) } }).select("_id").lean();
        filter.createdBy = { $in: users.map((u) => u._id) };
      }

      const reports = await DailyReport.find(filter)
        .populate({
          path: "createdBy",
          select: "first_name last_name email member",
          populate: { path: "member", select: "department study_year" }
        })
        .populate("book", "title author")
        .sort("-readingDate")
        .limit(5000)
        .lean();

      csvContent = "Date,User,Email,Book,Pages From,Pages To,Pages Read,Time Spent (min),Rating,Status,Department,Study Year\n";
      reports.forEach((r) => {
        const userName = [r.createdBy?.first_name, r.createdBy?.last_name].filter(Boolean).join(" ");
        const bookTitle = r.book?.title || "";
        const dept = r.createdBy?.member?.department || "";
        const year = r.createdBy?.member?.study_year || "";
        const pagesRead = Math.max(0, (r.pagesTo || 0) - (r.pagesFrom || 0));
        csvContent += `"${new Date(r.readingDate).toISOString().slice(0, 10)}","${userName}","${r.createdBy?.email || ""}","${bookTitle}",${r.pagesFrom},${r.pagesTo},${pagesRead},${r.timeSpent},${r.rating},"${r.status}","${dept}","${year}"\n`;
      });

      filename = `daily-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    } else if (type === "leaderboard") {
      const matchStage = { status: "Approved" };
      if (from || to) {
        matchStage.readingDate = {};
        if (from) matchStage.readingDate.$gte = new Date(from);
        if (to) matchStage.readingDate.$lte = new Date(to);
      }

      const agg = await DailyReport.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: "$createdBy",
            reportsCount: { $sum: 1 },
            pagesRead: { $sum: { $max: [0, { $subtract: ["$pagesTo", "$pagesFrom"] }] } },
            minutesRead: { $sum: "$timeSpent" },
            avgRating: { $avg: "$rating" },
          },
        },
        { $sort: { reportsCount: -1 } },
        { $limit: 200 },
      ]);

      const userIds = agg.map((a) => a._id);
      const users = await User.find({ _id: { $in: userIds } })
        .select("first_name last_name email member")
        .populate({ path: "member", select: "department study_year" })
        .lean();

      const userMap = new Map(users.map((u) => [String(u._id), u]));

      csvContent = "Rank,User,Email,Reports,Pages Read,Minutes Read,Avg Rating,Department,Study Year\n";
      agg.forEach((a, idx) => {
        const user = userMap.get(String(a._id));
        if (!user) return;
        const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
        const dept = user.member?.department || "";
        const year = user.member?.study_year || "";
        csvContent += `${idx + 1},"${name}","${user.email || ""}",${a.reportsCount},${a.pagesRead},${a.minutesRead},${Math.round((a.avgRating || 0) * 10) / 10},"${dept}","${year}"\n`;
      });

      filename = `leaderboard-${new Date().toISOString().slice(0, 10)}.csv`;
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(csvContent);
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/reporting/summary
 * Comprehensive summary for scheduled reports
 */
export const getReportingSummary = async (req, res, next) => {
  try {
    const { period = "weekly" } = req.query; // weekly or monthly

    const now = new Date();
    let fromDate;
    
    if (period === "monthly") {
      fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      fromDate = new Date(now);
      fromDate.setDate(now.getDate() - 7);
    }

    const matchStage = { readingDate: { $gte: fromDate, $lte: now } };

    const [reportStats, statusBreakdown, topReaders, activeMembers] = await Promise.all([
      DailyReport.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: null,
            totalReports: { $sum: 1 },
            approvedReports: { $sum: { $cond: [{ $eq: ["$status", "Approved"] }, 1, 0] } },
            pendingReports: { $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] } },
            pagesRead: { $sum: { $max: [0, { $subtract: ["$pagesTo", "$pagesFrom"] }] } },
            minutesRead: { $sum: "$timeSpent" },
            avgRating: { $avg: "$rating" },
            uniqueReaders: { $addToSet: "$createdBy" },
          },
        },
      ]),
      DailyReport.aggregate([
        { $match: matchStage },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      DailyReport.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: "$createdBy",
            reportsCount: { $sum: 1 },
            pagesRead: { $sum: { $max: [0, { $subtract: ["$pagesTo", "$pagesFrom"] }] } },
          },
        },
        { $sort: { reportsCount: -1 } },
        { $limit: 5 },
      ]),
      Member.countDocuments({ status: "Active", isArchived: false }),
    ]);

    const stats = reportStats[0] || { totalReports: 0, approvedReports: 0, pendingReports: 0, pagesRead: 0, minutesRead: 0, avgRating: 0, uniqueReaders: [] };

    // Enrich top readers
    const topReaderIds = topReaders.map((t) => t._id);
    const topUsers = await User.find({ _id: { $in: topReaderIds } })
      .select("first_name last_name")
      .lean();
    const userMap = new Map(topUsers.map((u) => [String(u._id), u]));

    const enrichedTopReaders = topReaders.map((t) => {
      const user = userMap.get(String(t._id));
      return {
        name: user ? [user.first_name, user.last_name].filter(Boolean).join(" ") : "Unknown",
        reportsCount: t.reportsCount,
        pagesRead: t.pagesRead,
      };
    });

    return res.status(200).json({
      data: {
        period,
        dateRange: { from: fromDate.toISOString(), to: now.toISOString() },
        overview: {
          totalReports: stats.totalReports,
          approvedReports: stats.approvedReports,
          pendingReports: stats.pendingReports,
          pagesRead: stats.pagesRead,
          minutesRead: stats.minutesRead,
          avgRating: Math.round((stats.avgRating || 0) * 10) / 10,
          activeReaders: stats.uniqueReaders?.length || 0,
          totalActiveMembers: activeMembers,
          participationRate: activeMembers > 0 ? Math.round(((stats.uniqueReaders?.length || 0) / activeMembers) * 100) : 0,
        },
        statusBreakdown: statusBreakdown.reduce((acc, s) => {
          acc[s._id] = s.count;
          return acc;
        }, {}),
        topReaders: enrichedTopReaders,
      },
    });
  } catch (err) {
    return next(err);
  }
};
