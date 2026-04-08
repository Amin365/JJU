import Issue from "../models/Issue.js";
import { Op } from 'sequelize';
import Book from "../models/Books.js";     // file name Books.js, but model name inside should be "Book"
import Member from "../models/Members.js"; // adjust if your actual file is Member.js
import User from "../models/user.js";
import ModeratorMember from "../models/ModeratorMember.js";
import Notification from "../models/Notification.js";
import { sendMemberEmail, sendMail, buildEmailHtml } from "../controller/EmailController.js";
import { sendPushToUser } from "../utility/push.js";
import { checkBorrowingRules } from "../utility/borrowingRules.js";
import { notifyNextReservation } from "../controller/ReservationController.js";
import { logIssueAction } from "../utility/auditLog.js";

export const IssueCreate = async (req, res, next) => {
  try {
    const { book, member, issueDate, returnDate } = req.body;

    if (!book || !member || !issueDate || !returnDate) {
      return res.status(400).json({ message: "book, member, issueDate and returnDate are required" });
    }

    if (!Number.isInteger(Number(book))) {
      return res.status(400).json({ message: "Invalid book id" });
    }
    if (!Number.isInteger(Number(member))) {
      return res.status(400).json({ message: "Invalid member id" });
    }

    const [bookDoc, memberDoc] = await Promise.all([
      Book.findByPk(book),
      Member.findByPk(member),
    ]);

    if (!memberDoc) {
      return res.status(404).json({ message: "Member not found. Before requesting a book you must be member of the Club" });
    }
    if (!bookDoc) return res.status(404).json({ message: "Book not found" });

    // Check borrowing rules
    const { allowed, reason } = await checkBorrowingRules(memberDoc.id);
    if (!allowed) {
      return res.status(409).json({ message: reason });
    }

    // Ensure there are available copies and atomically decrement
    const updatedBook = await Book.findOneAndUpdate(
      { _id: bookDoc.id, availableCopies: { [Op.gt]: 0 } },
      { $inc: { availableCopies: -1 } },
      { new: true }
    );

    if (!updatedBook) {
      return res.status(409).json({ message: "No available copies for this book" });
    }

    // Update status based on availability
    if ((updatedBook.availableCopies || 0) <= 0) {
      updatedBook.status = "borrowed";
    } else {
      updatedBook.status = "available";
    }
    await updatedBook.save();

    const issue = await Issue.create({
      book: updatedBook.id,
      member: memberDoc.id,
      issueDate: new Date(issueDate),
      returnDate: new Date(returnDate),
      status: "Issued",
    });

    const populated = await Issue.findByPk(issue.id)
      .populate("book", "title author isbn status book_picture")
      .populate("member", "first_name middle_name last_name full_name email code")
      
      ;

    // Phase 8: Audit log
    await logIssueAction("created", populated, req.user, req, {
      description: `Book "${bookDoc.title}" issued to "${memberDoc.first_name} ${memberDoc.last_name}"`,
    });

    // Notify the member's linked user about the new issue
    try {
      const memberUser = await User.findOne({ member: memberDoc.id }).select("_id");
      if (memberUser?._id) {
        await Notification.create({
          user: memberUser.id,
          title: "Book issued",
          message: `${bookDoc.title} has been issued to you. Due on ${new Date(returnDate).toLocaleDateString()}.`,
          type: "success",
          meta: { issue: issue.id, kind: "issued" },
        });
      }
    } catch (e) {
      // Non-blocking
    }

    return res.status(201).json({ data: populated });
  } catch (err) {
    return next(err);
  }
};

// export const getIssues = async (req, res, next) => {
//   try {
//     const { page = 1, limit = 20, q, status } = req.query;

//     const pageNum = Math.max(1, parseInt(page, 10) || 1);
//     const perPage = Math.max(1, Math.min(500, parseInt(limit, 10) || 20));
//     const skip = (pageNum - 1) * perPage;

//     const filter = {};
//     if (q) {
//       const re = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
//       // search by book title or member name
//       // we'll match later after populating, but keep simple: allow member code matching and book title by lookup
//       // for now support member code exact match via filter on member (if q looks like code)
//       filter.$or = [
//         { 'member.code': re },
//       ];
//     }
//     if (status) filter.status = status;

