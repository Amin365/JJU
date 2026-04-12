import Issue from "../models/Issue.js";
import { Op } from "sequelize";
import Book from "../models/Books.js";
import Member from "../models/Members.js";
import User from "../models/user.js";
import Role from "../models/Role.js";
import ModeratorMember from "../models/ModeratorMember.js";
import Notification from "../models/Notification.js";
import { sendMail, buildEmailHtml } from "../controller/EmailController.js";
import { sendPushToUser } from "../utility/push.js";
import { checkBorrowingRules } from "../utility/borrowingRules.js";
import { notifyNextReservation } from "../controller/ReservationController.js";
import { logIssueAction } from "../utility/auditLog.js";

const escapeLike = (s) =>
  String(s)
    .replace(/\\/g, "\\\\")
    .replace(/[%_]/g, "\\$&");

const isValidId = (id) => Number.isInteger(Number(id)) && Number(id) > 0;

const roleNameOf = (user) =>
  String(user?.role?.role || user?.role?.plural || "").toLowerCase();

const isSuperAdmin = (user) => /super\s*admin/i.test(roleNameOf(user));
const isModerator = (user) => /moderator/i.test(roleNameOf(user));

const hasAnyPermission = (req, perms = []) => {
  const userPerms = new Set((req.user?.permissions || []).map((p) => String(p).toLowerCase()));
  return perms.some((p) => userPerms.has(String(p).toLowerCase()));
};

const canManageIssues = (req) => hasAnyPermission(req, ["Manage Issues"]);

