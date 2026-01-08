import mongoose from "mongoose";
import User from "../models/user.js";

import Member from "../models/Members.js";

export const createUserFromMember = async (req, res, next) => {
  try {
    const { member, username, password } = req.body;

    if (!member) return res.status(400).json({ message: "member is required" });
    if (!username) return res.status(400).json({ message: "username is required" });
    if (!password || password.length < 6) {
      return res.status(400).json({ message: "password must be at least 6 characters" });
    }

    if (!mongoose.Types.ObjectId.isValid(member)) {
      return res.status(400).json({ message: "Invalid member id" });
    }

    // 1) fetch member (we need name/email/role)
    const m = await Member.findById(member).lean().exec();
    if (!m) return res.status(404).json({ message: "Member not found" });

    if (!m.email) {
      return res.status(400).json({ message: "Selected member must have an email to create a user." });
    }

    // 2) block duplicates (member already has user)
    const existingForMember = await User.findOne({ member: m._id }).lean().exec();
    if (existingForMember) {
      return res.status(409).json({ message: "This member already has a user account" });
    }

    // 3) block duplicate username/email
    const [existingUsername, existingEmail] = await Promise.all([
      User.findOne({ username }).lean().exec(),
      User.findOne({ email: m.email }).lean().exec(),
    ]);

    if (existingUsername) return res.status(409).json({ message: "Username already exists" });
    if (existingEmail) return res.status(409).json({ message: "Email already exists" });

    // 4) create user (password hashing happens in pre-save)
    const user = await User.create({
      first_name: m.first_name,
      middle_name: m.middle_name || "",
      last_name: m.last_name,
      username,
      email: m.email,
      password,                 // plaintext ok here -> will be hashed by pre-save
      member_id: m.code || String(m._id), // optional mapping
      role: m.role || null,      // ✅ role copied from member
      member: m._id,             // ✅ relation user -> member

      // optional audit fields (if you have auth middleware)
      added_by: req.user?._id || null,
      updated_by: req.user?._id || null,
    });

    // 5) return populated
    const populated = await User.findById(user._id)
      .populate("role", "role color plural system")
      .populate("member", "first_name middle_name last_name full_name email phone code role")
      .lean()
      .exec();

    return res.status(201).json({ data: populated });
  } catch (err) {
    // handle duplicate key nicely
    if (err && err.code === 11000) {
      const dupField = Object.keys(err.keyValue || {}).join(", ") || "unique field";
      return res.status(409).json({
        message: `Duplicate ${dupField}: already exists.`,
        details: err.keyValue || null,
      });
    }
    return next(err);
  }
};
export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const user = await User.findById(id)
      .populate("role", "role color plural system")
      .populate("member", "first_name middle_name last_name full_name email phone code role")
      .lean()
      .exec();

    if (!user) return res.status(404).json({ message: "User not found" });

    return res.status(200).json({ data: user });
  } catch (err) {
    return next(err);
  }
};
export const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, sort = "-createdAt", q } = req.query;

    const filter = {};
    if (q) {
      const re = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { username: re },
        { email: re },
        { first_name: re },
        { middle_name: re },
        { last_name: re },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.max(1, Math.min(200, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * perPage;

    const [items, total] = await Promise.all([
      User.find(filter)
        .populate("role", "role color plural system")
        .populate("member", "first_name middle_name last_name full_name email phone code role")
        .sort(sort)
        .skip(skip)
        .limit(perPage)
        .lean()
        .exec(),
      User.countDocuments(filter).exec(),
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

// List members that do NOT yet have a user account
export const getAvailableMembersForUserCreation = async (req, res, next) => {
  try {
    const { q, page = 1, limit = 50, sort = "-createdAt" } = req.query;

    // Collect all member ids that already have users
    const userMemberDocs = await User.find({}, "member").lean().exec();
    const usedMemberIds = new Set(
      userMemberDocs
        .map((u) => u.member)
        .filter(Boolean)
        .map((id) => String(id))
    );

    const filter = {};
    if (q) {
      const re = new RegExp(String(q).replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { first_name: re },
        { middle_name: re },
        { last_name: re },
        { email: re },
        { phone: re },
        { code: re },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * perPage;

    // Query members and filter out those with existing users
    const allMembers = await Member.find(filter)
      .select("_id first_name middle_name last_name full_name code email createdAt role")
      .sort(sort)
      .lean()
      .exec();

    const available = allMembers.filter((m) => !usedMemberIds.has(String(m._id)));

    const paged = available.slice(skip, skip + perPage);

    return res.status(200).json({
      data: paged,
      total: available.length,
      page: pageNum,
      limit: perPage,
      totalPages: Math.ceil(available.length / perPage),
    });
  } catch (err) {
    return next(err);
  }
};