//     // Role-based scoping: require auth (router enforces protect)
//     const userId = req.user?._id;
//     if (!userId) return res.status(401).json({ message: "Unauthorized" });

//     const currentUser = await User.findByPk(userId).populate('role', 'role plural');
//     const roleName = (currentUser?.role?.role || currentUser?.role?.plural || '').toLowerCase();
//     const isSuperAdmin = /super\s*admin/i.test(roleName);
//     const isModerator = /moderator/i.test(roleName);

//     // if moderator, restrict to members assigned to them
//     if (isModerator && !isSuperAdmin) {
//       const assigned = await ModeratorMember.find({ moderator: userId }).select('member');
//       const memberIds = assigned.map((a) => a.member).filter(Boolean);
//       const validMemberIds = memberIds.filter((id) => Number.isInteger(Number(id)));
//       if (validMemberIds.length === 0) {
//         return res.status(200).json({ data: [], total: 0, page: pageNum, totalPages: 0, limit: perPage });
//       }
//       filter.member = { [Op.in]: validMemberIds };
//     }

//     // regular users: show only their member's issues
//     if (!isModerator && !isSuperAdmin) {
//       if (!currentUser?.member) return res.status(200).json({ data: [], total: 0, page: pageNum, totalPages: 0, limit: perPage });
//       if (!Number.isInteger(Number(currentUser.member))) {
//         return res.status(200).json({ data: [], total: 0, page: pageNum, totalPages: 0, limit: perPage });
//       }
//       filter.member = currentUser.member;
//     }

//     // Filter out any corrupted issues with invalid refs
//     const andFilters = [
//       { member: { $type: "objectId" } },
//       { book: { $type: "objectId" } },
//     ];

//     if (Object.keys(filter).length > 0) {
//       andFilters.push(filter);
//     }

//     const finalFilter = andFilters.length > 0 ? { $and: andFilters } : filter;

//     const runQuery = async () => {
//       const [items, total] = await Promise.all([
//         Issue.find(finalFilter)
//           .populate("book", "title author isbn status book_picture availableCopies")
//           .populate("member", "first_name middle_name last_name full_name email code")
//           .sort("-createdAt")
//           .skip(skip)
//           .limit(perPage)
//           
//           ,
//         Issue.countDocuments(finalFilter),
//       ]);
//       return { items, total };
//     };

//     let items;
//     let total;

//     try {
//       ({ items, total } = await runQuery());
//     } catch (err) {
//       const msg = String(err?.message || "");
//       if (msg.includes("input must be a 24 character hex string")) {
//         // Cleanup invalid issues (non-ObjectId refs) then retry once
//         await Issue.deleteMany({
//           [Op.or]: [
//             { book: { [Op.not]: { $type: "objectId" } } },
//             { member: { [Op.not]: { $type: "objectId" } } },
//           ],
//         });

//         ({ items, total } = await runQuery());
//       } else {
//         throw err;
//       }
//     }

//     // Attach borrowed counts per book
//     const bookIds = Array.from(new Set(items.map((it) => String(it.book?._id)).filter(Boolean)));
//     const validBookObjectIds = bookIds
//       .filter((id) => Number.isInteger(Number(id)))
//       .map((id) => id);

//     if (validBookObjectIds.length > 0) {
//       const counts = await Issue.aggregate([
//         { $match: { book: { [Op.in]: validBookObjectIds }, status: "Issued" } },
//         { $group: { _id: "$book", count: { $sum: 1 } } },
//       ]);
//       const map = counts.reduce((acc, c) => ({ ...acc, [String(c.id)]: c.count }), {});
//       for (const it of items) {
//         const bid = String(it.book?._id);
//         if (it.book) it.book.borrowedCount = map[bid] || 0;
//       }
//     }

//     return res.status(200).json({ data: items, total, page: pageNum, totalPages: Math.ceil(total / perPage), limit: perPage });
//   } catch (err) {
//     return next(err);
//   }
// };

