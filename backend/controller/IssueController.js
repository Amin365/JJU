import mongoose from "mongoose";
import Issue from "../models/Issue.js";
import Books from "../models/Books.js";
import Member from "../models/Members.js";

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
      Books.findById(book).exec(),
      Member.findById(member).exec(),
    ]);

    if (!memberDoc) {
      return res.status(404).json({ message: "Member not found. Before requesting a book you must be member of the Club" });
    }
    if (!bookDoc) return res.status(404).json({ message: "Book not found" });

    // Block if borrowed
    if (String(bookDoc.status).toLowerCase() === "borrowed") {
      return res.status(409).json({ message: "This book is already borrowed" });
    }

    // optional: avoid multiple active issues for same book
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
      .populate("book")
      .populate("member")
      .lean()
      .exec();

    return res.status(201).json({ data: populated });
  } catch (err) {
    return next(err);
  }
};

export const getIssues = async (req, res, next) => {
  try {
    const issues = await Issue.find()
      .populate("book")
      .populate("member")
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

    // set book back to available
    const bookDoc = await Books.findById(issue.book).exec();
    if (bookDoc) {
      bookDoc.status = "available";
      await bookDoc.save();
    }

    const populated = await Issue.findById(issue._id)
      .populate("book")
      .populate("member")
      .lean()
      .exec();

    return res.status(200).json({ data: populated });
  } catch (err) {
    return next(err);
  }
};