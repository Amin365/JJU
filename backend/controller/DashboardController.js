import Book from "../models/Books.js";
import { Op } from "sequelize";
import Member from "../models/Members.js";
import Issue from "../models/Issue.js";
import DailyReport from "../models/DailyReport.js";
import BlogPost from "../models/BlogPost.js";
import Clubreq from "../models/Clubreq.js";
import User from "../models/user.js";

const hasAnyPermission = (req, perms = []) => {
  const userPerms = new Set((req.user?.permissions || []).map((p) => String(p).toLowerCase()));
  return perms.some((p) => userPerms.has(String(p).toLowerCase()));
};

const canViewDashboard = (req) => {
  const roleName = String(req.user?.role?.role || req.user?.role?.plural || req.user?.role || "").toLowerCase();
  if (/super\s*admin/i.test(roleName) || /moderator/i.test(roleName) || /admin/i.test(roleName)) {
    return true;
  }

  return hasAnyPermission(req, [
    "View Members",
    "Manage Members",
    "Manage Books",
    "Manage Issues",
    "View Users",
  ]);
};

/**
 * GET /api/dashboard/stats
 * Summary KPI counts for the dashboard home page.
 */
export const getDashboardStats = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });
    if (!canViewDashboard(req)) return res.status(403).json({ message: "Access denied" });

    const [
      totalBooks,
      availableBooks,
      borrowedBooks,
      totalMembers,
      activeMembers,
      overdueIssues,
      pendingJoinRequests,
      pendingDailyReports,
    ] = await Promise.all([
      Book.count(),
      Book.sum("availableCopies"),
      Issue.count({ where: { status: "Issued" } }),
      Member.count(),
      Member.count({ where: { status: "Active" } }),
      Issue.count({ where: { status: "Overdue" } }),
      Clubreq.count({ where: { status: "Pending" } }),
      DailyReport.count({ where: { status: "Pending" } }),
    ]);

    return res.json({
      totalBooks,
      availableBooks: availableBooks ?? 0,
      borrowedBooks,
      totalMembers,
      activeMembers,
      overdueIssues,
      pendingJoinRequests,
      pendingDailyReports,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/dashboard/activity
 * Combined feed of recent meaningful events across all collections.
 */
export const getRecentActivity = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });
    if (!canViewDashboard(req)) return res.status(403).json({ message: "Access denied" });

    const [
      recentMembers,
      recentBooks,
      recentIssuesRaw,
      recentReturnsRaw,
      recentJoinReqs,
      recentReportsRaw,
      recentBlogs,
    ] = await Promise.all([
      Member.findAll({
        order: [["createdAt", "DESC"]],
        limit: 5,
        attributes: ["id", "first_name", "last_name", "code", "createdAt"],
        raw: true,
      }),
      Book.findAll({
        order: [["createdAt", "DESC"]],
        limit: 5,
        attributes: ["id", "title", "author", "createdAt"],
        raw: true,
      }),
      Issue.findAll({
        where: { status: { [Op.in]: ["Issued", "Overdue"] } },
        order: [["createdAt", "DESC"]],
        limit: 5,
        attributes: ["id", "book_id", "member_id", "createdAt"],
        raw: true,
      }),
      Issue.findAll({
        where: { status: "Returned" },
        order: [["returnedAt", "DESC"]],
        limit: 5,
        attributes: ["id", "book_id", "member_id", "returnedAt", "updatedAt"],
        raw: true,
      }),
      Clubreq.findAll({
        order: [["createdAt", "DESC"]],
        limit: 5,
        attributes: ["id", "FullName", "email", "status", "createdAt"],
        raw: true,
      }),
      DailyReport.findAll({
        order: [["createdAt", "DESC"]],
        limit: 5,
        attributes: ["id", "created_by", "book_id", "createdAt"],
        raw: true,
      }),
      BlogPost.findAll({
        where: { status: "Published" },
        order: [["createdAt", "DESC"]],
        limit: 5,
        attributes: ["id", "title", "author_name", "status", "createdAt"],
        raw: true,
      }),
    ]);

    const issueBookIds = [
      ...new Set(
        [
          ...recentIssuesRaw.map((i) => i.book_id),
          ...recentReturnsRaw.map((i) => i.book_id),
          ...recentReportsRaw.map((r) => r.book_id),
        ].filter(Boolean)
      ),
    ];

    const issueMemberIds = [
      ...new Set(
        [...recentIssuesRaw.map((i) => i.member_id), ...recentReturnsRaw.map((i) => i.member_id)].filter(Boolean)
      ),
    ];

    const reportUserIds = [...new Set(recentReportsRaw.map((r) => r.created_by).filter(Boolean))];

    const [books, members, users] = await Promise.all([
      issueBookIds.length
        ? Book.findAll({
            where: { id: { [Op.in]: issueBookIds } },
            attributes: ["id", "title"],
            raw: true,
          })
        : [],
      issueMemberIds.length
        ? Member.findAll({
            where: { id: { [Op.in]: issueMemberIds } },
            attributes: ["id", "first_name", "last_name", "code"],
            raw: true,
          })
        : [],
      reportUserIds.length
        ? User.findAll({
            where: { id: { [Op.in]: reportUserIds } },
            attributes: ["id", "first_name", "last_name"],
            raw: true,
          })
        : [],
    ]);

    const booksById = new Map(books.map((b) => [b.id, b]));
    const membersById = new Map(members.map((m) => [m.id, m]));
    const usersById = new Map(users.map((u) => [u.id, u]));

    const events = [];

    recentMembers.forEach((m) =>
      events.push({
        type: "member_created",
        label: `New member: ${m.first_name} ${m.last_name}`,
        meta: { code: m.code },
        timestamp: m.createdAt,
      })
    );

    recentBooks.forEach((b) =>
      events.push({
        type: "book_created",
        label: `New book added: "${b.title}"`,
        meta: { author: b.author },
        timestamp: b.createdAt,
      })
    );

    recentIssuesRaw.forEach((i) =>
      events.push({
        type: "issue_created",
        label: `Book issued: "${booksById.get(i.book_id)?.title ?? "?"}" → ${
          membersById.get(i.member_id)
            ? `${membersById.get(i.member_id).first_name} ${membersById.get(i.member_id).last_name}`
            : "unknown member"
        }`,
        meta: {},
        timestamp: i.createdAt,
      })
    );

    recentReturnsRaw.forEach((i) =>
      events.push({
        type: "issue_returned",
        label: `Book returned: "${booksById.get(i.book_id)?.title ?? "?"}" by ${
          membersById.get(i.member_id)
            ? `${membersById.get(i.member_id).first_name} ${membersById.get(i.member_id).last_name}`
            : "unknown member"
        }`,
        meta: {},
        timestamp: i.returnedAt || i.updatedAt,
      })
    );

    recentJoinReqs.forEach((r) =>
      events.push({
        type: "join_request",
        label: `Join request from ${r.FullName}`,
        meta: { status: r.status, email: r.email },
        timestamp: r.createdAt,
      })
    );

    recentReportsRaw.forEach((r) =>
      events.push({
        type: "daily_report",
        label: `Daily report by ${
          usersById.get(r.created_by)
            ? `${usersById.get(r.created_by).first_name} ${usersById.get(r.created_by).last_name}`
            : "unknown"
        } on "${booksById.get(r.book_id)?.title ?? "?"}"`,
        meta: {},
        timestamp: r.createdAt,
      })
    );

    recentBlogs.forEach((b) =>
      events.push({
        type: "blog_published",
        label: `Blog published: "${b.title}"`,
        meta: { author: b.author_name },
        timestamp: b.createdAt,
      })
    );

    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return res.json(events.slice(0, 20));
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/dashboard/top-readers
 * Members ranked by daily report count.
 */
