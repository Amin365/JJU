/**
 * Phase 5 - Admin Reporting Center Controller
 * Provides analytics and reporting endpoints for admin users.
 */

import DailyReport from "../models/DailyReport.js";
import { Op } from "sequelize";
import Member from "../models/Members.js";
import User from "../models/user.js";
import Issue from "../models/Issue.js";
import Book from "../models/Books.js";
import Role from "../models/Role.js";
import ModeratorMember from "../models/ModeratorMember.js";
import { calcLongestStreak, calcPagesRead } from "../utility/streakUtils.js";

const getRoleName = (user) =>
  String(user?.roleInfo?.role || user?.role?.role || user?.role?.plural || user?.role || "").toLowerCase();
const isSuperAdminUser = (user) => /super\s*admin/i.test(getRoleName(user));
const isModeratorUser = (user) => /moderator/i.test(getRoleName(user));

const intersectIds = (left = [], right = []) => {
  const rightSet = new Set(right.map((id) => Number(id)));
  return left.filter((id) => rightSet.has(Number(id)));
};

const toPlain = (row) => (row?.toJSON ? row.toJSON() : row);

const parseDateFilter = (from, to) => {
  if (!from && !to) return null;
  const readingDate = {};
  if (from) readingDate[Op.gte] = new Date(from);
  if (to) readingDate[Op.lte] = new Date(to);
  return readingDate;
};

const parseSort = (sortBy = "-readingDate") => {
  const raw = String(sortBy || "-readingDate").trim();
  const desc = raw.startsWith("-");
  const field = raw.replace(/^-/, "");
  const allowed = new Set(["readingDate", "status", "rating", "timeSpent", "createdAt", "updatedAt"]);
  const safeField = allowed.has(field) ? field : "readingDate";
  return [[safeField, desc ? "DESC" : "ASC"]];
};

const getMemberFilters = (department, study_year, extra = {}) => {
  const where = { ...extra };
  if (department) where.department = department;
  if (study_year) where.study_year = study_year;
  return where;
};

