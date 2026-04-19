import IssueRequest from "../models/IssueRequest.js";
import { Op } from "sequelize";
import Issue from "../models/Issue.js";
import Book from "../models/Books.js";
import Member from "../models/Members.js";
import User from "../models/user.js";
import Role from "../models/Role.js";
import ModeratorMember from "../models/ModeratorMember.js";
import Notification from "../models/Notification.js";
import { checkBorrowingRules, MAX_BORROW_DAYS } from "../utility/borrowingRules.js";

const isValidId = (id) => Number.isInteger(Number(id)) && Number(id) > 0;

const roleNameOf = (user) =>
  String(user?.role?.role || user?.role?.plural || "").toLowerCase();

const isSuperAdmin = (user) => /super\s*admin/i.test(roleNameOf(user));
const isModerator = (user) => /moderator/i.test(roleNameOf(user));

const hasAnyPermission = (req, perms = []) => {
  const userPerms = new Set((req.user?.permissions || []).map((p) => String(p).toLowerCase()));
  return perms.some((p) => userPerms.has(String(p).toLowerCase()));
};

const hasPrivilegedRole = (req) => {
  const roleName = String(req.user?.role?.role || req.user?.role?.plural || req.user?.role || "").toLowerCase();
  return /super\s*admin/i.test(roleName) || /moderator/i.test(roleName) || /admin/i.test(roleName);
};

const canReviewIssueRequests = (req) =>
  hasPrivilegedRole(req) || hasAnyPermission(req, ["Manage Issues", "Manage Members"]);

const getLinkedMemberId = async (userId) => {
  if (!userId) return null;
  const user = await User.findByPk(Number(userId), { attributes: ["id", "member_id", "member_id_fk"], raw: true });
  return user?.member_id_fk || user?.member_id || null;
};

const withIncludes = (extra = {}) => ({
  ...extra,
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
    {
      model: User,
      as: "requestedBy",
      attributes: ["id", "first_name", "last_name", "username"],
      required: false,
    },
    {
      model: User,
      as: "reviewedBy",
      attributes: ["id", "first_name", "last_name", "username"],
      required: false,
    },
  ],
});

/**
 * POST /issue-requests
 * Member or admin creates a borrow request.
 */