export const getTopReaders = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });
    if (!canViewDashboard(req)) return res.status(403).json({ message: "Access denied" });

    const reports = await DailyReport.findAll({
      attributes: ["created_by", "createdAt", "pagesFrom", "pagesTo"],
      raw: true,
    });

    const groupedMap = new Map();

    for (const report of reports) {
      const userId = report.created_by;
      if (!userId) continue;

      const existing = groupedMap.get(userId) || {
        userId,
        reportCount: 0,
        lastReport: null,
        totalPages: 0,
      };

      existing.reportCount += 1;
      const pages = Math.max(0, Number(report.pagesTo || 0) - Number(report.pagesFrom || 0));
      existing.totalPages += pages;

      if (!existing.lastReport || new Date(report.createdAt) > new Date(existing.lastReport)) {
        existing.lastReport = report.createdAt;
      }

      groupedMap.set(userId, existing);
    }

    const grouped = Array.from(groupedMap.values())
      .sort((a, b) => b.reportCount - a.reportCount)
      .slice(0, 10);

    const userIds = grouped.map((g) => g.userId);

    const users = userIds.length
      ? await User.findAll({
          where: { id: { [Op.in]: userIds } },
          attributes: ["id", "first_name", "last_name", "profile_picture", "member_id"],
          raw: true,
        })
      : [];

    const memberIds = users.map((u) => u.member_id).filter(Boolean);

    const members = memberIds.length
      ? await Member.findAll({
          where: { id: { [Op.in]: memberIds } },
          attributes: ["id", "first_name", "last_name", "code"],
          raw: true,
        })
      : [];

    const usersById = new Map(users.map((u) => [u.id, u]));
    const membersById = new Map(members.map((m) => [m.id, m]));

    const enriched = grouped.map((entry) => {
      const user = usersById.get(entry.userId);
      const member = user?.member_id ? membersById.get(user.member_id) : null;

      return {
        _id: entry.userId,
        reportCount: entry.reportCount,
        lastReport: entry.lastReport,
        totalPages: entry.totalPages,
        name: member
          ? `${member.first_name} ${member.last_name}`
          : user
          ? `${user.first_name} ${user.last_name}`
          : "Unknown",
        memberCode: member?.code ?? null,
        avatar: user?.profile_picture ?? null,
      };
    });

    return res.json(enriched);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/dashboard/popular-books
 * Books ranked by total number of issues.
 */