export const getIssues = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, q, status } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const perPage = Math.min(500, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * perPage;

    if (!req.user?._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // =========================
    // USER + ROLE
    // =========================
    const currentUser = await User.findByPk(req.user.id)
      .populate("role", "role plural")
      .select("member role")
      ;

    if (!currentUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const roleName = (
      currentUser.role?.role ||
      currentUser.role?.plural ||
      ""
    ).toLowerCase();

    const isSuperAdmin = roleName.includes("super");
    const isModerator = roleName.includes("moderator");

    // =========================
    // BASE FILTER (SAFE ONLY)
    // =========================
    const filter = {
      book: { $type: "objectId" },
      member: { $type: "objectId" },
    };

    if (status) {
      filter.status = status;
    }

    // =========================
    // ROLE-BASED SCOPING
    // =========================
    if (isModerator && !isSuperAdmin) {
      const assigned = await ModeratorMember.find({
        moderator: req.user.id,
      })
        .select("member")
        ;

      const memberIds = assigned
        .map(a => a.member)
        .filter(id => Number.isInteger(Number(id)));

      if (memberIds.length === 0) {
        return res.status(200).json({
          data: [],
          total: 0,
          page: pageNum,
          totalPages: 0,
          limit: perPage,
        });
      }

      filter.member = { [Op.in]: memberIds };
    }

    if (!isModerator && !isSuperAdmin) {
      if (!Number.isInteger(Number(currentUser.member))) {
        return res.status(200).json({
          data: [],
          total: 0,
          page: pageNum,
          totalPages: 0,
          limit: perPage,
        });
      }
      filter.member = currentUser.member;
    }

    // =========================
    // SEARCH (MEMBER CODE ONLY)
    // =========================
    if (q) {
      const re = new RegExp(
        String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );

      const members = await Member.find({ code: re })
        .select("_id")
        ;

      const memberIds = members
        .map(m => m.id)
        .filter(id => Number.isInteger(Number(id)));

      if (memberIds.length > 0) {
        filter.member = filter.member
          ? { [Op.in]: memberIds.filter(id =>
              filter.member.$in
                ? filter.member.$in.includes(id)
                : true
            )}
          : { [Op.in]: memberIds };
      } else {
        // No matching members → no issues
        return res.status(200).json({
          data: [],
          total: 0,
          page: pageNum,
          totalPages: 0,
          limit: perPage,
        });
      }
    }

    // =========================
    // MAIN QUERY
    // =========================
    const [items, total] = await Promise.all([
      Issue.find(filter)
        .populate("book", "title author isbn status book_picture availableCopies")
        .populate("member", "first_name middle_name last_name full_name email code")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(perPage)
        ,
      Issue.countDocuments(filter),
    ]);

    // =========================
    // BORROWED COUNTS (FAST)
    // =========================
    const bookIds = items
      .map(i => i.book?._id)
      .filter(id => Number.isInteger(Number(id)));

    if (bookIds.length > 0) {
      const counts = await Issue.aggregate([
        { $match: { book: { [Op.in]: bookIds }, status: "Issued" } },
        { $group: { _id: "$book", count: { $sum: 1 } } },
      ]);

      const countMap = {};
      counts.forEach(c => {
        countMap[String(c.id)] = c.count;
      });

      items.forEach(i => {
        if (i.book) {
          i.book.borrowedCount = countMap[String(i.book.id)] || 0;
        }
      });
    }

    return res.status(200).json({
      data: items,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / perPage),
      limit: perPage,
    });
  } catch (err) {
    return next(err);
  }
};


