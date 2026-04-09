import crypto from "crypto";
import { Op } from "sequelize";
import Member from "../models/Members.js";
import Role from "../models/Role.js";
import User from "../models/user.js";
import ModeratorMember from "../models/ModeratorMember.js";
import Clubreq from "../models/Clubreq.js";
import Notification from "../models/Notification.js";
import Issue from "../models/Issue.js";
import DailyReport from "../models/DailyReport.js";
import MemberNote from "../models/MemberNote.js";
import { logMemberAction, logUserAction } from "../utility/auditLog.js";
import { sendMail } from "./EmailController.js";
import {
  joinApprovalTemplate,
  joinRejectionTemplate,
  welcomeEmailTemplate,
} from "../utility/emailTemplates.js";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalize = (v) => (typeof v === "string" ? v.trim() : v);
const normalizeEmail = (v) => {
  const s = normalize(v);
  return s ? String(s).trim().toLowerCase() : "";
};
const toDateOrNull = (v) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};
const isValidId = (id) => Number.isInteger(Number(id)) && Number(id) > 0;

async function findDefaultMemberRole() {
  return Role.findOne({
    where: {
      [Op.or]: [
        { role: { [Op.regexp]: "^[Mm]embers?$" } },
        { plural: { [Op.regexp]: "^[Mm]embers?$" } },
      ],
    },
    attributes: ["id", "role", "plural"],
  });
}