export const createIssueRequest = async (req, res, next) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });

    const { book, member, requestedDays = 7, note } = req.body;

    if (!book || !member) {
      return res.status(400).json({ message: "book and member are required" });
    }
    if (!isValidId(book)) return res.status(400).json({ message: "Invalid book id" });
    if (!isValidId(member)) return res.status(400).json({ message: "Invalid member id" });

    const days = Math.min(Math.max(1, parseInt(requestedDays, 10) || 7), MAX_BORROW_DAYS);

    const [bookDoc, memberDoc] = await Promise.all([
      Book.findByPk(Number(book)),
      Member.findByPk(Number(member)),
    ]);

    if (!bookDoc) return res.status(404).json({ message: "Book not found" });
    if (!memberDoc) return res.status(404).json({ message: "Member not found" });

    if (!canReviewIssueRequests(req)) {
      const linkedMemberId = await getLinkedMemberId(req.user.id);
      if (!linkedMemberId || Number(linkedMemberId) !== Number(memberDoc.id)) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    const { allowed, reason } = await checkBorrowingRules(memberDoc.id);
    if (!allowed) return res.status(409).json({ message: reason });

    const duplicate = await IssueRequest.findOne({
      where: {
        book_id: bookDoc.id,
        member_id: memberDoc.id,
        status: "Requested",
      },
    });

    if (duplicate) {
      return res.status(409).json({ message: "You already have a pending request for this book." });
    }

    const request = await IssueRequest.create({
      book_id: bookDoc.id,
      member_id: memberDoc.id,
      requested_by: req.user?.id || null,
      status: "Requested",
      requestedDays: days,
      note: note || null,
    });

    const populated = await IssueRequest.findByPk(request.id, withIncludes());

    // Notify super admins
    try {
      const superAdminRoles = await Role.findAll({
        where: {
          [Op.or]: [
            { role: { [Op.like]: "%super%admin%" } },
            { plural: { [Op.like]: "%super%admin%" } },
          ],
        },
        attributes: ["id"],
        raw: true,
      });

      const roleIds = superAdminRoles.map((r) => r.id);
      if (roleIds.length) {
        const superAdmins = await User.findAll({
          where: { role_id: { [Op.in]: roleIds } },
          attributes: ["id"],
          raw: true,
        });

        if (superAdmins.length) {
          await Notification.bulkCreate(
            superAdmins.map((admin) => ({
              user_id: admin.id,
              title: "New book request",
              message: `${memberDoc.first_name} ${memberDoc.last_name} requested "${bookDoc.title}".`,
              type: "info",
              meta: {
                request: request.id,
                book: bookDoc.id,
                member: memberDoc.id,
                kind: "request-created",
              },
            }))
          );
        }
      }
    } catch {
      // non-blocking
    }

    return res.status(201).json({ data: populated });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /issue-requests
 * List requests with role-based scoping.
 */
export const getIssueRequests = async (req, res, next) => {
  try {
    const { status, book, member, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * perPage;

    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });

    const currentUser = await User.findByPk(req.user.id, {
      attributes: ["id", "member_id", "member_id_fk", "role_id"],
      include: [{ model: Role, as: "role", attributes: ["role", "plural"], required: false }],
    });

    if (!currentUser) return res.status(401).json({ message: "Unauthorized" });

    const where = {};
    if (status) where.status = status;
    if (book && isValidId(book)) where.book_id = Number(book);

    if (isSuperAdmin(currentUser)) {
      if (member && isValidId(member)) where.member_id = Number(member);
    } else if (isModerator(currentUser)) {
      const assigned = await ModeratorMember.findAll({
        where: { moderator_id: req.user.id },
        attributes: ["member_id"],
        raw: true,
      });

      const memberIds = assigned.map((a) => a.member_id).filter(Boolean);
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
    } else {
      const linkedMemberId = Number(currentUser.member_id_fk || currentUser.member_id || 0);
      if (!isValidId(linkedMemberId)) {
        return res.status(200).json({
          data: [],
          total: 0,
          page: pageNum,
          totalPages: 0,
          limit: perPage,
        });
      }
      where.member_id = linkedMemberId;
    }

    const { rows: items, count: total } = await IssueRequest.findAndCountAll(
      withIncludes({
        where,
        order: [["createdAt", "DESC"]],
        offset,
        limit: perPage,
      })
    );

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
 * PATCH /issue-requests/:id/approve
 */
export const approveIssueRequest = async (req, res, next) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });
    if (!canReviewIssueRequests(req)) return res.status(403).json({ message: "Access denied" });

    const { id } = req.params;
    const { reviewNote } = req.body;

    if (!isValidId(id)) return res.status(400).json({ message: "Invalid request id" });

    const request = await IssueRequest.findByPk(Number(id), withIncludes());
    if (!request) return res.status(404).json({ message: "Request not found" });

    if (request.status !== "Requested") {
      return res.status(409).json({ message: `Request is already ${request.status}` });
    }

    request.status = "Approved";
    request.reviewed_by = req.user?.id || null;
    request.reviewedAt = new Date();
    if (reviewNote) request.reviewNote = reviewNote;
    await request.save();

    try {
      const memberUser = await User.findOne({
        where: { member_id: request.member?.id || request.member_id },
        attributes: ["id"],
      });

      if (memberUser?.id) {
        await Notification.create({
          user_id: memberUser.id,
          title: "Request approved",
          message: `Your request for "${request.book?.title}" has been approved. Visit the library to collect.`,
          type: "success",
          meta: { request: request.id, book: request.book?.id || request.book_id, kind: "request-approved" },
        });
      }
    } catch {
      // non-blocking
    }

    const populated = await IssueRequest.findByPk(request.id, withIncludes());
    return res.status(200).json({ data: populated });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /issue-requests/:id/reject
 */
export const rejectIssueRequest = async (req, res, next) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });
    if (!canReviewIssueRequests(req)) return res.status(403).json({ message: "Access denied" });

    const { id } = req.params;
    const { reviewNote } = req.body;

    if (!isValidId(id)) return res.status(400).json({ message: "Invalid request id" });

    const request = await IssueRequest.findByPk(Number(id), withIncludes());
    if (!request) return res.status(404).json({ message: "Request not found" });

    if (request.status !== "Requested") {
      return res.status(409).json({ message: `Request is already ${request.status}` });
    }

    request.status = "Rejected";
    request.reviewed_by = req.user?.id || null;
    request.reviewedAt = new Date();
    if (reviewNote) request.reviewNote = reviewNote;
    await request.save();

    try {
      const memberUser = await User.findOne({
        where: { member_id: request.member?.id || request.member_id },
        attributes: ["id"],
      });

      if (memberUser?.id) {
        await Notification.create({
          user_id: memberUser.id,
          title: "Request rejected",
          message: `Your request for "${request.book?.title}" was not approved.${reviewNote ? ` Reason: ${reviewNote}` : ""}`,
          type: "warning",
          meta: { request: request.id, book: request.book?.id || request.book_id, kind: "request-rejected" },
        });
      }
    } catch {
      // non-blocking
    }

    const populated = await IssueRequest.findByPk(request.id, withIncludes());
    return res.status(200).json({ data: populated });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /issue-requests/:id/cancel
 */