export const markIssueReturned = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!Number.isInteger(Number(id))) {
      return res.status(400).json({ message: "Invalid issue id" });
    }

    const issue = await Issue.findByPk(id);
    if (!issue) return res.status(404).json({ message: "Issue not found" });

    if (issue.status === "Returned") {
      return res.status(409).json({ message: "Issue already returned" });
    }

    issue.status = "Returned";
    issue.returnedAt = new Date();
    await issue.save();

    // increment available copies
    let bookDoc = await Book.findByIdAndUpdate(issue.book, { $inc: { availableCopies: 1 } }, { new: true });
    if (bookDoc) {
      // cap availableCopies to totalCopies
      const tc = Number(bookDoc.totalCopies) || 0;
      if (tc > 0 && (bookDoc.availableCopies || 0) > tc) {
        bookDoc.availableCopies = tc;
      }
      if ((bookDoc.availableCopies || 0) > 0) {
        bookDoc.status = "available";
      }
      await bookDoc.save();
      // re-fetch to ensure consistency
      bookDoc = await Book.findByPk(issue.book);
    }

    const populated = await Issue.findByPk(issue.id)
      .populate("book", "title author isbn status book_picture")
      .populate("member", "first_name middle_name last_name full_name email code")
      
      ;

    // Phase 8: Audit log
    await logIssueAction("returned", populated, req.user, req, {
      description: `Book "${bookDoc?.title || "Unknown"}" was returned`,
    });

    // Optionally notify user that the book was returned
    try {
      const memberUser = await User.findOne({ member: issue.member }).select("_id");
      if (memberUser?._id) {
        await Notification.create({
          user: memberUser.id,
          title: "Book returned",
          message: `Thank you for returning "${bookDoc?.title || "your book"}".`,
          type: "success",
          meta: { issue: issue.id, kind: "returned" },
        });
      }
    } catch (e) {}

    // Notify next member in reservation queue, if any
    await notifyNextReservation(issue.book);

    return res.status(200).json({ data: populated });
  } catch (err) {
    return next(err);
  }
};

export const getMyIssues = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findByPk(userId).select("member");
    if (!user?.member) return res.status(400).json({ message: "User is not linked to a member" });

    const issues = await Issue.find({ member: user.member })
      .populate("book", "title author isbn status totalPages  book_picture") 
      .sort("-createdAt")
      
      ;

    return res.status(200).json({ data: issues });
  } catch (err) {
    return next(err);
  }
};
// POST /issue/:id/send-reminder



// import { sendMail } from "./sendMailController.js"; // import the Resend-based sendMail
// import Issue from "../models/Issue.js";

/**
 * ReminderEmail Controller using Resend
 * POST /issues/:id/reminder
 */


// import Issue from "../models/Issue.js";
// import User from "../models/user.js";
// import { sendPushToUser } from "../utility/push.js";
// import { sendMail } from "../controller/EmailController.js";

export const ReminderEmail = async (req, res) => {
  try {
    const { id } = req.params;

    if (!Number.isInteger(Number(id))) {
      return res.status(400).json({ message: "Invalid issue id" });
    }

    const issue = await Issue.findByPk(id)
      .populate("member")
      .populate("book")
      ;

    if (!issue) return res.status(404).json({ message: "Issue not found" });
    if (issue.status === "Returned") return res.status(400).json({ message: "Book already returned" });

    const memberUser = issue.member;
    if (!memberUser?._id) return res.status(400).json({ message: "Member not found" });

    const memberName = `${memberUser.first_name || "Member"} ${memberUser.last_name || ""}`.trim();
    const bookTitle = issue.book?.title || "the book";

    // Send push if member has subscription
    await sendPushToUser(memberUser.id, {
      title: "📕 Book Return Reminder",
      body: `"${bookTitle}" is still not returned.`,
      icon: "/jjuclub.png",
      data: { issueId: issue.id, url: "/my-books" }
    });

    // Send email
    await sendMail({
      to: memberUser.email,
      subject: "📕 Book Return Reminder",
      text: `Dear ${memberName}, your borrowed book "${bookTitle}" is still not returned. Please return it as soon as possible or contact the club if you need more time.`,
      html: buildEmailHtml({
        title: "Book Return Reminder",
        preheader: `Reminder: "${bookTitle}" is due.`,
        greeting: `Dear ${memberName}`,
        bodyLines: [
          `This is a friendly reminder that the book <strong>"${bookTitle}"</strong> has not yet been returned.`,
          "Please return it as soon as possible. If you need additional time, reply to this email and we will help you.",
          "Keeping returns on time helps everyone enjoy the collection—thank you for your cooperation.",
        ],
        ctaLabel: "View My Books",
        ctaUrl: process.env.APP_URL || "#",
        footerNote: `Best regards, ${process.env.APP_NAME || "Reading Club"}`,
      }),
    });

    return res.status(200).json({ message: "Reminder sent via email and push if subscribed" });
  } catch (err) {
    console.error("ReminderEmail error:", err);
    return res.status(500).json({ message: err.message || "Failed to send reminder" });
  }
};