/**
 * POST /members
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
      gender,
      region,
      join_date,
      department,
      student_id,
      study_year,
      role,
      Profile_picture,
    } = req.body;

    if (!first_name || !last_name) {
      return res.status(400).json({ message: "first_name and last_name are required" });
    }

    if (!email) {
      return res.status(400).json({ message: "email is required to create a user automatically" });
    }

    if (role) {
      if (!isValidId(role)) return res.status(400).json({ message: "Invalid role id" });
      const roleExists = await Role.findByPk(Number(role));
      if (!roleExists) return res.status(400).json({ message: "Role not found" });
    }

    const existingUserByEmail = await User.findOne({ where: { email: normalizeEmail(email) } });
    if (existingUserByEmail) {
      return res.status(409).json({ message: "Email already exists for another user" });
    }

    const memberPayload = {
      first_name: normalize(first_name),
      middle_name: normalize(middle_name) || "",
      last_name: normalize(last_name),
      code: normalize(code) || null,
      phone: normalize(phone) || "",
      email: normalizeEmail(email),
      gender: normalize(gender) || null,
      region: normalize(region) || "",
      join_date: toDateOrNull(join_date) || null,
      department: normalize(department) || "",
      student_id: normalize(student_id) || "",
      study_year: normalize(study_year) || "",
      Profile_picture: req.file?.path || Profile_picture || null,
      role_id: role ? Number(role) : null,
      status: "Active",
    };

    const saved = await Member.create(memberPayload);

    const baseUsername = String(saved.email || `${saved.first_name}${saved.last_name}`)
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9._-]/g, "");

    let username = baseUsername || `user${String(saved.id).slice(-4)}`;
    const existingUsername = await User.findOne({ where: { username } });
    if (existingUsername) username = `${username}-${String(saved.id).slice(-4)}`;

    const securePassword = crypto.randomBytes(32).toString("hex");
    const inviteToken = crypto.randomBytes(32).toString("hex");
    const inviteTokenExpires = new Date(Date.now() + 72 * 60 * 60 * 1000);

    try {
      const newUser = await User.create({
        first_name: saved.first_name,
        middle_name: saved.middle_name || "",
        last_name: saved.last_name,
        username,
        email: saved.email,
        password: securePassword,
        member_id: saved.code || String(saved.id),
        role_id: saved.role_id || null,
        status: "pending",
        member_id_fk: saved.id,
        added_by: req.user?.id || null,
        updated_by: req.user?.id || null,
        mustChangePassword: true,
        inviteToken,
        inviteTokenExpires,
        invitedBy: req.user?.id || null,
        invitedAt: new Date(),
      });

      const appUrl = process.env.APP_URL || "http://localhost:5173";
      const setupUrl = `${appUrl}/setup-password?token=${inviteToken}`;

      try {
        const welcomeEmail = welcomeEmailTemplate({
          firstName: saved.first_name,
          lastName: saved.last_name,
          memberCode: saved.code || String(saved.id),
          username,
          setupUrl,
        });

        await sendMail({
          to: saved.email,
          subject: welcomeEmail.subject,
          text: welcomeEmail.text,
          html: welcomeEmail.html,
        });
      } catch (emailErr) {
        console.error("Failed to send invite email:", emailErr.message);
      }

      await logMemberAction("created", saved, req.user, req, {
        description: `Member "${saved.first_name} ${saved.last_name}" was created`,
      });
      await logUserAction("invited", newUser, req.user, req, {
        description: `User account created with invite for ${saved.email}`,
      });
    } catch (userErr) {
      await Member.destroy({ where: { id: saved.id } });
      return res.status(500).json({ message: "Member created but user creation failed" });
    }

    const populated = await Member.findByPk(saved.id, {
      include: [{ model: Role, as: "roleRef", attributes: ["id", "role", "plural", "color", "system"], required: false }],
    });

    return res.status(201).json({ data: populated });
  } catch (err) {
    if (err?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        message: "Duplicate value: a member with this unique field already exists.",
      });
    }
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

    const where = {};

    if (q) {
      const qv = String(q).trim();
      where[Op.or] = [
        { first_name: { [Op.like]: `%${qv}%` } },
        { middle_name: { [Op.like]: `%${qv}%` } },
        { last_name: { [Op.like]: `%${qv}%` } },
        { email: { [Op.like]: `%${qv}%` } },
        { phone: { [Op.like]: `%${qv}%` } },
        { code: { [Op.like]: `%${qv}%` } },
      ];
    }

    if (region) where.region = region;
    if (city) where.city = city;
    if (gender) where.gender = gender;
    if (department) where.department = { [Op.like]: `%${String(department).trim()}%` };
    if (study_year) where.study_year = study_year;
    if (status && ["Active", "Inactive", "pending"].includes(status)) where.status = status;

    if (typeof isArchived !== "undefined") {
      if (isArchived === "true" || isArchived === "1") where.isArchived = true;
      else if (isArchived === "false" || isArchived === "0") where.isArchived = false;
    }

    if (from || to) {
      where.join_date = {};
      if (from) {
        const d = new Date(from);
        if (!Number.isNaN(d.getTime())) where.join_date[Op.gte] = d;
      }
      if (to) {
        const d = new Date(to);
        if (!Number.isNaN(d.getTime())) where.join_date[Op.lte] = d;
      }
      if (!Object.keys(where.join_date).length) delete where.join_date;
    }

    if (moderator && isValidId(moderator)) {
      const assignedRows = await ModeratorMember.findAll({
        where: { moderator_id: Number(moderator) },
        attributes: ["member_id"],
        raw: true,
      });
      const assignedIds = assignedRows.map((r) => r.member_id).filter(Boolean);
      where.id = { [Op.in]: assignedIds.length ? assignedIds : [-1] };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.max(1, Math.min(500, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * perPage;

    const selectFields = [
      "id",
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
      "Profile_picture",
      "department",
      "student_id",
      "study_year",
      "status",
      "createdAt",
      "role_id",
    ];

    const sortField = String(sort).startsWith("-") ? String(sort).slice(1) : String(sort);
    const sortDir = String(sort).startsWith("-") ? "DESC" : "ASC";

    const [items, total] = await Promise.all([
      Member.findAll({
        where,
        attributes: selectFields,
        order: [[sortField || "createdAt", sortDir]],
        offset,
        limit: perPage,
        raw: true,
      }),
      Member.count({ where }),
    ]);

    const roleIds = [...new Set(items.map((it) => it.role_id).filter(Boolean))];
    const roles = roleIds.length
      ? await Role.findAll({
          where: { id: { [Op.in]: roleIds } },
          attributes: ["id", "role", "color", "plural", "system"],
          raw: true,
        })
      : [];
    const roleMap = new Map(roles.map((r) => [r.id, r]));

    const mapped = items.map((it) => ({
      ...it,
      join_date: it.join_date ? new Date(it.join_date).toISOString() : null,
      profile_picture: it.Profile_picture ?? null,
      role: it.role_id ? roleMap.get(it.role_id) || null : null,
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
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid member id" });

    const update = { ...req.body };
    if (req.file) update.Profile_picture = req.file.path;
    delete update.id;

    if (Object.prototype.hasOwnProperty.call(update, "role")) {
      if (update.role) {
        if (!isValidId(update.role)) return res.status(400).json({ message: "Invalid role id" });
        const roleExists = await Role.findByPk(Number(update.role));
        if (!roleExists) return res.status(400).json({ message: "Role not found" });
        update.role_id = Number(update.role);
      } else {
        update.role_id = null;
      }
      delete update.role;
    }

    const member = await Member.findByPk(Number(id));
    if (!member) return res.status(404).json({ message: "Member not found" });

    await member.update(update);

    const populated = await Member.findByPk(member.id, {
      include: [{ model: Role, as: "roleRef", attributes: ["id", "role", "plural", "color", "system"], required: false }],
    });

    return res.status(200).json({ data: populated });
  } catch (err) {
    if (err?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        message: "Duplicate value: a member with this unique field already exists.",
      });
    }
    return next(err);
  }
};

export const getMemberById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid member id" });

    const member = await Member.findByPk(Number(id), {
      include: [{ model: Role, as: "roleRef", attributes: ["role", "color", "plural", "system"], required: false }],
    });

    if (!member) return res.status(404).json({ message: "Member not found" });
    return res.status(200).json({ data: member });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /members/:id/archive
 */
