import Reservation from "../models/Reservation.js";
import { Op } from "sequelize";
import Book from "../models/Books.js";
import Member from "../models/Members.js";
import User from "../models/user.js";
import Notification from "../models/Notification.js";

const isValidId = (id) => Number.isInteger(Number(id)) && Number(id) > 0;

/**
 * POST /reservations
 * Create a reservation for a book (only allowed when availableCopies == 0).
 */
export const createReservation = async (req, res, next) => {
  try {
    const { book, member } = req.body;

    if (!book || !member) {
      return res.status(400).json({ message: "book and member are required" });
    }
    if (!isValidId(book)) return res.status(400).json({ message: "Invalid book id" });
    if (!isValidId(member)) return res.status(400).json({ message: "Invalid member id" });

    const [bookDoc, memberDoc] = await Promise.all([
      Book.findByPk(Number(book)),
      Member.findByPk(Number(member)),
    ]);

    if (!bookDoc) return res.status(404).json({ message: "Book not found" });
    if (!memberDoc) return res.status(404).json({ message: "Member not found" });

    if ((bookDoc.availableCopies || 0) > 0) {
      return res.status(409).json({
        message: "Book has available copies. Please issue directly instead of reserving.",
      });
    }

    if (["lost", "damaged", "archived"].includes(String(bookDoc.status || "").toLowerCase())) {
      return res.status(409).json({
        message: `Cannot reserve a book with status: ${bookDoc.status}.`,
      });
    }

    const existing = await Reservation.findOne({
      where: {
        book_id: bookDoc.id,
        member_id: memberDoc.id,
        status: "Active",
      },
    });

    if (existing) {
      return res.status(409).json({ message: "You already have an active reservation for this book." });
    }

    const queueLength = await Reservation.count({
      where: { book_id: bookDoc.id, status: "Active" },
    });

    const reservation = await Reservation.create({
      book_id: bookDoc.id,
      member_id: memberDoc.id,
      created_by: req.user?.id || null,
      status: "Active",
    });

    try {
      const memberUser = await User.findOne({
        where: { member_id_fk: memberDoc.id },
        attributes: ["id"],
      });

      if (memberUser?.id) {
        await Notification.create({
          user_id: memberUser.id,
          title: "Reservation confirmed",
          message: `Your reservation for "${bookDoc.title}" is confirmed. Queue position: #${queueLength + 1}.`,
          type: "info",
          meta: { reservation: reservation.id, book: bookDoc.id, kind: "reservation-created" },
        });
      }
    } catch {
      // non-blocking
    }

    const populated = await Reservation.findByPk(reservation.id, {
      include: [
        { model: Book, as: "book", attributes: ["id", "title", "author", "isbn", "status", "book_picture"], required: false },
        { model: Member, as: "member", attributes: ["id", "first_name", "middle_name", "last_name", "email", "code"], required: false },
      ],
    });

    return res.status(201).json({ data: populated, position: queueLength + 1 });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /reservations
 * List reservations. Supports ?book=&member=&status=&page=&limit=
 */
export const getReservations = async (req, res, next) => {
  try {
    const { book, member, status, page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * perPage;

    const where = {};
    if (book && isValidId(book)) where.book_id = Number(book);
    if (member && isValidId(member)) where.member_id = Number(member);
    if (status) where.status = String(status);

    const { rows: items, count: total } = await Reservation.findAndCountAll({
      where,
      include: [
        { model: Book, as: "book", attributes: ["id", "title", "author", "isbn", "status", "book_picture", "availableCopies"], required: false },
        { model: Member, as: "member", attributes: ["id", "first_name", "middle_name", "last_name", "email", "code"], required: false },
        { model: User, as: "creator", attributes: ["id", "first_name", "last_name", "username"], required: false },
      ],
      order: [["createdAt", "DESC"]],
      offset,
      limit: perPage,
    });

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

/**
 * GET /reservations/book/:bookId
 * Get the reservation queue for a specific book.
 */
export const getBookQueue = async (req, res, next) => {
  try {
    const { bookId } = req.params;
    if (!isValidId(bookId)) {
      return res.status(400).json({ message: "Invalid book id" });
    }

    const book = await Book.findByPk(Number(bookId));
    if (!book) return res.status(404).json({ message: "Book not found" });

    const queue = await Reservation.findAll({
      where: { book_id: Number(bookId), status: "Active" },
      include: [
        { model: Member, as: "member", attributes: ["id", "first_name", "middle_name", "last_name", "email", "code"], required: false },
      ],
      order: [["createdAt", "ASC"]], // FIFO
    });

    const queueWithPosition = queue.map((r, i) => ({
      ...(r.toJSON ? r.toJSON() : r),
      position: i + 1,
    }));

    return res.status(200).json({ data: queueWithPosition, total: queue.length });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /reservations/:id/cancel
 */
export const cancelReservation = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid reservation id" });
    }

    const reservation = await Reservation.findByPk(Number(id));
    if (!reservation) return res.status(404).json({ message: "Reservation not found" });

    if (reservation.status !== "Active") {
      return res.status(409).json({ message: `Reservation is already ${reservation.status}` });
    }

    reservation.status = "Cancelled";
    await reservation.save();

    return res.status(200).json({ data: reservation });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /reservations/:id/fulfill
 */
export const fulfillReservation = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid reservation id" });
    }

    const reservation = await Reservation.findByPk(Number(id), {
      include: [
        { model: Book, as: "book", attributes: ["id", "title"], required: false },
        { model: Member, as: "member", attributes: ["id", "first_name", "last_name", "email"], required: false },
      ],
    });

    if (!reservation) return res.status(404).json({ message: "Reservation not found" });

    if (reservation.status !== "Active") {
      return res.status(409).json({ message: `Reservation is already ${reservation.status}` });
    }

    reservation.status = "Fulfilled";
    await reservation.save();

    try {
      const memberUser = await User.findOne({
        where: { member_id_fk: reservation.member?.id || reservation.member_id },
        attributes: ["id"],
      });

      if (memberUser?.id) {
        await Notification.create({
          user_id: memberUser.id,
          title: "Reservation fulfilled",
          message: `Your reservation for "${reservation.book?.title}" has been fulfilled.`,
          type: "success",
          meta: {
            reservation: reservation.id,
            book: reservation.book?.id || reservation.book_id,
            kind: "reservation-fulfilled",
          },
        });
      }
    } catch {
      // non-blocking
    }

    return res.status(200).json({ data: reservation });
  } catch (err) {
    return next(err);
  }
};

/**
 * Notify the next reservation in queue when a book becomes available.
 * Called internally from IssueController when a book is returned.
 */
export async function notifyNextReservation(bookId) {
  try {
    if (!isValidId(bookId)) return;

    const next = await Reservation.findOne({
      where: { book_id: Number(bookId), status: "Active" },
      include: [
        { model: Member, as: "member", attributes: ["id", "first_name", "last_name", "email"], required: false },
        { model: Book, as: "book", attributes: ["id", "title"], required: false },
      ],
      order: [["createdAt", "ASC"]],
    });

    if (!next) return;

    const memberUser = await User.findOne({
      where: { member_id_fk: next.member?.id || next.member_id },
      attributes: ["id"],
    });

    if (memberUser?.id) {
      await Notification.create({
        user_id: memberUser.id,
        title: "Book available!",
        message: `Good news! "${next.book?.title}" is now available for you to pick up. Visit the library to collect your reserved copy.`,
        type: "success",
        meta: {
          reservation: next.id,
          book: next.book?.id || next.book_id,
          kind: "reservation-ready",
        },
      });
    }

    next.notifiedAt = new Date();
    await next.save();
  } catch {
    // non-blocking
  }
}

export default {
  createReservation,
  getReservations,
  getBookQueue,
  cancelReservation,
  fulfillReservation,
  notifyNextReservation,
};