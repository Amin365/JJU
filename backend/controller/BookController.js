import Book from "../models/Books.js";
import { Op, col, fn, where as sqlWhere } from "sequelize";
import Issue from "../models/Issue.js";
import Member from "../models/member.js";
import { logBookAction } from "../utility/auditLog.js";

const escapeLike = (s) => String(s).replace(/[%_]/g, "\\$&");

const normalize = (v) => (v == null ? "" : String(v).trim());

const toIntOr = (v, fallback) => {
  if (v === "" || v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};

const allowedStatus = new Set(["available", "borrowed", "lost", "damaged", "archived"]);

/**
 * Create a new book
 */
export const createBook = async (req, res, next) => {
  try {
    const { title, author, BookType, isbn, status, totalPages, totalCopies, availableCopies } = req.body;

    if (!title || !BookType) {
      return res.status(400).json({ message: "title and BookType are required" });
    }

    const uploaded = req.file;
    const imageUrl = (uploaded && (uploaded.path || uploaded.secure_url || uploaded.url)) || null;

    let tc;
    if (typeof totalCopies !== "undefined" && totalCopies !== null && totalCopies !== "") {
      tc = Number(totalCopies) || 1;
    } else if (typeof availableCopies !== "undefined" && availableCopies !== null && availableCopies !== "") {
      tc = Number(availableCopies) || 1;
    } else {
      tc = 1;
    }
    const av = typeof availableCopies !== "undefined" ? Number(availableCopies) : tc;

    const saved = await Book.create({
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

    await logBookAction("created", saved, req.user, req, {
      description: `Book "${saved.title}" was created`,
    });

    return res.status(201).json(saved);
  } catch (err) {
    if (err?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        message: "Duplicate value: a book with this unique field already exists.",
      });
    }
    return next(err);
  }
};

/**
 * Get books with pagination, filtering, sorting.
 */
export const getBooks = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = "-createdAt",
      q,
      isbn,
      author,
      BookType,
      status,
      from,
      to,
    } = req.query;

    const where = {};

    if (isbn) where.isbn = String(isbn).trim();
    if (author) where.author = author;
    if (BookType) where.BookType = BookType;
    if (status) where.status = status;

    if (q) {
      const escaped = `%${escapeLike(q)}%`;
      where[Op.or] = [
        { title: { [Op.like]: escaped } },
        { author: { [Op.like]: escaped } },
        { isbn: { [Op.like]: escaped } },
      ];
    }

    if (from || to) {
      where.createdAt = {};
      if (from) {
        const d = new Date(from);
        if (!Number.isNaN(d.getTime())) where.createdAt[Op.gte] = d;
      }
      if (to) {
        const d = new Date(to);
        if (!Number.isNaN(d.getTime())) where.createdAt[Op.lte] = d;
      }
      if (Object.keys(where.createdAt).length === 0) delete where.createdAt;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * perPage;

    const sortField = String(sort).replace(/^-/, "");
    const sortDirection = String(sort).startsWith("-") ? "DESC" : "ASC";
    const allowedSortFields = new Set(["createdAt", "updatedAt", "title", "author", "isbn", "availableCopies", "totalCopies"]);
    const order = [[allowedSortFields.has(sortField) ? sortField : "createdAt", sortDirection]];

    const { rows: items, count: total } = await Book.findAndCountAll({
      where,
      order,
      offset,
      limit: perPage,
    });

    const bookIds = items.map((b) => b.id).filter(Boolean);
    if (bookIds.length > 0) {
      const counts = await Issue.findAll({
        where: { book_id: { [Op.in]: bookIds }, status: "Issued" },
        attributes: ["book_id", [fn("COUNT", col("id")), "count"]],
        group: ["book_id"],
        raw: true,
      });
      const map = counts.reduce((acc, c) => ({ ...acc, [String(c.book_id)]: Number(c.count || 0) }), {});
      for (const it of items) {
        it.setDataValue("borrowedCount", map[String(it.id)] || 0);
      }
    }

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
    if (!Number.isInteger(Number(id))) {
      return res.status(400).json({ message: "Invalid book id" });
    }

    const book = await Book.findByPk(id);
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
 */
export const updateBook = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!Number.isInteger(Number(id))) {
      return res.status(400).json({ message: "Invalid book id" });
    }

    const book = await Book.findByPk(id);
    if (!book) return res.status(404).json({ message: "Book not found" });

    const update = { ...req.body };
    if (update.id) delete update.id;

    if (Object.prototype.hasOwnProperty.call(update, "totalCopies")) {
      update.totalCopies = Number(update.totalCopies) || 0;
    }
    if (Object.prototype.hasOwnProperty.call(update, "availableCopies")) {
      update.availableCopies = Number(update.availableCopies) || 0;
    }

    if (req.file) {
      const uploaded = req.file;
      update.book_picture = uploaded.path || uploaded.secure_url || uploaded.url;
    }

    await book.update(update);

    const tc = Number(book.totalCopies) || 0;
    const av = Number(book.availableCopies) || 0;
    if (tc > 0 && av > tc) {
      await book.update({ availableCopies: tc });
    }

    return res.status(200).json(book);
  } catch (err) {
    if (err?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        message: "Duplicate value: a book with this unique field already exists.",
      });
    }
    return next(err);
  }
};

/**
 * Delete a book by id
 */
export const deleteBook = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!Number.isInteger(Number(id))) {
      return res.status(400).json({ message: "Invalid book id" });
    }

    const removed = await Book.findByPk(id);
    if (!removed) {
      return res.status(404).json({ message: "Book not found" });
    }
    await removed.destroy();

    return res.status(200).json({ message: "Book deleted", id: removed.id });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /books/bulk
 */