export const archiveMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid member id" });

    const member = await Member.findByPk(Number(id));
    if (!member) return res.status(404).json({ message: "Member not found" });

    member.isArchived = true;
    await member.save();

    return res.status(200).json({ data: member });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /members/:id/restore
 */
export const restoreMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid member id" });

    const member = await Member.findByPk(Number(id));
    if (!member) return res.status(404).json({ message: "Member not found" });

    member.isArchived = false;
    await member.save();

    return res.status(200).json({ data: member });
  } catch (err) {
    return next(err);
  }
};

/**
 * DELETE /members/:id
 */
export const deleteMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid member id" });

    const member = await Member.findByPk(Number(id));
    if (!member) return res.status(404).json({ message: "Member not found" });

    const removedId = member.id;
    await member.destroy();

    return res.status(200).json({ message: "Member deleted", id: removedId });
  } catch (err) {
    return next(err);
  }
};

export const getMemberByCode = async (req, res, next) => {
  try {
    const { code } = req.params;
    if (!code) return res.status(400).json({ message: "MemberId is required" });

    const member = await Member.findOne({
      where: { code: String(code).trim() },
      include: [{ model: Role, as: "roleRef", attributes: ["role", "color"], required: false }],
    });

    if (!member) {
      return res.status(404).json({
        message: "Before requesting a book you must be member of the Club",
      });
    }

    return res.status(200).json({ data: member });
  } catch (err) {
    return next(err);
  }
};

