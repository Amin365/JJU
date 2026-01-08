import mongoose from "mongoose";
import Issue from "../models/Issue.js";
import Book from "../models/Books.js";     // file name Books.js, but model name inside should be "Book"
import Member from "../models/Members.js"; // adjust if your actual file is Member.js
import User from "../models/user.js";      // ✅ MISSING IMPORT (this breaks getMyIssues)
import Notification from "../models/Notification.js";

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

    if (String(bookDoc.status).toLowerCase() === "borrowed") {
      return res.status(409).json({ message: "This book is already borrowed" });
    }

    const existingActive = await Issue.findOne({ book: bookDoc._id, status: "Issued" }).lean().exec();
    if (existingActive) {
      return res.status(409).json({ message: "This book already has an active issue" });
    }

    const issue = await Issue.create({
      book: bookDoc._id,
      member: memberDoc._id,
      issueDate: new Date(issueDate),
      returnDate: new Date(returnDate),
      status: "Issued",
    });

    bookDoc.status = "borrowed";
    await bookDoc.save();

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
    const issues = await Issue.find()
      .populate("book", "title author isbn status book_picture")
      .populate("member", "first_name middle_name last_name full_name email code")
      .sort("-createdAt")
      .lean()
      .exec();

    return res.status(200).json({ data: issues });
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

    const bookDoc = await Book.findById(issue.book).exec();
    if (bookDoc) {
      bookDoc.status = "available";
      await bookDoc.save();
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