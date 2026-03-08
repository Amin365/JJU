
import Book from "../models/Books.js";
import Member from "../models/Members.js";
import Issue from "../models/Issue.js";
import DailyReport from "../models/DailyReport.js";
import BlogPost from "../models/BlogPost.js";
import Clubreq from "../models/Clubreq.js";
import User from "../models/user.js";

/**
 * GET /api/dashboard/stats
 * Summary KPI counts for the dashboard home page.
 */
export const getDashboardStats = async (req, res) => {
  try {
    const [
      totalBooks,
      availableBooksAgg,
      borrowedBooks,
      totalMembers,
      activeMembers,
      overdueIssues,
      pendingJoinRequests,
      pendingDailyReports,
    ] = await Promise.all([
      Book.countDocuments(),
      Book.aggregate([{ $group: { _id: null, total: { $sum: "$availableCopies" } } }]),
      Issue.countDocuments({ status: "Issued" }),
      Member.countDocuments(),
      Member.countDocuments({ status: "Active" }),
      Issue.countDocuments({ status: "Overdue" }),
      Clubreq.countDocuments({ status: "Pending" }),
      DailyReport.countDocuments({ status: "Pending" }),
    ]);

    res.json({
      totalBooks,
      availableBooks: availableBooksAgg[0]?.total ?? 0,
      borrowedBooks,
      totalMembers,
      activeMembers,
      overdueIssues,
      pendingJoinRequests,
      pendingDailyReports,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/dashboard/activity
 * Combined feed of recent meaningful events across all collections.
 */
export const getRecentActivity = async (req, res) => {
  try {
    const [
      recentMembers,
      recentBooks,
      recentIssues,
      recentReturns,
      recentJoinReqs,
      recentReports,
      recentBlogs,
    ] = await Promise.all([
      Member.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("first_name last_name code createdAt"),
      Book.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("title author createdAt"),
      Issue.find({ status: { $in: ["Issued", "Overdue"] } })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("book", "title")
        .populate("member", "first_name last_name code"),
      Issue.find({ status: "Returned" })
        .sort({ returnedAt: -1 })
        .limit(5)
        .populate("book", "title")
        .populate("member", "first_name last_name code"),
      Clubreq.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("FullName email status createdAt"),
      DailyReport.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("createdBy", "first_name last_name")
        .populate("book", "title"),
      BlogPost.find({ status: "Published" })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("title author_name status createdAt"),
    ]);

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

    recentIssues.forEach((i) =>
      events.push({
        type: "issue_created",
        label: `Book issued: "${i.book?.title ?? "?"}" → ${
          i.member
            ? `${i.member.first_name} ${i.member.last_name}`
            : "unknown member"
        }`,
        meta: {},
        timestamp: i.createdAt,
      })
    );

    recentReturns.forEach((i) =>
      events.push({
        type: "issue_returned",
        label: `Book returned: "${i.book?.title ?? "?"}" by ${
          i.member
            ? `${i.member.first_name} ${i.member.last_name}`
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

    recentReports.forEach((r) =>
      events.push({
        type: "daily_report",
        label: `Daily report by ${
          r.createdBy
            ? `${r.createdBy.first_name} ${r.createdBy.last_name}`
            : "unknown"
        } on "${r.book?.title ?? "?"}"`,
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

    res.json(events.slice(0, 20));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/dashboard/top-readers
 * Members ranked by daily report count.
 */
export const getTopReaders = async (req, res) => {
  try {
    const grouped = await DailyReport.aggregate([
      {
        $group: {
          _id: "$createdBy",
          reportCount: { $sum: 1 },
          lastReport: { $max: "$createdAt" },
          totalPages: { $sum: { $abs: { $subtract: ["$pagesTo", "$pagesFrom"] } } },
        },
      },
      { $sort: { reportCount: -1 } },
      { $limit: 10 },
    ]);

    const enriched = await Promise.all(
      grouped.map(async (entry) => {
        const user = await User.findById(entry._id)
          .select("first_name last_name profile_picture member")
          .populate("member", "first_name last_name code");

        return {
          _id: entry._id,
          reportCount: entry.reportCount,
          lastReport: entry.lastReport,
          totalPages: entry.totalPages,
          name: user?.member
            ? `${user.member.first_name} ${user.member.last_name}`
            : user
            ? `${user.first_name} ${user.last_name}`
            : "Unknown",
          memberCode: user?.member?.code ?? null,
          avatar: user?.profile_picture ?? null,
        };
      })
    );

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/dashboard/popular-books
 * Books ranked by total number of issues.
 */
export const getPopularBooks = async (req, res) => {
  try {
    const grouped = await Issue.aggregate([
      { $group: { _id: "$book", issueCount: { $sum: 1 } } },
      { $sort: { issueCount: -1 } },
      { $limit: 10 },
    ]);

    const enriched = await Promise.all(
      grouped.map(async (entry) => {
        const book = await Book.findById(entry._id).select(
          "title author availableCopies totalCopies book_picture"
        );

        return {
          _id: entry._id,
          issueCount: entry.issueCount,
          title: book?.title ?? "Unknown",
          author: book?.author ?? null,
          availableCopies: book?.availableCopies ?? 0,
          totalCopies: book?.totalCopies ?? 0,
          cover: book?.book_picture ?? null,
        };
      })
    );

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/dashboard/pending-approvals
 * Lists of items that require admin action.
 */
export const getPendingApprovals = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);

    const [pendingJoinRequests, overdueIssues, todayReports] = await Promise.all([
      Clubreq.find({ status: "Pending" })
        .sort({ createdAt: -1 })
        .limit(10)
        .select("FullName email phone createdAt"),
      Issue.find({ status: "Overdue" })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("book", "title author")
        .populate("member", "first_name last_name code"),
      DailyReport.find({
        createdAt: { $gte: todayStart, $lte: todayEnd },
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("createdBy", "first_name last_name")
        .populate("book", "title"),
    ]);

    res.json({
      pendingJoinRequests,
      overdueIssues,
      todayReports,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};