export const getMembersList = async (req, res, next) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });

    const currentUser = await User.findByPk(req.user.id, {
      attributes: ["id", "member_id_fk", "role_id"],
      include: [{ model: Role, as: "role", attributes: ["role", "plural"], required: false }],
    });

    const roleName = (currentUser?.role?.role || currentUser?.role?.plural || "").toLowerCase();
    const isSuperAdmin = /super\s*admin/i.test(roleName);
    const isModerator = /moderator/i.test(roleName);

    if (isSuperAdmin) {
      const members = await Member.findAll({
        attributes: ["id", "first_name", "middle_name", "last_name", "code", "email", "join_date", "Profile_picture", "status", "region", "createdAt"],
        order: [["createdAt", "DESC"]],
        raw: true,
      });
      return res.status(200).json({ data: members });
    }

    if (isModerator) {
      const assigned = await ModeratorMember.findAll({
        where: { moderator_id: req.user.id },
        attributes: ["member_id"],
        raw: true,
      });
      const memberIds = assigned.map((a) => a.member_id).filter(Boolean);
      if (!memberIds.length) return res.status(200).json({ data: [] });

      const members = await Member.findAll({
        where: { id: { [Op.in]: memberIds } },
        attributes: ["id", "first_name", "middle_name", "last_name", "code", "email", "createdAt"],
        order: [["createdAt", "DESC"]],
        raw: true,
      });
      return res.status(200).json({ data: members });
    }

    const memberId = currentUser?.member_id_fk || null;
    if (memberId) {
      const m = await Member.findByPk(memberId, {
        attributes: ["id", "first_name", "middle_name", "last_name", "code", "email", "createdAt"],
        raw: true,
      });
      if (!m) return res.status(200).json({ data: [] });
      return res.status(200).json({ data: [m] });
    }

    return res.status(200).json({ data: [] });
  } catch (err) {
    return next(err);
  }
};

export const bulkCreateMembers = async (req, res, next) => {
  try {
    const { members } = req.body;

    if (!Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ message: "members must be a non-empty array" });
    }

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
        gender: raw.gender || null,
        region: normalize(raw.region) ? String(raw.region).trim() : "",
        city: normalize(raw.city) ? String(raw.city).trim() : "",
        status: raw.status || null,
        join_date: toDateOrNull(raw.join_date) || null,
        role_id: raw.role && isValidId(raw.role) ? Number(raw.role) : null,
      };

      if (raw.code && String(raw.code).trim()) doc.code = String(raw.code).trim();

      prepared.push(doc);
    }

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

    const emails = deduped.map((d) => d.email).filter(Boolean);
    const codes = deduped.map((d) => d.code).filter(Boolean);

    const orList = [
      ...(emails.length ? [{ email: { [Op.in]: emails } }] : []),
      ...(codes.length ? [{ code: { [Op.in]: codes } }] : []),
    ];

    const existing = orList.length
      ? await Member.findAll({
          where: { [Op.or]: orList },
          attributes: ["email", "code"],
          raw: true,
        })
      : [];

    const existingEmails = new Set(existing.map((x) => x.email).filter(Boolean).map((x) => String(x).toLowerCase()));
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

    if (!toInsert.length) {
      return res.status(200).json({
        message: "No new members inserted (all duplicates or invalid).",
        insertedCount: 0,
        skippedCount,
        errorCount: errors.length,
        errors,
      });
    }

    const inserted = await Member.bulkCreate(toInsert);

    return res.status(201).json({
      message: "Bulk members import complete.",
      insertedCount: inserted.length,
      skippedCount,
      errorCount: errors.length,
      errors,
    });
  } catch (err) {
    if (err?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        message: "Some records already exist (duplicate email/code).",
      });
    }
    return next(err);
  }
};

