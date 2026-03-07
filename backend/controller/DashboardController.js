import Book from "../models/Books.js";
import Member from "../models/Members.js";
import Issue from "../models/Issue.js";
import DailyReport from "../models/DailyReport.js";
import Clubreq from "../models/Clubreq.js";
import BlogPost from "../models/BlogPost.js";

/**
 * GET /api/dashboard/stats
 * Returns pre-computed library KPIs for the dashboard overview.
 */
export const getDashboardStats = async (req, res, next) => {
  try {
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
      Book.countDocuments(),
      Book.countDocuments({ status: "available" }),
      Book.countDocuments({ status: "borrowed" }),
      Member.countDocuments({ isArchived: false }),
      Member.countDocuments({ status: "Active", isArchived: false }),
      Issue.countDocuments({ status: "Overdue" }),
      Clubreq.countDocuments({ status: "Pending" }),
      DailyReport.countDocuments({ status: "Pending" }),
    ]);

    return res.json({
      totalBooks,
      availableBooks,
      borrowedBooks,
      totalMembers,
      activeMembers,
      overdueIssues,
      pendingJoinRequests,
      pendingDailyReports,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/dashboard/activity?limit=20
 * Returns a unified, time-sorted activity feed assembled from multiple entities.
 */
export const getRecentActivity = async (req, res, next) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);

    const [members, books, issues, joinRequests, reports, blogs] = await Promise.all([
      Member.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("first_name last_name createdAt")
        .lean(),
      Book.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("title author createdAt")
        .lean(),
      Issue.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("book", "title")
        .populate("member", "first_name last_name full_name")
        .select("status createdAt returnedAt book member")
        .lean(),
      Clubreq.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("FullName status createdAt")
        .lean(),
      DailyReport.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("book", "title")
        .select("status createdAt book")
        .lean(),
      BlogPost.find({ status: "Published" })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("title author createdAt")
        .lean(),
    ]);

    const events = [
      ...members.map((m) => ({
        type: "member_joined",
        title: `New member: ${[m.first_name, m.last_name].filter(Boolean).join(" ")}`,
        time: m.createdAt,
        icon: "user",
      })),
      ...books.map((b) => ({
        type: "book_added",
        title: `Book added: ${b.title}`,
        time: b.createdAt,
        icon: "book",
      })),
      ...issues.map((i) => ({
        type: i.status === "Returned" ? "book_returned" : "book_issued",
        title:
          i.status === "Returned"
            ? `Book returned: ${i.book?.title ?? "—"}`
            : `Book issued: ${i.book?.title ?? "—"} → ${
                i.member?.full_name ??
                [i.member?.first_name, i.member?.last_name].filter(Boolean).join(" ") ??
                "—"
              }`,
        time: i.status === "Returned" ? i.returnedAt || i.createdAt : i.createdAt,
        icon: "book-open",
      })),
      ...joinRequests.map((r) => ({
        type: "join_request",
        title: `Join request: ${r.FullName}`,
        time: r.createdAt,
        icon: "user-plus",
      })),
      ...reports.map((r) => ({
        type: "daily_report",
        title: `Daily report submitted${r.book?.title ? ` for "${r.book.title}"` : ""}`,
        time: r.createdAt,
        icon: "file-text",
      })),
      ...blogs.map((b) => ({
        type: "blog_published",
        title: `Blog published: ${b.title}`,
        time: b.createdAt,
        icon: "rss",
      })),
    ];

    events.sort((a, b) => new Date(b.time) - new Date(a.time));

    return res.json({ data: events.slice(0, limit) });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/dashboard/top-readers?days=7
 * Returns a ranked list of members by pages read in the given period.
 */
export const getTopReaders = async (req, res, next) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days, 10) || 7));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const results = await DailyReport.aggregate([
      { $match: { readingDate: { $gte: since } } },
      {
        $group: {
          _id: "$createdBy",
          totalPages: { $sum: { $add: [{ $subtract: ["$pagesTo", "$pagesFrom"] }, 1] } },
          totalMinutes: { $sum: "$timeSpent" },
          reportCount: { $sum: 1 },
        },
      },
      { $sort: { totalPages: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userDoc",
        },
      },
      { $unwind: { path: "$userDoc", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "members",
          localField: "userDoc.member",
          foreignField: "_id",
          as: "memberDoc",
        },
      },
      { $unwind: { path: "$memberDoc", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          totalPages: 1,
          totalMinutes: 1,
          reportCount: 1,
          name: {
            $cond: {
              if: { $gt: [{ $strLenCP: { $ifNull: ["$memberDoc.first_name", ""] } }, 0] },
              then: {
                $trim: {
                  input: {
                    $concat: [
                      { $ifNull: ["$memberDoc.first_name", ""] },
                      " ",
                      { $ifNull: ["$memberDoc.last_name", ""] },
                    ],
                  },
                },
              },
              else: {
                $trim: {
                  input: {
                    $concat: [
                      { $ifNull: ["$userDoc.first_name", ""] },
                      " ",
                      { $ifNull: ["$userDoc.last_name", ""] },
                    ],
                  },
                },
              },
            },
          },
          avatar: "$memberDoc.Profile_picture",
        },
      },
    ]);

    return res.json({ data: results, days });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/dashboard/popular-books?days=30&limit=10
 * Returns most-issued books within a time window.
 */
export const getPopularBooks = async (req, res, next) => {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const results = await Issue.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: "$book", issueCount: { $sum: 1 } } },
      { $sort: { issueCount: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "books",
          localField: "_id",
          foreignField: "_id",
          as: "bookDoc",
        },
      },
      { $unwind: "$bookDoc" },
      {
        $project: {
          _id: 1,
          issueCount: 1,
          title: "$bookDoc.title",
          author: "$bookDoc.author",
          isbn: "$bookDoc.isbn",
          cover: "$bookDoc.book_picture",
          status: "$bookDoc.status",
        },
      },
    ]);

    return res.json({ data: results, days });
  } catch (err) {
    return next(err);
  }
};