export const IssueCreate = async (req, res, next) => {
  try {
    if (!req.user?.id || !canManageIssues(req)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { book, member, issueDate, returnDate } = req.body;

    if (!book || !member || !issueDate || !returnDate) {
      return res
        .status(400)
        .json({ message: "book, member, issueDate and returnDate are required" });
    }

    if (!isValidId(book)) return res.status(400).json({ message: "Invalid book id" });
    if (!isValidId(member)) return res.status(400).json({ message: "Invalid member id" });

    const [bookDoc, memberDoc] = await Promise.all([
      Book.findByPk(Number(book)),
      Member.findByPk(Number(member)),
    ]);

    if (!memberDoc) {
      return res.status(404).json({
        message: "Member not found. Before requesting a book you must be member of the Club",
      });
    }
    if (!bookDoc) return res.status(404).json({ message: "Book not found" });

    const { allowed, reason } = await checkBorrowingRules(memberDoc.id);
    if (!allowed) return res.status(409).json({ message: reason });

    // Atomic decrement via conditional update
    const [affected] = await Book.update(
      { availableCopies: (bookDoc.availableCopies || 0) - 1 },
      {
        where: {
          id: bookDoc.id,
          availableCopies: { [Op.gt]: 0 },
        },
      }
    );

    if (!affected) {
      return res.status(409).json({ message: "No available copies for this book" });
    }

    const updatedBook = await Book.findByPk(bookDoc.id);
    if (!updatedBook) return res.status(404).json({ message: "Book not found after update" });

    updatedBook.status = (updatedBook.availableCopies || 0) <= 0 ? "borrowed" : "available";
    await updatedBook.save();

    const issue = await Issue.create({
      book_id: updatedBook.id,
      member_id: memberDoc.id,
      issueDate: new Date(issueDate),
      returnDate: new Date(returnDate),
      status: "Issued",
    });

    const populated = await Issue.findByPk(issue.id, {
      include: [
        {
          model: Book,
          as: "book",
          attributes: ["id", "title", "author", "isbn", "status", "book_picture"],
          required: false,
        },
        {
          model: Member,
          as: "member",
          attributes: ["id", "first_name", "middle_name", "last_name", "email", "code"],
          required: false,
        },
      ],
    });

    await logIssueAction("created", populated, req.user, req, {
      description: `Book "${bookDoc.title}" issued to "${memberDoc.first_name} ${memberDoc.last_name}"`,
    });

    try {
      const memberUser = await User.findOne({
        where: { member_id: memberDoc.id },
        attributes: ["id"],
      });

      if (memberUser?.id) {
        await Notification.create({
          user_id: memberUser.id,
          title: "Book issued",
          message: `${bookDoc.title} has been issued to you. Due on ${new Date(returnDate).toLocaleDateString()}.`,
          type: "success",
          meta: { issue: issue.id, kind: "issued" },
        });
      }
    } catch {
      // non-blocking
    }

    return res.status(201).json({ data: populated });
  } catch (err) {
    return next(err);
  }
};

export const getIssues = async (req, res, next) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });

    const canViewScoped = hasAnyPermission(req, ["View Members", "Manage Issues"]);
    if (!canViewScoped) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { page = 1, limit = 20, q, status } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.min(500, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * perPage;

    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });

    const currentUser = await User.findByPk(req.user.id, {
      attributes: ["id", "member_id", "role_id"],
      include: [{ model: Role, as: "role", attributes: ["role", "plural"], required: false }],
    });

    if (!currentUser) return res.status(401).json({ message: "Unauthorized" });

    const where = {};
    if (status) where.status = status;

    // Role-based scope
    if (isModerator(currentUser) && !isSuperAdmin(currentUser)) {
      const assigned = await ModeratorMember.findAll({
        where: { moderator_id: req.user.id },
        attributes: ["member_id"],
        raw: true,
      });

      const memberIds = assigned.map((a) => a.member_id).filter((id) => isValidId(id));
      if (!memberIds.length) {
        return res.status(200).json({
          data: [],
          total: 0,
          page: pageNum,
          totalPages: 0,
          limit: perPage,
        });
      }

      where.member_id = { [Op.in]: memberIds };
    } else if (!isSuperAdmin(currentUser)) {
      if (!isValidId(currentUser.member_id)) {
        return res.status(200).json({
          data: [],
          total: 0,
          page: pageNum,
          totalPages: 0,
          limit: perPage,
        });
      }
      where.member_id = currentUser.member_id;
    }

    // Search by member code / name / book title / isbn
    let memberIdsFromSearch = null;
    let bookIdsFromSearch = null;

    if (q) {
      const qv = `%${escapeLike(q)}%`;

      const [members, books] = await Promise.all([
        Member.findAll({
          where: {
            [Op.or]: [
              { code: { [Op.like]: qv } },
              { first_name: { [Op.like]: qv } },
              { last_name: { [Op.like]: qv } },
              // { full_name: { [Op.like]: qv } },
            ],
          },
          attributes: ["id"],
          raw: true,
        }),
        Book.findAll({
          where: {
            [Op.or]: [{ title: { [Op.like]: qv } }, { isbn: { [Op.like]: qv } }],
          },
          attributes: ["id"],
          raw: true,
        }),
      ]);

      memberIdsFromSearch = members.map((m) => m.id);
      bookIdsFromSearch = books.map((b) => b.id);

      if (!memberIdsFromSearch.length && !bookIdsFromSearch.length) {
        return res.status(200).json({
          data: [],
          total: 0,
          page: pageNum,
          totalPages: 0,
          limit: perPage,
        });
      }

      where[Op.or] = [
        ...(memberIdsFromSearch.length ? [{ member_id: { [Op.in]: memberIdsFromSearch } }] : []),
        ...(bookIdsFromSearch.length ? [{ book_id: { [Op.in]: bookIdsFromSearch } }] : []),
      ];
    }

    const { rows: items, count: total } = await Issue.findAndCountAll({
      where,
      include: [
        {
          model: Book,
          as: "book",
          attributes: ["id", "title", "author", "isbn", "status", "book_picture", "availableCopies"],
          required: false,
        },
        {
          model: Member,
          as: "member",
          attributes: ["id", "first_name", "middle_name", "last_name", "email", "code"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
      offset,
      limit: perPage,
    });

    // borrowed counts by book
    const bookIds = [...new Set(items.map((it) => it.book?.id).filter(Boolean))];
    if (bookIds.length) {
      const issueRows = await Issue.findAll({
        where: { book_id: { [Op.in]: bookIds }, status: "Issued" },
        attributes: ["book_id"],
        raw: true,
      });

      const borrowedMap = issueRows.reduce((acc, row) => {
        acc[row.book_id] = (acc[row.book_id] || 0) + 1;
        return acc;
      }, {});

      items.forEach((it) => {
        if (it.book) {
          it.book.setDataValue("borrowedCount", borrowedMap[it.book.id] || 0);
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
    if (!req.user?.id || !canManageIssues(req)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid issue id" });

    const issue = await Issue.findByPk(Number(id));
    if (!issue) return res.status(404).json({ message: "Issue not found" });

    if (issue.status === "Returned") {
      return res.status(409).json({ message: "Issue already returned" });
    }

    issue.status = "Returned";
    issue.returnedAt = new Date();
    await issue.save();

    const bookDoc = await Book.findByPk(issue.book_id);
    if (bookDoc) {
      const nextAvailable = (bookDoc.availableCopies || 0) + 1;
      const tc = Number(bookDoc.totalCopies) || 0;

      bookDoc.availableCopies = tc > 0 ? Math.min(nextAvailable, tc) : nextAvailable;
      if (bookDoc.availableCopies > 0) bookDoc.status = "available";
      await bookDoc.save();
    }

    const populated = await Issue.findByPk(issue.id, {
      include: [
        {
          model: Book,
          as: "book",
          attributes: ["id", "title", "author", "isbn", "status", "book_picture"],
          required: false,
        },
        {
          model: Member,
          as: "member",
          attributes: ["id", "first_name", "middle_name", "last_name", "email", "code"],
          required: false,
        },
      ],
    });

    await logIssueAction("returned", populated, req.user, req, {
      description: `Book "${bookDoc?.title || "Unknown"}" was returned`,
    });

    try {
      const memberUser = await User.findOne({
        where: { member_id: issue.member_id },
        attributes: ["id"],
      });
      if (memberUser?.id) {
        await Notification.create({
          user_id: memberUser.id,
          title: "Book returned",
          message: `Thank you for returning "${bookDoc?.title || "your book"}".`,
          type: "success",
          meta: { issue: issue.id, kind: "returned" },
        });
      }
    } catch {
      // non-blocking
    }

    await notifyNextReservation(issue.book_id);

    return res.status(200).json({ data: populated });
  } catch (err) {
    return next(err);
  }
};

export const getMyIssues = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findByPk(userId, { attributes: ["member_id"] });
    if (!user?.member_id) {
      return res.status(400).json({ message: "User is not linked to a member" });
    }

    const issues = await Issue.findAll({
      where: { member_id: user.member_id },
      include: [
        {
          model: Book,
          as: "book",
          attributes: ["id", "title", "author", "isbn", "status", "totalPages", "book_picture"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({ data: issues });
  } catch (err) {
    return next(err);
  }
};

// POST /issues/:id/reminder
export const ReminderEmail = async (req, res) => {
  try {
    if (!req.user?.id || !canManageIssues(req)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid issue id" });

    const issue = await Issue.findByPk(Number(id), {
      include: [
        {
          model: Member,
          as: "member",
          attributes: ["id", "first_name", "last_name", "email"],
          required: false,
        },
        {
          model: Book,
          as: "book",
          attributes: ["id", "title"],
          required: false,
        },
      ],
    });

    if (!issue) return res.status(404).json({ message: "Issue not found" });
    if (issue.status === "Returned") {
      return res.status(400).json({ message: "Book already returned" });
    }

    const memberUser = issue.member;
    if (!memberUser?.id) return res.status(400).json({ message: "Member not found" });

    const memberName = `${memberUser.first_name || "Member"} ${memberUser.last_name || ""}`.trim();
    const bookTitle = issue.book?.title || "the book";

    await sendPushToUser(memberUser.id, {
      title: "📕 Book Return Reminder",
      body: `"${bookTitle}" is still not returned.`,
      icon: "/jjuclub.png",
      data: { issueId: issue.id, url: "/my-books" },
    });

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

export default {
  IssueCreate,
  getIssues,
  markIssueReturned,
  getMyIssues,
  ReminderEmail,
};