export const JoinClub = async (req, res, next) => {
  try {
    const { FullName, phone, email } = req.body;

    if (!FullName || !phone || !email) {
      return res.status(400).json({
        message: "Full name, phone, and email are required",
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const existingRequest = await Clubreq.findOne({ where: { email: normalizedEmail } });
    if (existingRequest) {
      return res.status(409).json({
        message: "A join request with this email already exists",
      });
    }

    const clubRequest = await Clubreq.create({
      FullName: normalize(FullName),
      phone: normalize(phone),
      email: normalizedEmail,
      status: "Pending",
    });

    return res.status(201).json({
      message: "Join club request submitted successfully",
      data: clubRequest,
    });
  } catch (error) {
    return next(error);
  }
};

export const getJoinClubs = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status && ["Pending", "Approved", "Rejected"].includes(status)) {
      where.status = status;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.max(1, Math.min(200, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * perPage;

    const { rows: requests, count: total } = await Clubreq.findAndCountAll({
      where,
      include: [
        {
          model: Member,
          as: "member",
          attributes: ["first_name", "last_name", "code", "email"],
          required: false,
        },
        {
          model: User,
          as: "reviewedBy",
          attributes: ["first_name", "last_name", "username"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
      offset,
      limit: perPage,
    });

    return res.status(200).json({
      count: total,
      data: requests,
      page: pageNum,
      limit: perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (error) {
    return next(error);
  }
};

export const getJoinClubById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid id" });

    const request = await Clubreq.findByPk(Number(id), {
      include: [
        {
          model: Member,
          as: "member",
          attributes: ["first_name", "last_name", "code", "email"],
          required: false,
        },
        {
          model: User,
          as: "reviewedBy",
          attributes: ["first_name", "last_name", "username"],
          required: false,
        },
      ],
    });

    if (!request) {
      return res.status(404).json({ message: "Join club request not found" });
    }

    return res.status(200).json(request);
  } catch (error) {
    return next(error);
  }
};

export const updateJoinClubStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (!["Approved", "Rejected"].includes(status)) {
      return res.status(400).json({
        message: "Status must be either Approved or Rejected",
      });
    }

    if (!isValidId(id)) return res.status(400).json({ message: "Invalid id" });

    const clubReq = await Clubreq.findByPk(Number(id));
    if (!clubReq) return res.status(404).json({ message: "Join club request not found" });

    if (clubReq.status !== "Pending") {
      return res.status(409).json({ message: `Request is already ${clubReq.status}` });
    }

    const updateData = {
      status,
      reviewed_by: req.user?.id || null,
      reviewedAt: new Date(),
    };

    if (status === "Rejected" && rejectionReason) {
      updateData.rejectionReason = String(rejectionReason).trim();
    }

    let createdMember = null;
    let linkedUser = null;

    if (status === "Approved") {
      const defaultMemberRole = await findDefaultMemberRole();

      let member = await Member.findOne({ where: { email: normalizeEmail(clubReq.email) } });

      if (!member) {
        const nameParts = clubReq.FullName.trim().split(/\s+/);
        const first_name = nameParts[0] || clubReq.FullName;
        const last_name = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "-";

        member = await Member.create({
          first_name,
          last_name,
          email: normalizeEmail(clubReq.email),
          phone: normalize(clubReq.phone),
          status: "Active",
          isArchived: false,
          role_id: defaultMemberRole?.id || null,
        });

        createdMember = member;
      } else {
        const patch = {};
        if (member.status !== "Active") patch.status = "Active";
        if (member.isArchived) patch.isArchived = false;
        if (!member.role_id && defaultMemberRole?.id) patch.role_id = defaultMemberRole.id;
        if (Object.keys(patch).length) await member.update(patch);
      }

      updateData.member_id = member.id;

      const inviteToken = crypto.randomBytes(32).toString("hex");
      const inviteTokenExpires = new Date(Date.now() + 72 * 60 * 60 * 1000);

      let user = await User.findOne({ where: { email: normalizeEmail(clubReq.email) } });

      if (!user) {
        const tempPassword = crypto.randomBytes(32).toString("hex");
        const rawBase = clubReq.email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]/g, "");
        const baseUsername = rawBase.length > 0 ? rawBase : `user${Date.now().toString().slice(-6)}`;
        let username = baseUsername;

        const existing = await User.findOne({ where: { username } });
        if (existing) username = `${username}-${Date.now().toString().slice(-4)}`;

        const nameParts = clubReq.FullName.trim().split(/\s+/);

        try {
          user = await User.create({
            first_name: nameParts[0] || clubReq.FullName,
            last_name: nameParts.length > 1 ? nameParts.slice(1).join(" ") : "-",
            username,
            email: normalizeEmail(clubReq.email),
            password: tempPassword,
            member_id: member.code || String(member.id),
            role_id: member.role_id || defaultMemberRole?.id || null,
            member_id_fk: member.id,
            status: "pending",
            added_by: req.user?.id || null,
            mustChangePassword: true,
            inviteToken,
            inviteTokenExpires,
            invitedBy: req.user?.id || null,
            invitedAt: new Date(),
          });
          linkedUser = user;
        } catch (userErr) {
          console.error("updateJoinClubStatus: user creation failed", userErr?.message);
        }
      } else {
        linkedUser = user;
        try {
          await user.update({
            mustChangePassword: true,
            inviteToken,
            inviteTokenExpires,
            invitedBy: req.user?.id || null,
            invitedAt: new Date(),
            status: "pending",
            member_id_fk: member.id,
            member_id: member.code || String(member.id),
            role_id: user.role_id || member.role_id || defaultMemberRole?.id || null,
            resetPasswordCode: null,
            resetPasswordExpires: null,
          });
        } catch (updateUserErr) {
          console.error("updateJoinClubStatus: invite token update failed", updateUserErr?.message);
        }
      }

      if (linkedUser) {
        try {
          await Notification.create({
            user_id: linkedUser.id,
            title: "Welcome to the Club! 🎉",
            message: `Your join request has been approved. Welcome, ${clubReq.FullName}!`,
            type: "success",
            meta: { kind: "join-request-approved", clubreqId: clubReq.id },
          });
        } catch {
          // non-fatal
        }
      }

      try {
        if (clubReq.email) {
          const appUrl = process.env.APP_URL || "http://localhost:5173";
          const setupUrl = `${appUrl}/setup-password?token=${inviteToken}`;
          const approvalEmail = joinApprovalTemplate({
            firstName: createdMember?.first_name || linkedUser?.first_name || clubReq.FullName?.split(/\s+/)[0] || "",
            lastName:
              createdMember?.last_name ||
              linkedUser?.last_name ||
              clubReq.FullName?.split(/\s+/).slice(1).join(" ") ||
              "",
            memberCode: createdMember?.code || linkedUser?.member_id || "N/A",
          });
          const welcomeEmail = welcomeEmailTemplate({
            firstName: createdMember?.first_name || linkedUser?.first_name || clubReq.FullName?.split(/\s+/)[0] || "",
            lastName:
              createdMember?.last_name ||
              linkedUser?.last_name ||
              clubReq.FullName?.split(/\s+/).slice(1).join(" ") ||
              "",
            memberCode: createdMember?.code || linkedUser?.member_id || "N/A",
            username: linkedUser?.username,
            setupUrl,
          });

          await sendMail({
            to: clubReq.email,
            subject: welcomeEmail.subject,
            text: `${approvalEmail.text}\n\nUsername: ${linkedUser?.username || "N/A"}\nSet your password: ${setupUrl}`,
            html: welcomeEmail.html,
          });
        }
      } catch (emailErr) {
        console.error("updateJoinClubStatus: approval email failed", emailErr?.message);
      }
    } else {
      const existingUser = await User.findOne({ where: { email: normalizeEmail(clubReq.email) } });
      if (existingUser) {
        try {
          await Notification.create({
            user_id: existingUser.id,
            title: "Join Request Update",
            message: rejectionReason
              ? `Your join request was not approved. Reason: ${rejectionReason}`
              : "Your join request was not approved at this time.",
            type: "warning",
            meta: { kind: "join-request-rejected", clubreqId: clubReq.id },
          });
        } catch {
          // non-fatal
        }
      }

      try {
        if (clubReq.email) {
          const rejectionEmail = joinRejectionTemplate({
            firstName: clubReq.FullName?.split(/\s+/)[0] || "",
            lastName: clubReq.FullName?.split(/\s+/).slice(1).join(" ") || "",
            reason: rejectionReason,
          });

          await sendMail({
            to: clubReq.email,
            subject: rejectionEmail.subject,
            text: rejectionEmail.text,
            html: rejectionEmail.html,
          });
        }
      } catch (emailErr) {
        console.error("updateJoinClubStatus: rejection email failed", emailErr?.message);
      }
    }

    await clubReq.update(updateData);

    const updatedRequest = await Clubreq.findByPk(clubReq.id, {
      include: [
        {
          model: Member,
          as: "member",
          attributes: ["first_name", "last_name", "code", "email"],
          required: false,
        },
        {
          model: User,
          as: "reviewedBy",
          attributes: ["first_name", "last_name", "username"],
          required: false,
        },
      ],
    });

    return res.status(200).json({
      message: `Join request ${status.toLowerCase()} successfully`,
      data: updatedRequest,
      createdMember: createdMember || undefined,
    });
  } catch (error) {
    return next(error);
  }
};

export const getMemberOverview = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid member id" });

    const member = await Member.findByPk(Number(id), {
      include: [{ model: Role, as: "roleRef", attributes: ["role", "plural", "color"], required: false }],
    });
    if (!member) return res.status(404).json({ message: "Member not found" });

    const user = await User.findOne({
      where: { member_id_fk: member.id },
      attributes: ["id", "username", "email", "status", "role_id", "createdAt"],
      include: [{ model: Role, as: "role", attributes: ["role", "plural"], required: false }],
    });

    const modAssignment = await ModeratorMember.findOne({
      where: { member_id: member.id },
      include: [
        {
          model: User,
          as: "moderator",
          attributes: ["id", "first_name", "last_name", "username", "email"],
          required: false,
        },
      ],
    });

    const issues = await Issue.findAll({
      where: { member_id: member.id },
      include: [{ model: Book, as: "book", attributes: ["title", "author"], required: false }],
      order: [["issueDate", "DESC"]],
    });

    const overdueCount = issues.filter((i) => i.status === "Overdue").length;
    const issuedCount = issues.filter((i) => i.status === "Issued").length;
    const returnedCount = issues.filter((i) => i.status === "Returned").length;

    let dailyReports = [];
    let reportStreak = 0;

    if (user) {
      dailyReports = await DailyReport.findAll({
        where: { createdBy: user.id },
        include: [{ model: Book, as: "bookRef", attributes: ["title", "author"], required: false }],
        order: [["readingDate", "DESC"]],
        limit: 50,
      });

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

    const notes = await MemberNote.findAll({
      where: { member_id: member.id, isArchived: false },
      include: [{ model: User, as: "author", attributes: ["first_name", "last_name", "username"], required: false }],
      order: [["createdAt", "DESC"]],
    });

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
};

export const createMemberNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid member id" });

    const { note, category } = req.body;
    if (!note || !String(note).trim()) {
      return res.status(400).json({ message: "note text is required" });
    }

    const memberExists = await Member.findByPk(Number(id));
    if (!memberExists) return res.status(404).json({ message: "Member not found" });

    const created = await MemberNote.create({
      member_id: Number(id),
      author_id: req.user.id,
      note: String(note).trim(),
      category: category ? String(category).trim() : "",
    });

    const populated = await MemberNote.findByPk(created.id, {
      include: [{ model: User, as: "author", attributes: ["first_name", "last_name", "username"], required: false }],
    });

    return res.status(201).json({ data: populated });
  } catch (err) {
    return next(err);
  }
};

export const getMemberNotes = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid member id" });

    const notes = await MemberNote.findAll({
      where: { member_id: Number(id), isArchived: false },
      include: [{ model: User, as: "author", attributes: ["first_name", "last_name", "username"], required: false }],
      order: [["createdAt", "DESC"]],
    });

    return res.status(200).json({ data: notes });
  } catch (err) {
    return next(err);
  }
};

export const deleteMemberNote = async (req, res, next) => {
  try {
    const { id, noteId } = req.params;
    if (!isValidId(id) || !isValidId(noteId)) {
      return res.status(400).json({ message: "Invalid id" });
    }

    const note = await MemberNote.findOne({
      where: { id: Number(noteId), member_id: Number(id) },
    });

    if (!note) return res.status(404).json({ message: "Note not found" });

    note.isArchived = true;
    await note.save();

    return res.status(200).json({ message: "Note removed" });
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
  getMemberByCode,
  getMembersList,
  bulkCreateMembers,
  JoinClub,
  getJoinClubs,
  getJoinClubById,
  updateJoinClubStatus,
  getMemberOverview,
  createMemberNote,
  getMemberNotes,
  deleteMemberNote,
};