export const cancelIssueRequest = async (req, res, next) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid request id" });

    const request = await IssueRequest.findByPk(Number(id), withIncludes());
    if (!request) return res.status(404).json({ message: "Request not found" });

    if (!["Requested", "Approved"].includes(request.status)) {
      return res.status(409).json({ message: `Cannot cancel a request with status: ${request.status}` });
    }

    if (!canReviewIssueRequests(req)) {
      const linkedMemberId = await getLinkedMemberId(req.user.id);
      const isOwnerByMember = linkedMemberId && Number(linkedMemberId) === Number(request.member_id || request.member?.id);
      const isRequester = req.user.id && Number(req.user.id) === Number(request.requested_by);
      if (!isOwnerByMember && !isRequester) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    request.status = "Cancelled";
    await request.save();

    const populated = await IssueRequest.findByPk(request.id, withIncludes());
    return res.status(200).json({ data: populated });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /issue-requests/:id/issue
 * Admin converts an approved request into an actual issue.
 */
export const convertToIssue = async (req, res, next) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });
    if (!canReviewIssueRequests(req)) return res.status(403).json({ message: "Access denied" });

    const { id } = req.params;
    const { issueDate, returnDate } = req.body;

    if (!isValidId(id)) return res.status(400).json({ message: "Invalid request id" });
    if (!issueDate || !returnDate) {
      return res.status(400).json({ message: "issueDate and returnDate are required" });
    }

    const request = await IssueRequest.findByPk(Number(id), withIncludes());
    if (!request) return res.status(404).json({ message: "Request not found" });

    if (request.status !== "Approved") {
      return res.status(409).json({ message: "Only approved requests can be converted to issues." });
    }

    const issueDt = new Date(issueDate);
    const returnDt = new Date(returnDate);
    const diffDays = Math.round((returnDt.getTime() - issueDt.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return res.status(400).json({ message: "Return date must be after issue date" });
    }
    if (diffDays > MAX_BORROW_DAYS) {
      return res.status(400).json({ message: `Return date must be within ${MAX_BORROW_DAYS} days` });
    }

    const memberId = request.member?.id || request.member_id;
    const bookId = request.book?.id || request.book_id;

    const { allowed, reason } = await checkBorrowingRules(memberId);
    if (!allowed) {
      return res.status(409).json({ message: `Cannot issue: ${reason}` });
    }

    // Atomic decrement
    const bookDoc = await Book.findByPk(bookId);
    if (!bookDoc) return res.status(404).json({ message: "Book not found" });

    const [affected] = await Book.update(
      { availableCopies: (bookDoc.availableCopies || 0) - 1 },
      { where: { id: bookDoc.id, availableCopies: { [Op.gt]: 0 } } }
    );

    if (!affected) {
      return res.status(409).json({ message: "No available copies for this book" });
    }

    const updatedBook = await Book.findByPk(bookDoc.id);
    if (!updatedBook) return res.status(404).json({ message: "Book not found after update" });

    updatedBook.status = (updatedBook.availableCopies || 0) <= 0 ? "borrowed" : "available";
    await updatedBook.save();

    const issue = await Issue.create({
      book_id: bookId,
      member_id: memberId,
      issueDate: issueDt,
      returnDate: returnDt,
      status: "Issued",
    });

    request.status = "Issued";
    request.issueId = issue.id;
    await request.save();

    try {
      const memberUser = await User.findOne({
        where: { member_id: memberId },
        attributes: ["id"],
      });

      if (memberUser?.id) {
        await Notification.create({
          user_id: memberUser.id,
          title: "Book issued",
          message: `"${request.book?.title}" has been issued to you. Due on ${returnDt.toLocaleDateString()}.`,
          type: "success",
          meta: { issue: issue.id, request: request.id, kind: "issued" },
        });
      }
    } catch {
      // non-blocking
    }

    const populatedIssue = await Issue.findByPk(issue.id, {
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
          attributes: ["id", "first_name", "middle_name", "last_name",  "email", "code"],
          required: false,
        },
      ],
    });

    return res.status(201).json({ data: populatedIssue });
  } catch (err) {
    return next(err);
  }
};

export default {
  createIssueRequest,
  getIssueRequests,
  approveIssueRequest,
  rejectIssueRequest,
  cancelIssueRequest,
  convertToIssue,
};