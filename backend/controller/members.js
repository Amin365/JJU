import mongoose from "mongoose";
import crypto from "crypto";
import Member from "../models/Members.js"; 
import Role from "../models/Role.js";
import User from '../models/user.js'
import ModeratorMember from '../models/ModeratorMember.js'
import Clubreq from "../models/Clubreq.js";
import Notification from "../models/Notification.js";
import Issue from "../models/Issue.js";
import DailyReport from "../models/DailyReport.js";
import MemberNote from "../models/MemberNote.js";

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
      // date_of_birth,
      gender,
      region,
      join_date,
      department,
      student_id,
      study_year,
      role, //  ADD THIS
      Profile_picture
    } = req.body;

    if (!first_name || !last_name) {
      return res.status(400).json({ message: "first_name and last_name are required" });
    }

    if (!email) {
      return res.status(400).json({ message: "email is required to create a user automatically" });
    }

    //  Validate role if provided
    if (role) {
      if (!mongoose.Types.ObjectId.isValid(role)) {
        return res.status(400).json({ message: "Invalid role id" });
      }
      const roleExists = await Role.exists({ _id: role });
      if (!roleExists) {
        return res.status(400).json({ message: "Role not found" });
      }
    }

    // Prevent duplicate user email before creating member
    const existingUserByEmail = await User.findOne({ email }).lean().exec();
    if (existingUserByEmail) {
      return res.status(409).json({ message: "Email already exists for another user" });
    }

    const member = new Member({
      first_name,
      middle_name,
      last_name,
      code,
      phone,
      email,
      // date_of_birth,
      gender,
      region,
      join_date,
      department,
      student_id,
      study_year,
      Profile_picture: req.file ? req.file.path : null,
      role: role || null, //  SAVE ROLE
    });

    try {
      const saved = await member.save();

      // Create user automatically with default password
      const baseUsername = String(saved.email || `${saved.first_name}${saved.last_name}`)
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[^a-z0-9._-]/gi, "");

      let username = baseUsername || `user${String(saved._id).slice(-4)}`;
      const existingUsername = await User.findOne({ username }).lean().exec();
      if (existingUsername) {
        username = `${username}-${String(saved._id).slice(-4)}`;
      }

      try {
        await User.create({
          first_name: saved.first_name,
          middle_name: saved.middle_name || "",
          last_name: saved.last_name,
          username,
          email: saved.email,
          password: "jju1234",
          member_id: saved.code || String(saved._id),
          role: saved.role || null,
          status: saved.status || "Active",
          member: saved._id,
          added_by: req.user?._id || null,
          updated_by: req.user?._id || null,
        });
      } catch (userErr) {
        // rollback member if user creation fails
        await Member.findByIdAndDelete(saved._id).exec();
        return res.status(500).json({ message: "Member created but user creation failed" });
      }

      // optional: return populated role for UI
      const populated = await Member.findById(saved._id).populate("role").lean();

      return res.status(201).json({ data: populated });
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