export const bulkCreateBooks = async (req, res, next) => {
  try {
    const { books } = req.body;

    if (!Array.isArray(books) || books.length === 0) {
      return res.status(400).json({ message: "books must be a non-empty array" });
    }

    const prepared = [];
    const errors = [];

    for (let i = 0; i < books.length; i++) {
      const raw = books[i] || {};
      const title = normalize(raw.title);
      if (!title) {
        errors.push({ index: i, message: "title is required" });
        continue;
      }

      const author = normalize(raw.author);
      const BookType = normalize(raw.BookType);
      const book_picture = normalize(raw.book_picture);

      const statusRaw = normalize(raw.status).toLowerCase();
      const status = statusRaw || "available";
      if (status && !allowedStatus.has(status)) {
        errors.push({ index: i, message: `Invalid status: ${status}` });
        continue;
      }

      const totalPages = toIntOr(raw.totalPages, 0);
      const totalCopies = toIntOr(raw.totalCopies, 1);
      const availableCopies =
        raw.availableCopies == null || raw.availableCopies === ""
          ? totalCopies
          : toIntOr(raw.availableCopies, totalCopies);

      if (totalPages < 0) {
        errors.push({ index: i, message: "totalPages must be >= 0" });
        continue;
      }
      if (totalCopies < 0) {
        errors.push({ index: i, message: "totalCopies must be >= 0" });
        continue;
      }
      if (availableCopies < 0) {
        errors.push({ index: i, message: "availableCopies must be >= 0" });
        continue;
      }
      if (availableCopies > totalCopies) {
        errors.push({ index: i, message: "availableCopies cannot be greater than totalCopies" });
        continue;
      }

      const isbn = normalize(raw.isbn);
      const doc = {
        title,
        author: author || undefined,
        BookType: BookType || undefined,
        status,
        book_picture: book_picture || undefined,
        totalPages,
        totalCopies,
        availableCopies,
      };
      if (isbn) doc.isbn = isbn;

      prepared.push(doc);
    }

    const seenIsbn = new Set();
    const deduped = [];
    for (const doc of prepared) {
      if (doc.isbn) {
        const key = doc.isbn.toLowerCase();
        if (seenIsbn.has(key)) continue;
        seenIsbn.add(key);
      }
      deduped.push(doc);
    }

    const providedIsbns = deduped.map((d) => d.isbn).filter(Boolean);
    const existing = providedIsbns.length
      ? await Book.findAll({ where: { isbn: { [Op.in]: providedIsbns } }, attributes: ["isbn"], raw: true })
      : [];

    const existingIsbns = new Set(existing.map((x) => String(x.isbn || "").toLowerCase()).filter(Boolean));

    const toInsert = [];
    let skippedCount = 0;
    for (const doc of deduped) {
      if (doc.isbn && existingIsbns.has(doc.isbn.toLowerCase())) {
        skippedCount++;
        continue;
      }
      toInsert.push(doc);
    }

    if (toInsert.length === 0) {
      return res.status(200).json({
        message: "No new books inserted (all duplicates or invalid).",
        insertedCount: 0,
        skippedCount,
        errorCount: errors.length,
        errors,
      });
    }

    const inserted = await Book.bulkCreate(toInsert);

    return res.status(201).json({
      message: "Bulk books import complete.",
      insertedCount: inserted.length,
      skippedCount,
      errorCount: errors.length,
      errors,
    });
  } catch (err) {
    if (err?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        message: "Some records already exist (duplicate isbn).",
      });
    }
    return next(err);
  }
};

export default {
  createBook,
  getBooks,
  updateBook,
  deleteBook,
};

/**
 * PATCH /books/:id/condition
 */
export const updateBookCondition = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!Number.isInteger(Number(id))) {
      return res.status(400).json({ message: "Invalid book id" });
    }

    const allowed = new Set(["available", "borrowed", "lost", "damaged", "archived"]);
    const { status } = req.body;

    if (!status || !allowed.has(status)) {
      return res.status(400).json({
        message: `Invalid status. Must be one of: ${[...allowed].join(", ")}`,
      });
    }

    const book = await Book.findByPk(id);
    if (!book) return res.status(404).json({ message: "Book not found" });

    if (["lost", "damaged", "archived"].includes(status)) {
      book.availableCopies = 0;
    } else if (status === "available" && ["lost", "damaged", "archived"].includes(book.status)) {
      const issuedCount = await Issue.count({ where: { book_id: book.id, status: "Issued" } });
      book.availableCopies = Math.max(0, (book.totalCopies || 1) - issuedCount);
    }

    book.status = status;
    await book.save();

    return res.status(200).json({ data: book });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /books/:id/history
 */
export const getBookHistory = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!Number.isInteger(Number(id))) {
      return res.status(400).json({ message: "Invalid book id" });
    }

    const book = await Book.findByPk(id);
    if (!book) return res.status(404).json({ message: "Book not found" });

    const issues = await Issue.findAll({
      where: { book_id: id },
      include: [{ model: Member, as: "member", attributes: ["first_name", "middle_name", "last_name", "full_name", "email", "code"] }],
      order: [["createdAt", "DESC"]],
    });

    const total = issues.length;
    const lastIssued = issues.find((i) => i.issueDate)?.issueDate ?? null;
    const lastReturned = issues.find((i) => i.returnedAt)?.returnedAt ?? null;

    return res.status(200).json({
      data: issues,
      total,
      last_issued: lastIssued,
      last_returned: lastReturned,
    });
  } catch (err) {
    return next(err);
  }
};
