import mongoose from "mongoose";
import Issue from "../models/Issue.js";
import Book from "../models/Books.js";     // file name Books.js, but model name inside should be "Book"
import Member from "../models/Members.js"; // adjust if your actual file is Member.js
import User from "../models/user.js";
import ModeratorMember from "../models/ModeratorMember.js";
import Notification from "../models/Notification.js";
import { sendMemberEmail,sendMail } from "../controller/EmailController.js";

export const IssueCreate = async (req, res, next) => {
  try {
    const { book, member, issueDate, returnDate } = req.body;

    if (!book || !member || !issueDate || !returnDate) {
      return res.status(400).json({ message: "book, member, issueDate and returnDate are required" });
    }

    if (!mongoose.Types.ObjectId.isValid(book)) {
      return res.status(400).json({ message: "Invalid book id" });
    }
    if (!mongoose.Types.ObjectId.isValid(member)) {
      return res.status(400).json({ message: "Invalid member id" });
    }

    const [bookDoc, memberDoc] = await Promise.all([
      Book.findById(book).exec(),
      Member.findById(member).exec(),
    ]);

    if (!memberDoc) {
      return res.status(404).json({ message: "Member not found. Before requesting a book you must be member of the Club" });
    }
    if (!bookDoc) return res.status(404).json({ message: "Book not found" });

    // Ensure there are available copies and atomically decrement
    const updatedBook = await Book.findOneAndUpdate(
      { _id: bookDoc._id, availableCopies: { $gt: 0 } },
      { $inc: { availableCopies: -1 } },
      { new: true }
    ).exec();

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
      book: updatedBook._id,
      member: memberDoc._id,
      issueDate: new Date(issueDate),
      returnDate: new Date(returnDate),
      status: "Issued",
    });

    const populated = await Issue.findById(issue._id)
      .populate("book", "title author isbn status book_picture")
      .populate("member", "first_name middle_name last_name full_name email code")
      .lean()
      .exec();

    // Notify the member's linked user about the new issue
    try {
      const memberUser = await User.findOne({ member: memberDoc._id }).select("_id").lean();
      if (memberUser?._id) {
        await Notification.create({
          user: memberUser._id,
          title: "Book issued",
          message: `${bookDoc.title} has been issued to you. Due on ${new Date(returnDate).toLocaleDateString()}.`,
          type: "success",
          meta: { issue: issue._id, kind: "issued" },
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

export const getIssues = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, q, status } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.max(1, Math.min(500, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * perPage;

    const filter = {};
    if (q) {
      const re = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      // search by book title or member name
      // we'll match later after populating, but keep simple: allow member code matching and book title by lookup
      // for now support member code exact match via filter on member (if q looks like code)
      filter.$or = [
        { 'member.code': re },
      ];
    }
    if (status) filter.status = status;

    // Role-based scoping: require auth (router enforces protect)
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const currentUser = await User.findById(userId).populate('role', 'role plural').lean().exec();
    const roleName = (currentUser?.role?.role || currentUser?.role?.plural || '').toLowerCase();
    const isSuperAdmin = /super\s*admin/i.test(roleName);
    const isModerator = /moderator/i.test(roleName);

    // if moderator, restrict to members assigned to them
    if (isModerator && !isSuperAdmin) {
      const assigned = await ModeratorMember.find({ moderator: userId }).select('member').lean().exec();
      const memberIds = assigned.map((a) => a.member).filter(Boolean);
      if (memberIds.length === 0) return res.status(200).json({ data: [], total: 0, page: pageNum, totalPages: 0, limit: perPage });
      filter.member = { $in: memberIds };
    }

    // regular users: show only their member's issues
    if (!isModerator && !isSuperAdmin) {
      if (!currentUser?.member) return res.status(200).json({ data: [], total: 0, page: pageNum, totalPages: 0, limit: perPage });
      filter.member = currentUser.member;
    }

    // Query with pagination
    const [items, total] = await Promise.all([
      Issue.find(filter)
        .populate("book", "title author isbn status book_picture availableCopies")
        .populate("member", "first_name middle_name last_name full_name email code")
        .sort("-createdAt")
        .skip(skip)
        .limit(perPage)
        .lean()
        .exec(),
      Issue.countDocuments(filter).exec(),
    ]);

    // Attach borrowed counts per book
    const bookIds = Array.from(new Set(items.map((it) => String(it.book?._id)).filter(Boolean)));
    if (bookIds.length > 0) {
      const counts = await Issue.aggregate([
        { $match: { book: { $in: bookIds.map((id) => new mongoose.Types.ObjectId(id)) }, status: "Issued" } },
        { $group: { _id: "$book", count: { $sum: 1 } } },
      ]).exec();
      const map = counts.reduce((acc, c) => ({ ...acc, [String(c._id)]: c.count }), {});
      for (const it of items) {
        const bid = String(it.book?._id);
        if (it.book) it.book.borrowedCount = map[bid] || 0;
      }
    }

    return res.status(200).json({ data: items, total, page: pageNum, totalPages: Math.ceil(total / perPage), limit: perPage });
  } catch (err) {
    return next(err);
  }
};

export const markIssueReturned = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid issue id" });
    }

    const issue = await Issue.findById(id).exec();
    if (!issue) return res.status(404).json({ message: "Issue not found" });

    if (issue.status === "Returned") {
      return res.status(409).json({ message: "Issue already returned" });
    }

    issue.status = "Returned";
    issue.returnedAt = new Date();
    await issue.save();

    // increment available copies
    let bookDoc = await Book.findByIdAndUpdate(issue.book, { $inc: { availableCopies: 1 } }, { new: true }).exec();
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
      bookDoc = await Book.findById(issue.book).lean().exec();
    }

    const populated = await Issue.findById(issue._id)
      .populate("book", "title author isbn status book_picture")
      .populate("member", "first_name middle_name last_name full_name email code")
      .lean()
      .exec();

    // Optionally notify user that the book was returned
    try {
      const memberUser = await User.findOne({ member: issue.member }).select("_id").lean();
      if (memberUser?._id) {
        await Notification.create({
          user: memberUser._id,
          title: "Book returned",
          message: `Thank you for returning "${bookDoc?.title || "your book"}".`,
          type: "success",
          meta: { issue: issue._id, kind: "returned" },
        });
      }
    } catch (e) {}

    return res.status(200).json({ data: populated });
  } catch (err) {
    return next(err);
  }
};

