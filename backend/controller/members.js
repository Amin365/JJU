import mongoose from "mongoose";
import Member from "../module/Members.js"; 

/**
 * Helpers
 */
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Create a new member
 * POST /members
 * Body: { first_name, middle_name, last_name, code?, phone?, email?, date_of_birth?, gender?, region?, join_date? }
 * Response: { data: member }
 */
export const createMember = async (req, res, next) => {
  try {
    const {
      first_name,
      middle_name,
      last_name,
      code,
      phone,
      email,
      date_of_birth,
      gender,
      region,
      join_date,
      department,
      student_id,
      study_year,
    } = req.body;

    if (!first_name || !last_name) {
      return res.status(400).json({ message: "first_name and last_name are required" });
    }

    const member = new Member({
      first_name,
      middle_name,
      last_name,
      code,
      phone,
      email,
      date_of_birth,
      gender,
      region,
      join_date,
      department,
      student_id,
      study_year,

    });

    try {
      const saved = await member.save();
      return res.status(201).json({ data: saved });
    } catch (err) {
      if (err && err.code === 11000) {
        const dupField = Object.keys(err.keyValue || {}).join(", ") || "unique field";
        return res.status(409).json({
          message: `Duplicate ${dupField}: a member with this value already exists.`,
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
 * Get members with pagination, filtering, search and sorting
 * GET /members?page=1&limit=20&sort=-createdAt&q=search&region=...&gender=...&isArchived=true&from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns: { data, total, page, limit, totalPages }
 */
export const getMembers = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = "-createdAt",
      q,
      region,
      gender,
      isArchived,
      from,
      to,
    } = req.query;

    const filter = {};

    if (q) {
      const re = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ first_name: re }, { middle_name: re }, { last_name: re }, { email: re }, { phone: re }, { code: re }];
    }

    if (region) filter.region = region;
    if (gender) filter.gender = gender;
    if (typeof isArchived !== "undefined") {
      // Accept 'true'/'false' strings
      if (isArchived === "true" || isArchived === "1") filter.isArchived = true;
      else if (isArchived === "false" || isArchived === "0") filter.isArchived = false;
    }

    if (from || to) {
      filter.join_date = {};
      if (from) {
        const d = new Date(from);
        if (!Number.isNaN(d.getTime())) filter.join_date.$gte = d;
      }
      if (to) {
        const d = new Date(to);
        if (!Number.isNaN(d.getTime())) filter.join_date.$lte = d;
      }
      if (Object.keys(filter.join_date).length === 0) delete filter.join_date;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.max(1, Math.min(500, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * perPage;

    const [items, total] = await Promise.all([
      Member.find(filter).sort(sort).skip(skip).limit(perPage).lean().exec(),
      Member.countDocuments(filter).exec(),
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

/**
 * Get a single member by id
 * GET /members/:id
 * Returns: { data: member }
 */
export const getMemberById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid member id" });
    }

    const member = await Member.findById(id).lean().exec();
    if (!member) return res.status(404).json({ message: "Member not found" });

    return res.status(200).json({ data: member });
  } catch (err) {
    return next(err);
  }
};

/**
 * Update a member by id
 * PUT /members/:id
 * Body: partial fields to update
 * Returns: { data: updatedMember }
 */
export const updateMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid member id" });
    }

    const update = { ...req.body };
    if (update._id) delete update._id;

    try {
      const updated = await Member.findByIdAndUpdate(id, update, {
        new: true,
        runValidators: true,
        context: "query",
      }).lean().exec();

      if (!updated) return res.status(404).json({ message: "Member not found" });

      return res.status(200).json({ data: updated });
    } catch (err) {
      if (err && err.code === 11000) {
        const dupField = Object.keys(err.keyValue || {}).join(", ") || "unique field";
        return res.status(409).json({
          message: `Duplicate ${dupField}: a member with this value already exists.`,
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
 * Soft-archive a member (mark isArchived = true)
 * POST /members/:id/archive
 */
export const archiveMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid member id" });
    }

    const updated = await Member.findByIdAndUpdate(
      id,
      { isArchived: true },
      { new: true, runValidators: true, context: "query" }
    ).lean().exec();

    if (!updated) return res.status(404).json({ message: "Member not found" });

    return res.status(200).json({ data: updated });
  } catch (err) {
    return next(err);
  }
};

/**
 * Restore archived member (isArchived = false)
 * POST /members/:id/restore
 */
export const restoreMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid member id" });
    }

    const updated = await Member.findByIdAndUpdate(
      id,
      { isArchived: false },
      { new: true, runValidators: true, context: "query" }
    ).lean().exec();

    if (!updated) return res.status(404).json({ message: "Member not found" });

    return res.status(200).json({ data: updated });
  } catch (err) {
    return next(err);
  }
};

/**
 * Delete a member (hard delete)
 * DELETE /members/:id
 */
export const deleteMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid member id" });
    }

    const removed = await Member.findByIdAndDelete(id).lean().exec();
    if (!removed) return res.status(404).json({ message: "Member not found" });

    return res.status(200).json({ message: "Member deleted", id: removed._id });
  } catch (err) {
    return next(err);
  }
};

export default {
  createMember,
  getMembers,
  getMemberById,
  updateMember,
  archiveMember,
  restoreMember,
  deleteMember,
};