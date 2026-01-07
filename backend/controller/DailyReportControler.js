 
import mongoose from "mongoose";
import DailyReport from "../models/DailyReport.js";
import Book from "../models/Books.js"; 
import Notification from "../models/Notification.js";
                                   

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

// POST /daily-reports
export const createDailyReport = async (req, res, next) => {
  try {
    const createdBy = req.user?._id 
    const { book, readingDate, pagesFrom, pagesTo, timeSpent, summary, rating } = req.body;

    if (!createdBy) return res.status(401).json({ message: "Unauthorized" });
    if (!book || !readingDate || pagesFrom === undefined || pagesTo === undefined || !timeSpent || !summary || !rating) {
      return res.status(400).json({ message: "book, readingDate, pagesFrom, pagesTo, timeSpent, summary, rating are required" });
    }

    if (!mongoose.Types.ObjectId.isValid(createdBy)) return res.status(400).json({ message: "Invalid createdBy" });
    if (!mongoose.Types.ObjectId.isValid(book)) return res.status(400).json({ message: "Invalid book id" });

    // Validate book exists
    const bookDoc = await Book.findById(book).lean().exec();
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
  .lean()
  .exec();

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

    const populated = await DailyReport.findById(report._id)
      .populate("createdBy", "username first_name last_name email role")
      .populate("book", "title author isbn status")
      .lean()
      .exec();

    // Notify user about their submitted report
    try {
      await Notification.create({
        user: createdBy,
        title: "Reading report submitted",
        message: `Report for ${bookDoc.title} on ${new Date(readingDate).toLocaleDateString()} submitted`,
        type: "success",
        meta: { report: report._id, kind: "report-submitted" },
      });
    } catch (e) {}

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
    if (req.user?._id && !createdBy) filter.createdBy = req.user._id;
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
        .lean()
        .exec(),
      DailyReport.countDocuments(filter).exec(),
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

// Optional: GET /daily-reports/:id
export const getDailyReportById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid report id" });

    const report = await DailyReport.findById(id)
      .populate("createdBy", "username first_name last_name email role")
      .populate("book", "title author isbn status")
      .lean()
      .exec();

    if (!report) return res.status(404).json({ message: "Report not found" });

    // If you want strict privacy:
    if (req.user?._id && String(report.createdBy?._id || report.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.status(200).json({ data: report });
  } catch (err) {
    return next(err);
  }
};