export const getMyIssues = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(userId).select("member").lean().exec();
    if (!user?.member) return res.status(400).json({ message: "User is not linked to a member" });

    const issues = await Issue.find({ member: user.member })
      .populate("book", "title author isbn status totalPages  book_picture") 
      .sort("-createdAt")
      .lean()
      .exec();

    return res.status(200).json({ data: issues });
  } catch (err) {
    return next(err);
  }
};
// POST /issue/:id/send-reminder



export const ReminderEmail = async (req, res) => {
  try {
    const { id } = req.params;

    const issue = await Issue.findById(id)
      .populate("member")
      .populate("book")
      .lean();

    if (!issue) {
      return res.status(404).json({ message: "Issue not found" });
    }

    if (issue.status === "Returned") {
      return res.status(400).json({ message: "Book already returned" });
    }

    const email = issue.member?.email;
    if (!email) {
      return res.status(400).json({ message: "Member has no email" });
    }

    const memberName = issue.member?.first_name || "Member";
    const bookTitle = issue.book?.title || "the book";

    // ✅ Send email immediately
    await sendMail({
      to: email,
      subject: "📕 Book Return Reminder",
      text: `Dear ${memberName}, your borrowed book "${bookTitle}" is still not returned.`,
      html: `
        <p>Dear <strong>${memberName}</strong>,</p>
        <p>We hope this message finds you well.</p>
        <p>This is a gentle reminder that the book <strong>"${bookTitle}"</strong> you borrowed has not yet been returned.</p>
        <p>Please return it at your earliest convenience to avoid any inconvenience.</p>
        <br/>
        <p>Best regards,<br/><strong>${process.env.APP_NAME}</strong></p>
      `
    });

    return res.json({
      message: "Reminder email sent successfully",
    });

  } catch (err) {
    console.error("❌ ReminderEmail error:", err);
    return res.status(500).json({ message: "Failed to send reminder" });
  }
};