const aggregateReports = (reports = []) => {
  const grouped = new Map();

  for (const row of reports) {
    const report = toPlain(row);
    const userId = Number(report.created_by);
    if (!Number.isFinite(userId)) continue;

    const pagesRead = Math.max(0, (report.pagesTo || 0) - (report.pagesFrom || 0));
    if (!grouped.has(userId)) {
      grouped.set(userId, {
        userId,
        reportsCount: 0,
        pagesRead: 0,
        minutesRead: 0,
        totalRating: 0,
        ratingCount: 0,
        readingDates: new Set(),
        booksRead: new Set(),
        approvedCount: 0,
        lastReportDate: null,
      });
    }

    const item = grouped.get(userId);
    item.reportsCount += 1;
    item.pagesRead += pagesRead;
    item.minutesRead += Number(report.timeSpent || 0);
    if (report.rating !== null && report.rating !== undefined) {
      item.totalRating += Number(report.rating);
      item.ratingCount += 1;
    }
    if (report.readingDate) item.readingDates.add(new Date(report.readingDate).toISOString());
    if (report.book_id) item.booksRead.add(Number(report.book_id));
    if (report.status === "Approved") item.approvedCount += 1;

    const date = report.readingDate ? new Date(report.readingDate) : null;
    if (date && (!item.lastReportDate || date > new Date(item.lastReportDate))) {
      item.lastReportDate = date.toISOString();
    }
  }

  return grouped;
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

    const currentUser = await User.findByPk(req.user?.id, {
      include: [{ model: Role, as: "roleInfo", attributes: ["id", "role", "plural"] }],
    });

    if (!currentUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const where = {};

    if (isModeratorUser(currentUser) && !isSuperAdminUser(currentUser)) {
      const assignments = await ModeratorMember.findAll({
        where: { moderator_id: currentUser.id },
        attributes: ["member_id"],
        raw: true,
      });
      const memberIds = assignments.map((item) => item.member_id).filter(Boolean);
      if (!memberIds.length) {
        return res.status(200).json({ data: [], total: 0, page: 1, limit: parseInt(limit, 10), totalPages: 0 });
      }

      const scopedUsers = await User.findAll({
        where: { member_id_fk: { [Op.in]: memberIds } },
        attributes: ["id"],
        raw: true,
      });
      const scopedUserIds = scopedUsers.map((u) => u.id);
      if (!scopedUserIds.length) {
        return res.status(200).json({ data: [], total: 0, page: 1, limit: parseInt(limit, 10), totalPages: 0 });
      }
      where.created_by = { [Op.in]: scopedUserIds };
    } else if (!isSuperAdminUser(currentUser)) {
      where.created_by = currentUser.id;
    }

    const readingDate = parseDateFilter(from, to);
    if (readingDate) where.readingDate = readingDate;
    if (status) where.status = status;

    if (userId && Number.isInteger(Number(userId))) {
      const parsedUserId = Number(userId);
      if (where.created_by?.[Op.in] && !where.created_by[Op.in].some((id) => Number(id) === parsedUserId)) {
        return res.status(200).json({ data: [], total: 0, page: 1, limit: parseInt(limit, 10), totalPages: 0 });
      }
      where.created_by = parsedUserId;
    }

    if (department || study_year) {
      const members = await Member.findAll({
        where: getMemberFilters(department, study_year),
        attributes: ["id"],
        raw: true,
      });
      const memberIds = members.map((m) => m.id);

      const users = memberIds.length
        ? await User.findAll({
            where: { member_id_fk: { [Op.in]: memberIds } },
            attributes: ["id"],
            raw: true,
          })
        : [];
      let userIdsToFilter = users.map((u) => u.id);

      if (where.created_by?.[Op.in]) {
        userIdsToFilter = intersectIds(userIdsToFilter, where.created_by[Op.in]);
      } else if (where.created_by && Number.isInteger(Number(where.created_by))) {
        userIdsToFilter = userIdsToFilter.filter((id) => Number(id) === Number(where.created_by));
      }

      if (!userIdsToFilter.length) {
        return res.status(200).json({ data: [], total: 0, page: 1, limit: parseInt(limit, 10), totalPages: 0 });
      }
      where.created_by = { [Op.in]: userIdsToFilter };
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const perPage = Math.max(1, Math.min(100, parseInt(limit, 10)));

    const { rows, count } = await DailyReport.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "createdBy",
          attributes: ["id", "first_name", "last_name", "username", "email", "member_id_fk"],
          include: [{ model: Member, as: "member", attributes: ["id", "department", "study_year"] }],
        },
        { model: Book, as: "book", attributes: ["id", "title", "author", "totalPages"] },
      ],
      order: parseSort(sortBy),
      offset: (pageNum - 1) * perPage,
      limit: perPage,
    });

    const enriched = rows.map((row) => {
      const r = toPlain(row);
      return {
        ...r,
        pagesRead: calcPagesRead(r),
        memberDepartment: r.createdBy?.member?.department || null,
        memberStudyYear: r.createdBy?.member?.study_year || null,
      };
    });

    return res.status(200).json({
      data: enriched,
      total: count,
      page: pageNum,
      limit: perPage,
      totalPages: Math.ceil(count / perPage),
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

    const where = { status: "Approved" };
    const readingDate = parseDateFilter(from, to);
    if (readingDate) where.readingDate = readingDate;

    const reports = await DailyReport.findAll({ where });
    const grouped = aggregateReports(reports);

    const userIds = Array.from(grouped.keys());
    if (!userIds.length) return res.status(200).json({ data: [] });

    const users = await User.findAll({
      where: { id: { [Op.in]: userIds } },
      attributes: ["id", "first_name", "last_name", "username", "email", "profile_picture"],
      include: [{ model: Member, as: "member", attributes: ["department", "study_year", "Profile_picture"] }],
    });
    const userMap = new Map(users.map((u) => [Number(u.id), toPlain(u)]));

    const entries = Array.from(grouped.values())
      .map((a) => {
        const user = userMap.get(Number(a.userId));
        if (!user) return null;

        const memberData = user.member || {};
        if (department && memberData.department !== department) return null;
        if (study_year && String(memberData.study_year) !== String(study_year)) return null;

        const streak = calcLongestStreak(Array.from(a.readingDates));
        const avgRating = a.ratingCount > 0 ? a.totalRating / a.ratingCount : 0;

        return {
          user: {
            _id: user.id,
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
          avgRating: Math.round((avgRating || 0) * 10) / 10,
          streak,
          booksCount: a.booksRead.size,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.reportsCount - a.reportsCount)
      .slice(0, Math.min(parseInt(limit, 10) || 20, 100));

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

    const members = await Member.findAll({
      where: getMemberFilters(department, study_year, { status: "Active", isArchived: false }),
      attributes: ["id", "first_name", "last_name", "department", "study_year", "Profile_picture"],
    });

    const memberIds = members.map((m) => m.id);
    const users = memberIds.length
      ? await User.findAll({
          where: { member_id_fk: { [Op.in]: memberIds }, status: "Active" },
          attributes: ["id", "member_id_fk"],
        })
      : [];

    const userIds = users.map((u) => u.id);
    const reportWhere = { created_by: { [Op.in]: userIds } };
    const readingDate = parseDateFilter(from, to);
    if (readingDate) reportWhere.readingDate = readingDate;

    const reports = userIds.length
      ? await DailyReport.findAll({ where: reportWhere, attributes: ["created_by", "readingDate"] })
      : [];
    const grouped = aggregateReports(reports);

    const userToMemberMap = new Map(users.map((u) => [Number(u.id), Number(u.member_id_fk)]));
    const memberMap = new Map(members.map((m) => [Number(m.id), toPlain(m)]));

    const results = users.map((u) => {
      const reportData = grouped.get(Number(u.id));
      const member = memberMap.get(userToMemberMap.get(Number(u.id)));

      const reportsCount = reportData?.reportsCount || 0;
      const lastReport = reportData?.lastReportDate || null;
      const streak = calcLongestStreak(reportData ? Array.from(reportData.readingDates) : []);

      const daysSinceLastReport = lastReport
        ? Math.floor((Date.now() - new Date(lastReport).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        user: { _id: u.id },
        member: member
          ? {
              _id: member.id,
              name: [member.first_name, member.last_name].filter(Boolean).join(" "),
              department: member.department || null,
              study_year: member.study_year || null,
              profile_picture: member.Profile_picture || "",
            }
          : null,
        reportsCount,
        lastReport,
        daysSinceLastReport,
        streak,
      };
    });

    results.sort((a, b) => {
      if (a.reportsCount !== b.reportsCount) return a.reportsCount - b.reportsCount;
      return (b.daysSinceLastReport ?? Infinity) - (a.daysSinceLastReport ?? Infinity);
    });

    return res.status(200).json({ data: results.slice(0, parseInt(limit, 10) || 20) });
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

    const members = await Member.findAll({
      where: getMemberFilters(department, study_year, { status: "Active", isArchived: false }),
      attributes: ["id", "first_name", "last_name", "department", "study_year"],
    });

    const memberIds = members.map((m) => m.id);
    const users = memberIds.length
      ? await User.findAll({
          where: { member_id_fk: { [Op.in]: memberIds }, status: "Active" },
          attributes: ["id", "member_id_fk"],
        })
      : [];

    const userIds = users.map((u) => u.id);
    const reports = userIds.length
      ? await DailyReport.findAll({ where: { created_by: { [Op.in]: userIds } }, attributes: ["created_by", "readingDate", "status", "pagesFrom", "pagesTo", "timeSpent", "rating", "book_id"] })
      : [];
    const grouped = aggregateReports(reports);

    const userToMemberMap = new Map(users.map((u) => [Number(u.id), Number(u.member_id_fk)]));
    const memberMap = new Map(members.map((m) => [Number(m.id), toPlain(m)]));

    const now = new Date();
    const threshold = parseInt(daysInactive, 10);

    const inactiveReaders = [];
    const noReports = [];
    const lowStreak = [];

    users.forEach((u) => {
      const data = grouped.get(Number(u.id));
      const member = memberMap.get(userToMemberMap.get(Number(u.id)));

      const memberInfo = member
        ? {
            _id: member.id,
            name: [member.first_name, member.last_name].filter(Boolean).join(" "),
            department: member.department || null,
            study_year: member.study_year || null,
          }
        : null;

      if (!data || data.reportsCount === 0) {
        noReports.push({ user: { _id: u.id }, member: memberInfo, totalReports: 0 });
        return;
      }

      const lastReport = new Date(data.lastReportDate);
      const daysSinceReport = Math.floor((now - lastReport) / (1000 * 60 * 60 * 24));
      const streak = calcLongestStreak(Array.from(data.readingDates));

      if (daysSinceReport >= threshold) {
        inactiveReaders.push({
          user: { _id: u.id },
          member: memberInfo,
          lastReport: data.lastReportDate,
          daysSinceReport,
          totalReports: data.reportsCount,
        });
      }

      if (streak <= 2 && data.reportsCount >= 3) {
        lowStreak.push({
          user: { _id: u.id },
          member: memberInfo,
          streak,
          totalReports: data.reportsCount,
          lastReport: data.lastReportDate,
        });
      }
    });

    const overdueIssues = await Issue.findAll({
      where: { status: "Overdue" },
      include: [
        { model: Member, as: "member", attributes: ["id", "first_name", "last_name", "department", "study_year"] },
        { model: Book, as: "book", attributes: ["id", "title", "author"] },
      ],
    });

    const overdueInactive = overdueIssues.filter((issue) => {
      const member = issue.member;
      if (!member) return false;

      const user = users.find((u) => Number(userToMemberMap.get(Number(u.id))) === Number(member.id));
      if (!user) return false;

      const data = grouped.get(Number(user.id));
      if (!data) return true;

      const lastReport = new Date(data.lastReportDate);
      const daysSinceReport = Math.floor((now - lastReport) / (1000 * 60 * 60 * 24));
      return daysSinceReport >= threshold;
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

    const curStart = new Date(Date.UTC(currentYear, currentMonth, 1, 0, 0, 0));
    const curEnd = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999));
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const prevStart = new Date(Date.UTC(prevYear, prevMonth, 1, 0, 0, 0));
    const prevEnd = new Date(Date.UTC(prevYear, prevMonth + 1, 0, 23, 59, 59, 999));

    let userIdsFilter = null;
    if (department || study_year) {
      const members = await Member.findAll({ where: getMemberFilters(department, study_year), attributes: ["id"], raw: true });
      const users = members.length
        ? await User.findAll({ where: { member_id_fk: { [Op.in]: members.map((m) => m.id) } }, attributes: ["id"], raw: true })
        : [];
      userIdsFilter = users.map((u) => u.id);
    }

    const buildWhere = (start, end) => {
      const where = { readingDate: { [Op.gte]: start, [Op.lte]: end } };
      if (userIdsFilter) where.created_by = { [Op.in]: userIdsFilter };
      return where;
    };

    const [currentReports, prevReports] = await Promise.all([
      DailyReport.findAll({ where: buildWhere(curStart, curEnd) }),
      DailyReport.findAll({ where: buildWhere(prevStart, prevEnd) }),
    ]);

    const summarize = (rows) => {
      const reports = rows.map(toPlain);
      const uniqueReaders = new Set();
      const uniqueBooks = new Set();
      let totalReports = 0;
      let approvedReports = 0;
      let pagesRead = 0;
      let minutesRead = 0;
      let ratingSum = 0;
      let ratingCount = 0;

      reports.forEach((r) => {
        totalReports += 1;
        if (r.status === "Approved") approvedReports += 1;
        pagesRead += Math.max(0, (r.pagesTo || 0) - (r.pagesFrom || 0));
        minutesRead += Number(r.timeSpent || 0);
        if (r.rating !== null && r.rating !== undefined) {
          ratingSum += Number(r.rating);
          ratingCount += 1;
        }
        if (r.created_by) uniqueReaders.add(Number(r.created_by));
        if (r.book_id) uniqueBooks.add(Number(r.book_id));
      });

      return {
        totalReports,
        approvedReports,
        pagesRead,
        minutesRead,
        avgRating: ratingCount ? ratingSum / ratingCount : 0,
        uniqueReaders,
        uniqueBooks,
      };
    };

    const cur = summarize(currentReports);
    const prev = summarize(prevReports);

    const calcChange = (curr, prevValue) => {
      if (prevValue === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prevValue) / prevValue) * 100);
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
          uniqueReaders: cur.uniqueReaders.size,
          uniqueBooks: cur.uniqueBooks.size,
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
          uniqueReaders: prev.uniqueReaders.size,
          uniqueBooks: prev.uniqueBooks.size,
        },
        changes: {
          reportsChange: calcChange(cur.totalReports, prev.totalReports),
          pagesChange: calcChange(cur.pagesRead, prev.pagesRead),
          minutesChange: calcChange(cur.minutesRead, prev.minutesRead),
          readersChange: calcChange(cur.uniqueReaders.size, prev.uniqueReaders.size),
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

    const departmentRows = await Member.findAll({
      where: { department: { [Op.ne]: "" } },
      attributes: ["department"],
      raw: true,
    });
    const departments = Array.from(new Set(departmentRows.map((r) => r.department).filter(Boolean)));

    const readingDate = parseDateFilter(from, to);

    const results = await Promise.all(
      departments.map(async (dept) => {
        const members = await Member.findAll({ where: { department: dept }, attributes: ["id"], raw: true });
        const users = members.length
          ? await User.findAll({ where: { member_id_fk: { [Op.in]: members.map((m) => m.id) } }, attributes: ["id"], raw: true })
          : [];
        const userIds = users.map((u) => u.id);

        if (!userIds.length) {
          return { department: dept, totalMembers: members.length, activeReaders: 0, totalReports: 0, pagesRead: 0, minutesRead: 0, avgRating: 0 };
        }

        const where = { created_by: { [Op.in]: userIds } };
        if (readingDate) where.readingDate = readingDate;

        const reports = await DailyReport.findAll({ where, attributes: ["created_by", "pagesFrom", "pagesTo", "timeSpent", "rating"] });

        const activeReaders = new Set();
        let totalReports = 0;
        let pagesRead = 0;
        let minutesRead = 0;
        let ratingSum = 0;
        let ratingCount = 0;

        reports.forEach((r) => {
          const row = toPlain(r);
          totalReports += 1;
          pagesRead += Math.max(0, (row.pagesTo || 0) - (row.pagesFrom || 0));
          minutesRead += Number(row.timeSpent || 0);
          if (row.rating !== null && row.rating !== undefined) {
            ratingSum += Number(row.rating);
            ratingCount += 1;
          }
          if (row.created_by) activeReaders.add(Number(row.created_by));
        });

        const avgRating = ratingCount ? ratingSum / ratingCount : 0;

        return {
          department: dept,
          totalMembers: members.length,
          activeReaders: activeReaders.size,
          totalReports,
          pagesRead,
          minutesRead,
          avgRating: Math.round((avgRating || 0) * 10) / 10,
          avgReportsPerMember: members.length > 0 ? Math.round((totalReports / members.length) * 10) / 10 : 0,
        };
      })
    );

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

    const where = { status: "Approved" };
    const readingDate = parseDateFilter(from, to);
    if (readingDate) where.readingDate = readingDate;

    if (department || study_year) {
      const members = await Member.findAll({ where: getMemberFilters(department, study_year), attributes: ["id"], raw: true });
      const users = members.length
        ? await User.findAll({ where: { member_id_fk: { [Op.in]: members.map((m) => m.id) } }, attributes: ["id"], raw: true })
        : [];
      where.created_by = { [Op.in]: users.map((u) => u.id) };
    }

    const reports = await DailyReport.findAll({ where, attributes: ["rating", "timeSpent", "pagesFrom", "pagesTo"] });

    let totalReports = 0;
    let ratingSum = 0;
    let timeSum = 0;
    let pagesSum = 0;
    const ratingDistribution = [];

    reports.forEach((r) => {
      const row = toPlain(r);
      totalReports += 1;
      const rating = Number(row.rating || 0);
      ratingSum += rating;
      timeSum += Number(row.timeSpent || 0);
      pagesSum += Number(row.pagesTo || 0) - Number(row.pagesFrom || 0);
      ratingDistribution.push(rating);
    });

    const avgRating = totalReports ? ratingSum / totalReports : 0;
    const avgTimeSpent = totalReports ? timeSum / totalReports : 0;
    const avgPagesRead = totalReports ? pagesSum / totalReports : 0;

    const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratingDistribution.forEach((r) => {
      const rounded = Math.round(r);
      if (rounded >= 1 && rounded <= 5) ratingCounts[rounded] += 1;
    });

    return res.status(200).json({
      data: {
        totalApprovedReports: totalReports,
        avgRating: Math.round((avgRating || 0) * 100) / 100,
        avgTimeSpent: Math.round((avgTimeSpent || 0) * 10) / 10,
        avgPagesRead: Math.round((avgPagesRead || 0) * 10) / 10,
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
      const where = {};
      const readingDate = parseDateFilter(from, to);
      if (readingDate) where.readingDate = readingDate;
      if (status) where.status = status;

      if (department || study_year) {
        const members = await Member.findAll({ where: getMemberFilters(department, study_year), attributes: ["id"], raw: true });
        const users = members.length
          ? await User.findAll({ where: { member_id_fk: { [Op.in]: members.map((m) => m.id) } }, attributes: ["id"], raw: true })
          : [];
        where.created_by = { [Op.in]: users.map((u) => u.id) };
      }

      const reports = await DailyReport.findAll({
        where,
        include: [
          {
            model: User,
            as: "createdBy",
            attributes: ["id", "first_name", "last_name", "email"],
            include: [{ model: Member, as: "member", attributes: ["department", "study_year"] }],
          },
          { model: Book, as: "book", attributes: ["title", "author"] },
        ],
        order: [["readingDate", "DESC"]],
        limit: 5000,
      });

      csvContent = "Date,User,Email,Book,Pages From,Pages To,Pages Read,Time Spent (min),Rating,Status,Department,Study Year\n";
      reports.forEach((row) => {
        const r = toPlain(row);
        const userName = [r.createdBy?.first_name, r.createdBy?.last_name].filter(Boolean).join(" ");
        const bookTitle = r.book?.title || "";
        const dept = r.createdBy?.member?.department || "";
        const year = r.createdBy?.member?.study_year || "";
        const pagesRead = Math.max(0, (r.pagesTo || 0) - (r.pagesFrom || 0));
        csvContent += `"${new Date(r.readingDate).toISOString().slice(0, 10)}","${userName}","${r.createdBy?.email || ""}","${bookTitle}",${r.pagesFrom},${r.pagesTo},${pagesRead},${r.timeSpent},${r.rating},"${r.status}","${dept}","${year}"\n`;
      });

      filename = `daily-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    } else if (type === "leaderboard") {
      const where = { status: "Approved" };
      const readingDate = parseDateFilter(from, to);
      if (readingDate) where.readingDate = readingDate;

      const reports = await DailyReport.findAll({ where });
      const grouped = aggregateReports(reports);

      const top = Array.from(grouped.values())
        .sort((a, b) => b.reportsCount - a.reportsCount)
        .slice(0, 200);

      const userIds = top.map((t) => t.userId);
      const users = userIds.length
        ? await User.findAll({
            where: { id: { [Op.in]: userIds } },
            attributes: ["id", "first_name", "last_name", "email"],
            include: [{ model: Member, as: "member", attributes: ["department", "study_year"] }],
          })
        : [];

      const userMap = new Map(users.map((u) => [Number(u.id), toPlain(u)]));

      csvContent = "Rank,User,Email,Reports,Pages Read,Minutes Read,Avg Rating,Department,Study Year\n";
      top.forEach((a, idx) => {
        const user = userMap.get(Number(a.userId));
        if (!user) return;
        const name = [user.first_name, user.last_name].filter(Boolean).join(" ");
        const dept = user.member?.department || "";
        const year = user.member?.study_year || "";
        const avg = a.ratingCount ? a.totalRating / a.ratingCount : 0;
        csvContent += `${idx + 1},"${name}","${user.email || ""}",${a.reportsCount},${a.pagesRead},${a.minutesRead},${Math.round((avg || 0) * 10) / 10},"${dept}","${year}"\n`;
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
    const { period = "weekly" } = req.query;

    const now = new Date();
    const fromDate = period === "monthly" ? new Date(now.getFullYear(), now.getMonth(), 1) : new Date(now);
    if (period !== "monthly") fromDate.setDate(now.getDate() - 7);

    const where = { readingDate: { [Op.gte]: fromDate, [Op.lte]: now } };

    const [reports, activeMembers] = await Promise.all([
      DailyReport.findAll({ where, attributes: ["created_by", "status", "pagesFrom", "pagesTo", "timeSpent", "rating"] }),
      Member.count({ where: { status: "Active", isArchived: false } }),
    ]);

    const grouped = aggregateReports(reports);
    const reportRows = reports.map(toPlain);

    const totalReports = reportRows.length;
    const approvedReports = reportRows.filter((r) => r.status === "Approved").length;
    const pendingReports = reportRows.filter((r) => r.status === "Pending").length;
    const pagesRead = reportRows.reduce((sum, r) => sum + Math.max(0, (r.pagesTo || 0) - (r.pagesFrom || 0)), 0);
    const minutesRead = reportRows.reduce((sum, r) => sum + Number(r.timeSpent || 0), 0);
    const ratings = reportRows.map((r) => r.rating).filter((v) => v !== null && v !== undefined);
    const avgRating = ratings.length ? ratings.reduce((s, v) => s + Number(v), 0) / ratings.length : 0;
    const uniqueReaders = new Set(reportRows.map((r) => Number(r.created_by)).filter(Boolean));

    const statusBreakdown = reportRows.reduce((acc, row) => {
      const key = row.status || "Unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const topReaders = Array.from(grouped.values())
      .sort((a, b) => b.reportsCount - a.reportsCount)
      .slice(0, 5);

    const topReaderIds = topReaders.map((t) => t.userId);
    const topUsers = topReaderIds.length
      ? await User.findAll({ where: { id: { [Op.in]: topReaderIds } }, attributes: ["id", "first_name", "last_name"] })
      : [];
    const userMap = new Map(topUsers.map((u) => [Number(u.id), toPlain(u)]));

    const enrichedTopReaders = topReaders.map((t) => {
      const user = userMap.get(Number(t.userId));
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
          totalReports,
          approvedReports,
          pendingReports,
          pagesRead,
          minutesRead,
          avgRating: Math.round((avgRating || 0) * 10) / 10,
          activeReaders: uniqueReaders.size,
          totalActiveMembers: activeMembers,
          participationRate: activeMembers > 0 ? Math.round((uniqueReaders.size / activeMembers) * 100) : 0,
        },
        statusBreakdown,
        topReaders: enrichedTopReaders,
      },
    });
  } catch (err) {
    return next(err);
  }
};