export const getPopularBooks = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });
    if (!canViewDashboard(req)) return res.status(403).json({ message: "Access denied" });

    const issues = await Issue.findAll({ attributes: ["book_id"], raw: true });

    const countMap = new Map();
    for (const issue of issues) {
      if (!issue.book_id) continue;
      countMap.set(issue.book_id, (countMap.get(issue.book_id) || 0) + 1);
    }

    const grouped = Array.from(countMap.entries())
      .map(([bookId, issueCount]) => ({ bookId, issueCount }))
      .sort((a, b) => b.issueCount - a.issueCount)
      .slice(0, 10);

    const bookIds = grouped.map((g) => g.bookId);

    const books = bookIds.length
      ? await Book.findAll({
          where: { id: { [Op.in]: bookIds } },
          attributes: ["id", "title", "author", "availableCopies", "totalCopies", "book_picture"],
          raw: true,
        })
      : [];

    const booksById = new Map(books.map((b) => [b.id, b]));

    const enriched = grouped.map((entry) => {
      const book = booksById.get(entry.bookId);

      return {
        _id: entry.bookId,
        issueCount: entry.issueCount,
        title: book?.title ?? "Unknown",
        author: book?.author ?? null,
        availableCopies: book?.availableCopies ?? 0,
        totalCopies: book?.totalCopies ?? 0,
        cover: book?.book_picture ?? null,
      };
    });

    return res.json(enriched);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/dashboard/pending-approvals
 * Lists of items that require admin action.
 */
export const getPendingApprovals = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });
    if (!canViewDashboard(req)) return res.status(403).json({ message: "Access denied" });

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);

    const [pendingJoinRequests, overdueIssuesRaw, todayReportsRaw] = await Promise.all([
      Clubreq.findAll({
        where: { status: "Pending" },
        order: [["createdAt", "DESC"]],
        limit: 10,
        attributes: ["id", "FullName", "email", "phone", "createdAt"],
        raw: true,
      }),
      Issue.findAll({
        where: { status: "Overdue" },
        order: [["createdAt", "DESC"]],
        limit: 10,
        attributes: ["id", "book_id", "member_id", "createdAt"],
        raw: true,
      }),
      DailyReport.findAll({
        where: { createdAt: { [Op.gte]: todayStart, [Op.lte]: todayEnd } },
        order: [["createdAt", "DESC"]],
        limit: 10,
        attributes: ["id", "created_by", "book_id", "createdAt"],
        raw: true,
      }),
    ]);

    const bookIds = [
      ...new Set([...overdueIssuesRaw.map((i) => i.book_id), ...todayReportsRaw.map((r) => r.book_id)].filter(Boolean)),
    ];

    const memberIds = [...new Set(overdueIssuesRaw.map((i) => i.member_id).filter(Boolean))];
    const userIds = [...new Set(todayReportsRaw.map((r) => r.created_by).filter(Boolean))];

    const [books, members, users] = await Promise.all([
      bookIds.length
        ? Book.findAll({
            where: { id: { [Op.in]: bookIds } },
            attributes: ["id", "title", "author"],
            raw: true,
          })
        : [],
      memberIds.length
        ? Member.findAll({
            where: { id: { [Op.in]: memberIds } },
            attributes: ["id", "first_name", "last_name", "code"],
            raw: true,
          })
        : [],
      userIds.length
        ? User.findAll({
            where: { id: { [Op.in]: userIds } },
            attributes: ["id", "first_name", "last_name"],
            raw: true,
          })
        : [],
    ]);

    const booksById = new Map(books.map((b) => [b.id, b]));
    const membersById = new Map(members.map((m) => [m.id, m]));
    const usersById = new Map(users.map((u) => [u.id, u]));

    const overdueIssues = overdueIssuesRaw.map((i) => ({
      ...i,
      book: booksById.get(i.book_id) || null,
      member: membersById.get(i.member_id) || null,
    }));

    const todayReports = todayReportsRaw.map((r) => ({
      ...r,
      createdBy: usersById.get(r.created_by) || null,
      book: booksById.get(r.book_id) || null,
    }));

    return res.json({
      pendingJoinRequests,
      overdueIssues,
      todayReports,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

export default {
  getDashboardStats,
  getRecentActivity,
  getTopReaders,
  getPopularBooks,
  getPendingApprovals,
};