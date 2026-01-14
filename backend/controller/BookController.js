import mongoose from "mongoose";
import Book from "../models/Books.js";
import Issue from "../models/Issue.js";

/**
 * Helper: escape user input for use in a RegExp
 */
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Create a new book
 */
export const createBook = async (req, res, next) => {
  try {
    const { title, author, BookType, isbn, status, book_picture, totalPages, totalCopies, availableCopies } = req.body;

    // Basic validation (consider replacing with express-validator/Joi)
    if (!title || !BookType) {
      return res.status(400).json({ message: "title and BookType are required" });
    }

    const uploaded=req.file
    const imageUrl =
      (uploaded && (uploaded.path || uploaded.secure_url || uploaded.url)) ||mundefined;



    // Build model instance and save
    // normalize total/available copies
    // If totalCopies was not provided but availableCopies was, assume totalCopies == availableCopies
    let tc;
    if (typeof totalCopies !== "undefined" && totalCopies !== null && totalCopies !== "") {
      tc = Number(totalCopies) || 1;
    } else if (typeof availableCopies !== "undefined" && availableCopies !== null && availableCopies !== "") {
      tc = Number(availableCopies) || 1;
    } else {
      tc = 1;
    }

    const av = typeof availableCopies !== "undefined" ? Number(availableCopies) : tc;

    const book = new Book({
      title,
      author,
      BookType,
      isbn,
      status,
      book_picture: imageUrl,
      totalPages,
      totalCopies: tc,
      availableCopies: Math.max(0, Math.min(av, tc)),
    });

    try {
      const saved = await book.save();
      return res.status(201).json(saved);
    } catch (err) {
      // Duplicate key (e.g., ISBN unique constraint)
      if (err && err.code === 11000) {
        const dupField = Object.keys(err.keyValue || {}).join(", ") || "unique field";
        return res.status(409).json({
          message: `Duplicate ${dupField}: a book with this value already exists.`,
          details: err.keyValue || null,
        });
      }
      return next(err);
    }
  } catch (err) {
    return next(err);
  }
};

/**
 * Get books with pagination, filtering, sorting.
 * Usage: GET /books?page=1&limit=20&sort=-createdAt&q=search&author=...&BookType=...&status=...&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns: { data, total, page, limit, totalPages }
 */
export const getBooks = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = "-createdAt",
      q,
      author,
      BookType,
      status,
      from,
      to,
    } = req.query;

    const filter = {};

    if (q) {
      // safe regex search across title, author, isbn
      const re = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ title: re }, { author: re }, { isbn: re }];
    }

    if (author) filter.author = author;
    if (BookType) filter.BookType = BookType;
    if (status) filter.status = status;

    if (from || to) {
      filter.publishedDate = {};
      if (from) {
        const d = new Date(from);
        if (!Number.isNaN(d.getTime())) filter.publishedDate.$gte = d;
      }
      if (to) {
        const d = new Date(to);
        if (!Number.isNaN(d.getTime())) filter.publishedDate.$lte = d;
      }
      if (Object.keys(filter.publishedDate).length === 0) delete filter.publishedDate;
    }

    // sanitize and bound paging params
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * perPage;

    // NOTE: sort comes from user query. For safety you may want to validate allowed sort fields.
    const [items, total] = await Promise.all([
      Book.find(filter).sort(sort).skip(skip).limit(perPage).lean().exec(),
      Book.countDocuments(filter).exec(),
    ]);

    // attach borrowedCount per book (number of active Issued issues)
    const bookIds = items.map((b) => b._id).filter(Boolean);
    if (bookIds.length > 0) {
      const counts = await Issue.aggregate([
        { $match: { book: { $in: bookIds.map((id) => new mongoose.Types.ObjectId(id)) }, status: "Issued" } },
        { $group: { _id: "$book", count: { $sum: 1 } } },
      ]).exec();
      const map = counts.reduce((acc, c) => ({ ...acc, [String(c._id)]: c.count }), {});
      for (const it of items) {
        it.borrowedCount = map[String(it._id)] || 0;
      }
    }

    // Return shape: { data, total, page, limit, totalPages }
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
export const getBookById = async (req, res, next) => {
  try {
    const { id } = req.params;

   
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid book id" });
    }

    const book = await Book.findById(id).lean().exec();

    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    return res.status(200).json({ data: book });
  } catch (err) {
    return next(err);
  }
};



/**
 * Update a book by id
 * PUT /books/:id
 * Body: partial or full book fields
 */
export const updateBook = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid book id" });
    }

    const update = { ...req.body };
    // Prevent accidental _id changes
    if (update._id) delete update._id;

    try {
      // If update contains copies, normalize availableCopies to not exceed totalCopies
      if (Object.prototype.hasOwnProperty.call(update, "totalCopies")) {
        update.totalCopies = Number(update.totalCopies) || 0;
      }
      if (Object.prototype.hasOwnProperty.call(update, "availableCopies")) {
        update.availableCopies = Number(update.availableCopies) || 0;
      }

      const updated = await Book.findByIdAndUpdate(id, update, {
        new: true,
        runValidators: true,
        context: "query",
      }).exec();

        if (req.file) {
      const uploaded = req.file;
      update.book_picture = uploaded.path || uploaded.secure_url || uploaded.url;
    }

      // ensure availableCopies never exceeds totalCopies
      if (updated) {
        const tc = Number(updated.totalCopies) || 0;
        const av = Number(updated.availableCopies) || 0;
        if (tc > 0 && av > tc) {
          updated.availableCopies = tc;
          await updated.save();
        }
      }
      const updatedLean = updated ? (await Book.findById(updated._id).lean().exec()) : null;

      if (!updated) {
        return res.status(404).json({ message: "Book not found" });
      }

      return res.status(200).json(updated);
    } catch (err) {
      if (err && err.code === 11000) {
        const dupField = Object.keys(err.keyValue || {}).join(", ") || "unique field";
        return res.status(409).json({
          message: `Duplicate ${dupField}: a book with this value already exists.`,
          details: err.keyValue || null,
        });
      }
      return next(err);
    }
  } catch (err) {
    return next(err);
  }
};

/**
 * Delete a book by id
 * DELETE /books/:id
 */
export const deleteBook = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid book id" });
    }

    const removed = await Book.findByIdAndDelete(id).lean().exec();
    if (!removed) {
      return res.status(404).json({ message: "Book not found" });
    }

    return res.status(200).json({ message: "Book deleted", id: removed._id });
  } catch (err) {
    return next(err);
  }
};

export default {
  createBook,
  getBooks,
  updateBook,
  deleteBook,
};