export const getMembers = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      sort = "-createdAt",
      q,
      region,
      city,
      gender,
      isArchived,
      from,
      to,
      department,
      study_year,
      status,
      moderator,
    } = req.query;

    const filter = {};

    if (q) {
      const re = new RegExp(escapeRegex(q), "i");
      filter.$or = [
        { first_name: re },
        { middle_name: re },
        { last_name: re },
        { email: re },
        { phone: re },
        { code: re },
      ];
    }

    if (region) filter.region = region;
    if (city) filter.city = city;
    if (gender) filter.gender = gender;
    if (department) filter.department = new RegExp(escapeRegex(department), "i");
    if (study_year) filter.study_year = study_year;
    if (status && ["Active", "Inactive", "pending"].includes(status)) filter.status = status;

    if (typeof isArchived !== "undefined") {
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

    // Filter by moderator assignment
    if (moderator && mongoose.Types.ObjectId.isValid(moderator)) {
      const assignedIds = await ModeratorMember.find({ moderator }).distinct("member").exec();
      filter._id = { $in: assignedIds };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.max(1, Math.min(500, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * perPage;

    // Explicitly select the fields you want returned.
    // Add any other member fields you need here.
    const selectFields = [
      "first_name",
      "middle_name",
      "last_name",
      "email",
      "phone",
      "code",
      "region",
      "city",
      "gender",
      "join_date",
      "profile_picture",
      "department",
      "student_id",
      "study_year",
      "status",
      "createdAt",
      "_id",
    ].join(" ");

    const [items, total] = await Promise.all([
      Member.find(filter)
        .select(selectFields)
        .populate("role", "role color plural system")
        .sort(sort)
        .skip(skip)
        .limit(perPage)
        .lean()
        .exec(),
      Member.countDocuments(filter).exec(),
    ]);

    // Optional: map/format join_date to ISO or desired format
    const mapped = items.map((it) => ({
      ...it,
      join_date: it.join_date ? new Date(it.join_date).toISOString() : null,
      // ensure profile_picture property exists and is null if missing
      profile_picture: it.profile_picture ?? null,
    }));

    return res.status(200).json({
      data: mapped,
      total,
      page: pageNum,
      limit: perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (err) {
    return next(err);
  }
};




export const updateMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid member id" });
    }

    const update = { ...req.body };
    if (req.file) {
      update.Profile_picture = req.file.path;
    }
    if (update._id) delete update._id;

    //  Validate role if client sends it
    if (Object.prototype.hasOwnProperty.call(update, "role")) {
      if (update.role) {
        if (!mongoose.Types.ObjectId.isValid(update.role)) {
          return res.status(400).json({ message: "Invalid role id" });
        }
        const roleExists = await Role.exists({ _id: update.role });
        if (!roleExists) {
          return res.status(400).json({ message: "Role not found" });
        }
      } else {
        // allow clearing role by sending null/"":
        update.role = null;
      }
    }

    try {
      const updated = await Member.findByIdAndUpdate(id, update, {
        new: true,
        runValidators: true,
        context: "query",
      })
        .populate("role")   //  populate for UI
        .lean()
        .exec();

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


export const getMemberById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid member id" });
    }

    const member = await Member.findById(id)
      .populate("role", "role color plural system") //  add this
      .lean()
      .exec();

    if (!member) return res.status(404).json({ message: "Member not found" });

    return res.status(200).json({ data: member });
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

export const getMemberByCode = async (req, res, next) => {
  try {
    const { code } = req.params;
    if (!code) return res.status(400).json({ message: "MemberId is required" });

    const member = await Member.findOne({ code }).populate("role", "role color").lean().exec();

    if (!member) return res.status(404).json({
      message: "Before requesting a book you must be member of the Club",
    });

    return res.status(200).json({ data: member });
  } catch (err) {
    return next(err);
  }
};
export const getMembersList = async (req, res, next) => {
  try {
    // If requester not authenticated, deny (we require auth for scoped list)
    if (!req.user?._id) return res.status(401).json({ message: "Unauthorized" });

    // determine role of requester
    const currentUser = await User.findById(req.user._id).populate('role', 'role plural').lean().exec();
    const roleName = (currentUser?.role?.role || currentUser?.role?.plural || '').toLowerCase();
    const isSuperAdmin = /super\s*admin/i.test(roleName);
    const isModerator = /moderator/i.test(roleName);

    if (isSuperAdmin) {
      const members = await Member.find()
        .select("_id first_name middle_name last_name full_name code email join_date Profile_picture status region createdAt")
        .sort("-createdAt")
        .lean()
        .exec();
      return res.status(200).json({ data: members });
    }

    if (isModerator) {
      // return only members assigned to this moderator
      const assigned = await ModeratorMember.find({ moderator: req.user._id }).select('member').lean().exec();
      const memberIds = assigned.map(a => a.member).filter(Boolean);
      if (memberIds.length === 0) return res.status(200).json({ data: [] });
      const members = await Member.find({ _id: { $in: memberIds } })
        .select("_id first_name middle_name last_name full_name code email createdAt")
        .sort("-createdAt")
        .lean()
        .exec();
      return res.status(200).json({ data: members });
    }

    // regular users: return only the member record they belong to (if any)
    if (currentUser?.member) {
      const m = await Member.findById(currentUser.member)
        .select("_id first_name middle_name last_name full_name code email createdAt")
        .lean()
        .exec();
      if (!m) return res.status(200).json({ data: [] });
      return res.status(200).json({ data: [m] });
    }

    // fallback: empty
    return res.status(200).json({ data: [] });
  } catch (err) {
    return next(err);
  }
};


const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalize = (v) => (typeof v === "string" ? v.trim() : v);

const normalizeEmail = (v) => {
  const s = normalize(v);
  return s ? String(s).trim().toLowerCase() : "";
};

const toDateOrNull = (v) => {
  if (!v) return null;
  const d = new Date(v);
  // invalid date
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

export const bulkCreateMembers = async (req, res, next) => {
  try {
    const { members } = req.body;

    if (!Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ message: "members must be a non-empty array" });
    }

    // sanitize + basic validation
    const prepared = [];
    const errors = [];

    for (let i = 0; i < members.length; i++) {
      const raw = members[i] || {};

      const first_name = normalize(raw.first_name) || "";
      const last_name = normalize(raw.last_name) || "";
      const middle_name = normalize(raw.middle_name) || "";

      if (!String(first_name).trim() || !String(last_name).trim()) {
        errors.push({ index: i, message: "first_name and last_name are required" });
        continue;
      }

      const email = normalizeEmail(raw.email);
      if (email && !emailRegex.test(email)) {
        errors.push({ index: i, message: `Invalid email: ${email}` });
        continue;
      }

      const doc = {
        first_name: String(first_name).trim(),
        middle_name: String(middle_name).trim(),
        last_name: String(last_name).trim(),
        email: email || "",
        phone: normalize(raw.phone) ? String(raw.phone).trim() : "",
        department: normalize(raw.department) ? String(raw.department).trim() : "",
        student_id: normalize(raw.student_id) ? String(raw.student_id).trim() : "",
        study_year: normalize(raw.study_year) ? String(raw.study_year).trim() : "",
        gender: raw.gender || undefined,
        region: normalize(raw.region) ? String(raw.region).trim() : "",
        city: normalize(raw.city) ? String(raw.city).trim() : "",
        status: raw.status || undefined,
        // date_of_birth: toDateOrNull(raw.date_of_birth),
        join_date: toDateOrNull(raw.join_date) || undefined,
        role: raw.role || undefined, // optional
      };

      // allow optional custom code if you import it; else schema generates it
      if (raw.code && String(raw.code).trim()) doc.code = String(raw.code).trim();

      prepared.push(doc);
    }

    // Deduplicate inside the file payload by email/code
    const seenEmail = new Set();
    const seenCode = new Set();

    const deduped = [];
    for (const doc of prepared) {
      const e = doc.email ? doc.email.toLowerCase() : "";
      const c = doc.code ? doc.code : "";

      if (e && seenEmail.has(e)) continue;
      if (c && seenCode.has(c)) continue;

      if (e) seenEmail.add(e);
      if (c) seenCode.add(c);

      deduped.push(doc);
    }

    // Find existing duplicates in DB
    const emails = deduped.map((d) => d.email).filter(Boolean);
    const codes = deduped.map((d) => d.code).filter(Boolean);

    const existing = await Member.find({
      $or: [
        ...(emails.length ? [{ email: { $in: emails } }] : []),
        ...(codes.length ? [{ code: { $in: codes } }] : []),
      ],
    })
      .select("email code")
      .lean()
      .exec();

    const existingEmails = new Set(existing.map((x) => x.email).filter(Boolean));
    const existingCodes = new Set(existing.map((x) => x.code).filter(Boolean));

    const toInsert = [];
    let skippedCount = 0;

    for (const doc of deduped) {
      const e = doc.email ? doc.email.toLowerCase() : "";
      const c = doc.code ? doc.code : "";

      if ((e && existingEmails.has(e)) || (c && existingCodes.has(c))) {
        skippedCount++;
        continue;
      }
      toInsert.push(doc);
    }

    if (toInsert.length === 0) {
      return res.status(200).json({
        message: "No new members inserted (all duplicates or invalid).",
        insertedCount: 0,
        skippedCount,
        errorCount: errors.length,
        errors,
      });
    }

    // Insert
    const inserted = await Member.insertMany(toInsert, {
      ordered: false, // continue on duplicates
    });

    return res.status(201).json({
      message: `Bulk members import complete.`,
      insertedCount: inserted.length,
      skippedCount,
      errorCount: errors.length,
      errors,
    });
  } catch (err) {
    // If insertMany ordered:false still throws for duplicates, report nicely
    if (err?.code === 11000) {
      return res.status(409).json({
        message: "Some records already exist (duplicate email/code).",
        details: err?.keyValue,
      });
    }
    return next(err);
  }
};




export const JoinClub = async (req, res, next) => {
  try {
    const { FullName, phone, email } = req.body

    // Basic validation
    if (!FullName || !phone || !email) {
      return res.status(400).json({
        message: "Full name, phone, and email are required",
      })
    }

    // Prevent duplicate requests
    const existingRequest = await Clubreq.findOne({ email })
    if (existingRequest) {
      return res.status(409).json({
        message: "A join request with this email already exists",
      })
    }

    const clubRequest = await Clubreq.create({
      FullName,
      phone,
      email,
      status: "Pending",
    })

    return res.status(201).json({
      message: "Join club request submitted successfully",
      data: clubRequest,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Get all join club requests
 * @route   GET /api/join-club
 * @access  Admin
 */
export const getJoinClubs = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status && ["Pending", "Approved", "Rejected"].includes(status)) {
      filter.status = status;
    }
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.max(1, Math.min(200, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * perPage;

    const [requests, total] = await Promise.all([
      Clubreq.find(filter)
        .populate("memberId", "first_name last_name code email")
        .populate("reviewedBy", "first_name last_name username")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(perPage)
        .lean(),
      Clubreq.countDocuments(filter),
    ]);

    return res.status(200).json({
      count: total,
      data: requests,
      page: pageNum,
      limit: perPage,
      totalPages: Math.ceil(total / perPage),
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Get single join club request by ID
 * @route   GET /api/join-club/:id
 * @access  Admin
 */
export const getJoinClubById = async (req, res, next) => {
  try {
    const { id } = req.params

    const request = await Clubreq.findById(id)
      .populate("memberId", "first_name last_name code email")
      .populate("reviewedBy", "first_name last_name username")
      .lean();
    if (!request) {
      return res.status(404).json({
        message: "Join club request not found",
      })
    }

    return res.status(200).json(request)
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Update join club request status (Approve / Reject)
 *          On Approve: creates a Member + User record if not already existing.
 *          On Reject: stores rejectionReason.
 *          In both cases: sends a Notification to the linked user (if any).
 * @route   PATCH /api/join-club/:id/status
 * @access  Admin/Moderator (protected)
 */
export const updateJoinClubStatus = async (req, res, next) => {
  try {
    const { id } = req.params
    const { status, rejectionReason } = req.body

    // Validate status
    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({
        message: "Status must be either Approved or Rejected",
      })
    }

    const clubReq = await Clubreq.findById(id);
    if (!clubReq) {
      return res.status(404).json({ message: "Join club request not found" })
    }

    // Prevent re-processing already decided requests
    if (clubReq.status !== "Pending") {
      return res.status(409).json({ message: `Request is already ${clubReq.status}` })
    }

    const update = {
      status,
      reviewedBy: req.user?._id || null,
      reviewedAt: new Date(),
    };
    if (status === "Rejected" && rejectionReason) {
      update.rejectionReason = String(rejectionReason).trim();
    }

    let createdMember = null;
    let linkedUser = null;

    if (status === "Approved") {
      // Check if a member with this email already exists
      let member = await Member.findOne({ email: clubReq.email }).lean();

      if (!member) {
        // Create member from request data
        const nameParts = clubReq.FullName.trim().split(/\s+/);
        const first_name = nameParts[0] || clubReq.FullName;
        const last_name = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "-";

        const newMember = new Member({
          first_name,
          last_name,
          email: clubReq.email,
          phone: clubReq.phone,
          status: "Active",
        });
        member = await newMember.save();
        createdMember = member;
      }

      update.memberId = member._id;

      // Check if a user with this email already exists
      let user = await User.findOne({ email: clubReq.email }).lean();
      if (!user) {
        // Generate a random temporary password and force reset on next login
        const tempPassword = crypto.randomBytes(12).toString("hex");
        const resetCode = crypto.randomBytes(6).toString("hex").toUpperCase();
        const resetExpires = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours

        const rawBase = clubReq.email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "");
        const baseUsername = rawBase.length > 0 ? rawBase : `user${Date.now().toString().slice(-6)}`;
        let username = baseUsername;
        const existing = await User.findOne({ username }).lean();
        if (existing) username = `${username}-${Date.now().toString().slice(-4)}`;

        const nameParts = clubReq.FullName.trim().split(/\s+/);
        try {
          user = await User.create({
            first_name: nameParts[0] || clubReq.FullName,
            last_name: nameParts.length > 1 ? nameParts.slice(1).join(" ") : "-",
            username,
            email: clubReq.email,
            password: tempPassword,
            member_id: member.code || String(member._id),
            member: member._id,
            status: "pending",
            resetPasswordCode: resetCode,
            resetPasswordExpires: resetExpires,
            added_by: req.user?._id || null,
          });
          linkedUser = user;
        } catch (userErr) {
          // User creation failure is non-fatal; log and continue
          console.error("updateJoinClubStatus: user creation failed", userErr?.message);
        }
      } else {
        linkedUser = user;
      }

      // Send notification to linked user
      if (linkedUser) {
        try {
          await Notification.create({
            user: linkedUser._id,
            title: "Welcome to the Club! 🎉",
            message: `Your join request has been approved. Welcome, ${clubReq.FullName}!`,
            type: "success",
            meta: { kind: "join-request-approved", clubreqId: clubReq._id },
          });
        } catch (_) { /* non-fatal */ }
      }
    } else {
      // Rejected – send notification if user exists
      const existingUser = await User.findOne({ email: clubReq.email }).lean();
      if (existingUser) {
        try {
          await Notification.create({
            user: existingUser._id,
            title: "Join Request Update",
            message: rejectionReason
              ? `Your join request was not approved. Reason: ${rejectionReason}`
              : "Your join request was not approved at this time.",
            type: "warning",
            meta: { kind: "join-request-rejected", clubreqId: clubReq._id },
          });
        } catch (_) { /* non-fatal */ }
      }
    }

    const updatedRequest = await Clubreq.findByIdAndUpdate(id, update, { new: true })
      .populate("memberId", "first_name last_name code email")
      .populate("reviewedBy", "first_name last_name username")
      .lean();

    return res.status(200).json({
      message: `Join request ${status.toLowerCase()} successfully`,
      data: updatedRequest,
      createdMember: createdMember || undefined,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Get aggregated overview for a member (profile timeline)
 * @route   GET /api/members/:id/overview
 * @access  Protected
 */
export const getMemberOverview = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid member id" });
    }

    const member = await Member.findById(id).populate("role", "role plural color").lean();
    if (!member) return res.status(404).json({ message: "Member not found" });

    // Linked user
    const user = await User.findOne({ member: member._id })
      .select("_id username email status role createdAt")
      .populate("role", "role plural")
      .lean();

    // Moderator assignment
    const modAssignment = await ModeratorMember.findOne({ member: member._id })
      .populate("moderator", "_id first_name last_name username email")
      .lean();

    // Issue history
    const issues = await Issue.find({ member: member._id })
      .populate("book", "title author")
      .sort({ issueDate: -1 })
      .lean();

    const overdueCount = issues.filter((i) => i.status === "Overdue").length;
    const issuedCount = issues.filter((i) => i.status === "Issued").length;
    const returnedCount = issues.filter((i) => i.status === "Returned").length;

    // Daily reports (via user)
    let dailyReports = [];
    let reportStreak = 0;
    if (user) {
      dailyReports = await DailyReport.find({ createdBy: user._id })
        .populate("book", "title author")
        .sort({ readingDate: -1 })
        .limit(50)
        .lean();

      // Simple streak: consecutive days with reports going backwards from today (max 365 days)
      const reportDays = new Set(
        dailyReports.map((r) => new Date(r.readingDate).toISOString().slice(0, 10))
      );
      let d = new Date();
      d.setHours(0, 0, 0, 0);
      let maxDays = 365;
      while (maxDays-- > 0 && reportDays.has(d.toISOString().slice(0, 10))) {
        reportStreak++;
        d.setDate(d.getDate() - 1);
      }
    }

    // Notes
    const notes = await MemberNote.find({ member: member._id, isArchived: false })
      .populate("author", "first_name last_name username")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      data: {
        member,
        user: user || null,
        moderatorAssignment: modAssignment || null,
        issues: {
          list: issues,
          total: issues.length,
          overdueCount,
          issuedCount,
          returnedCount,
        },
        dailyReports: {
          list: dailyReports,
          total: dailyReports.length,
          streak: reportStreak,
        },
        notes,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * @desc    Add an internal note to a member
 * @route   POST /api/members/:id/notes
 * @access  Protected (moderator/admin)
 */
export const createMemberNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid member id" });
    }
    const { note, category } = req.body;
    if (!note || !String(note).trim()) {
      return res.status(400).json({ message: "note text is required" });
    }
    const memberExists = await Member.exists({ _id: id });
    if (!memberExists) return res.status(404).json({ message: "Member not found" });

    const created = await MemberNote.create({
      member: id,
      author: req.user._id,
      note: String(note).trim(),
      category: category ? String(category).trim() : "",
    });

    const populated = await MemberNote.findById(created._id)
      .populate("author", "first_name last_name username")
      .lean();

    return res.status(201).json({ data: populated });
  } catch (err) {
    return next(err);
  }
}

/**
 * @desc    List notes for a member
 * @route   GET /api/members/:id/notes
 * @access  Protected
 */
export const getMemberNotes = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid member id" });
    }
    const notes = await MemberNote.find({ member: id, isArchived: false })
      .populate("author", "first_name last_name username")
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ data: notes });
  } catch (err) {
    return next(err);
  }
}

/**
 * @desc    Delete (archive) a note
 * @route   DELETE /api/members/:id/notes/:noteId
 * @access  Protected
 */
export const deleteMemberNote = async (req, res, next) => {
  try {
    const { id, noteId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(noteId)) {
      return res.status(400).json({ message: "Invalid id" });
    }
    const note = await MemberNote.findOne({ _id: noteId, member: id });
    if (!note) return res.status(404).json({ message: "Note not found" });

    note.isArchived = true;
    await note.save();
    return res.status(200).json({ message: "Note removed" });
  } catch (err) {
    return next(err);
  }
}

export default {
  createMember,
  getMembers,
  getMemberById,
  updateMember,
  archiveMember,
  restoreMember,
  deleteMember,
  getMemberByCode,
  getMembersList
};