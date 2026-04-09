import User from "../models/user.js";
import { Op } from "sequelize";
import Member from "../models/Members.js";
import Role from "../models/Role.js";
import bcrypt from "bcryptjs";
import { sendMail, buildEmailHtml } from "./EmailController.js";

const isValidId = (id) => Number.isInteger(Number(id)) && Number(id) > 0;

const escapeLike = (value) =>
  String(value)
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");

export const createUserFromMember = async (req, res, next) => {
  try {
    const { member, username, password } = req.body;

    if (!member) return res.status(400).json({ message: "member is required" });
    if (!username) return res.status(400).json({ message: "username is required" });
    if (!password || password.length < 6) {
      return res.status(400).json({ message: "password must be at least 6 characters" });
    }

    if (!isValidId(member)) {
      return res.status(400).json({ message: "Invalid member id" });
    }

    const m = await Member.findByPk(Number(member));
    if (!m) return res.status(404).json({ message: "Member not found" });

    if (!m.email) {
      return res.status(400).json({
        message: "Selected member must have an email to create a user.",
      });
    }

    const existingForMember = await User.findOne({
      where: { member_id_fk: m.id },
    });

    if (existingForMember) {
      return res.status(409).json({ message: "This member already has a user account" });
    }

    const [existingUsername, existingEmail] = await Promise.all([
      User.findOne({ where: { username } }),
      User.findOne({ where: { email: m.email } }),
    ]);

    if (existingUsername) return res.status(409).json({ message: "Username already exists" });
    if (existingEmail) return res.status(409).json({ message: "Email already exists" });

    const user = await User.create({
      first_name: m.first_name,
      middle_name: m.middle_name || "",
      last_name: m.last_name,
      username,
      email: m.email,
      password,
      member_id: m.code || String(m.id),
      role_id: m.role_id || null,
      status: m.status || "Active",
      member_id_fk: m.id,
      added_by: req.user?.id || null,
      updated_by: req.user?.id || null,
    });

    const populated = await User.findByPk(user.id, {
      include: [
        { model: Member, as: "member", attributes: ["id", "first_name", "middle_name", "last_name", "Profile_picture", "email", "phone", "code", "role_id"] },
        { association: "role", attributes: ["id", "role", "color", "plural", "system"] },
      ],
    });

    return res.status(201).json({ data: populated });
  } catch (err) {
    if (err?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({
        message: "Duplicate value: already exists.",
      });
    }
    return next(err);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid user id" });

    const user = await User.findByPk(Number(id), {
      include: [
        { association: "role", attributes: ["role", "color", "plural", "system"] },
        { model: Member, as: "member", attributes: ["first_name", "middle_name", "last_name", "Profile_picture", "email", "phone", "code", "role_id"] },
      ],
    });

    if (!user) return res.status(404).json({ message: "User not found" });
    return res.status(200).json({ data: user });
  } catch (err) {
    return next(err);
  }
};

export const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, sort = "-createdAt", q } = req.query;

    const where = {};
    if (q) {
      const qv = `%${escapeLike(q)}%`;
      where[Op.or] = [
        { username: { [Op.like]: qv } },
        { email: { [Op.like]: qv } },
        { first_name: { [Op.like]: qv } },
        { middle_name: { [Op.like]: qv } },
        { last_name: { [Op.like]: qv } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.max(1, Math.min(200, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * perPage;

    const sortField = String(sort).startsWith("-") ? String(sort).slice(1) : String(sort);
    const sortDir = String(sort).startsWith("-") ? "DESC" : "ASC";

    const { rows: items, count: total } = await User.findAndCountAll({
      where,
      include: [
        { association: "role", attributes: ["role", "color", "plural", "system"] },
        { model: Member, as: "member", attributes: ["first_name", "middle_name", "Profile_picture", "last_name", "email", "phone", "code", "role_id"] },
      ],
      order: [[sortField || "createdAt", sortDir]],
      offset,
      limit: perPage,
    });

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

export const getAvailableMembersForUserCreation = async (req, res, next) => {
  try {
    const { q, page = 1, limit = 50, sort = "-createdAt" } = req.query;

    const usedMemberRows = await User.findAll({
      attributes: ["member_id_fk"],
      where: { member_id_fk: { [Op.not]: null } },
      raw: true,
    });

    const usedMemberIds = usedMemberRows
      .map((u) => Number(u.member_id_fk))
      .filter((v) => Number.isFinite(v));

    const where = {};
    if (q) {
      const qv = `%${escapeLike(q)}%`;
      where[Op.or] = [
        { first_name: { [Op.like]: qv } },
        { middle_name: { [Op.like]: qv } },
        { last_name: { [Op.like]: qv } },
        { email: { [Op.like]: qv } },
        { phone: { [Op.like]: qv } },
        { code: { [Op.like]: qv } },
      ];
    }

    if (usedMemberIds.length) {
      where.id = { [Op.notIn]: usedMemberIds };
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.max(1, Math.min(200, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * perPage;

    const sortField = String(sort).startsWith("-") ? String(sort).slice(1) : String(sort);
    const sortDir = String(sort).startsWith("-") ? "DESC" : "ASC";

    const { rows, count } = await Member.findAndCountAll({
      where,
      attributes: ["id", "first_name", "middle_name", "last_name", "Profile_picture", "code", "email", "createdAt", "role_id"],
      include: [
        { model: Role, as: "role", attributes: ["id", "role", "plural", "color", "system"], required: false },
      ],
      order: [[sortField || "createdAt", sortDir]],
      offset,
      limit: perPage,
    });

    const data = rows.map((member) => {
      const item = member.toJSON();
      item.full_name = [item.first_name, item.middle_name, item.last_name]
        .filter(Boolean)
        .join(" ");
      return item;
    });

    return res.status(200).json({
      data,
      total: count,
      page: pageNum,
      limit: perPage,
      totalPages: Math.ceil(count / perPage),
    });
  } catch (err) {
    return next(err);
  }
};

export const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!isValidId(id)) return res.status(400).json({ message: "Invalid user id" });

    const allowed = ["Active", "Inactive", "pending"];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${allowed.join(", ")}` });
    }

    const user = await User.findByPk(Number(id));
    if (!user) return res.status(404).json({ message: "User not found" });

    await user.update({
      status,
      updated_by: req.user?.id || null,
    });

    const updated = await User.findByPk(Number(id), {
      include: [
        { association: "role", attributes: ["role", "color", "plural", "system"] },
        { model: Member, as: "member", attributes: ["first_name", "middle_name", "last_name", "email", "phone", "code", "role_id"] },
      ],
    });

    return res.status(200).json({ data: updated });
  } catch (err) {
    return next(err);
  }
};

export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [
        { association: "role", attributes: ["role", "color", "plural", "system"] },
        { model: Member, as: "member", attributes: ["first_name", "middle_name", "last_name", "Profile_picture", "email", "student_id", "department", "join_date", "phone", "code", "role_id"] },
      ],
    });

    if (!user) return res.status(404).json({ message: "User not found" });
    return res.status(200).json({ data: user });
  } catch (err) {
    return next(err);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, bio, phone } = req.body || {};
    const profilePicture = req.file ? req.file.path : undefined;

    const updateData = {};
    if (name) {
      const [firstName, ...lastNameParts] = String(name).split(" ");
      updateData.first_name = firstName || "";
      updateData.last_name = lastNameParts.join(" ") || "";
    }
    if (bio !== undefined) updateData.Bio = bio;
    if (phone !== undefined) updateData.phone = phone;
    if (profilePicture) updateData.profile_picture = profilePicture;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    const user = await User.findByPk(Number(userId));
    if (!user) return res.status(404).json({ message: "User not found" });

    await user.update(updateData);

    const updatedUser = await User.findByPk(Number(userId), {
      include: [
        { association: "role", attributes: ["role", "color", "plural", "system"] },
        { model: Member, as: "member", attributes: ["first_name", "middle_name", "last_name", "Profile_picture", "email", "phone", "code", "role_id"] },
      ],
    });

    return res.status(200).json({ data: updatedUser });
  } catch (err) {
    return next(err);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "All password fields are required" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "New password and confirmation do not match" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    const user = await User.findByPk(Number(userId));
    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch =
      typeof user.matchPassword === "function"
        ? await user.matchPassword(currentPassword)
        : await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await user.update({ password: hashedPassword });

    return res.status(200).json({ message: "Password changed successfully" });
  } catch (err) {
    return next(err);
  }
};

export const deleteAccount = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const deletedCount = await User.destroy({ where: { id: Number(userId) } });
    if (!deletedCount) return res.status(404).json({ message: "User not found" });

    return res.status(200).json({ message: "Account deleted successfully" });
  } catch (err) {
    return next(err);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ message: "User not found" });

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetPasswordCode = resetCode;
    user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000);

    await user.save({ validate: false });

    await sendMail({
      to: user.email,
      subject: "Password Reset Code",
      text: `Your password reset code is ${resetCode}. This code expires in 10 minutes. If you did not request a reset, you can ignore this email.`,
      html: buildEmailHtml({
        title: "Password Reset Code",
        preheader: `Your reset code is ${resetCode}`,
        greeting: `Hello ${user.first_name || ""} ${user.last_name || ""}`.trim(),
        bodyLines: [
          `Use the following code to reset your password: <strong>${resetCode}</strong>.`,
          "This code expires in 10 minutes for your security.",
          "If you did not request this password reset, you can safely ignore this email.",
        ],
        footerNote: `Stay safe, ${process.env.APP_NAME || "Reading Club"}`,
      }),
    });

    return res.status(200).json({ message: "OTP sent to email" });
  } catch (err) {
    return next(err);
  }
};

export const verifyResetCode = async (req, res, next) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ message: "Email and code are required" });
    }

    const user = await User.findOne({
      where: {
        email,
        resetPasswordCode: code,
        resetPasswordExpires: { [Op.gt]: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset code" });
    }

    return res.status(200).json({
      message: "OTP verified",
      userId: user.id,
    });
  } catch (err) {
    return next(err);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { userId, newPassword } = req.body;

    if (!userId || !newPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (!isValidId(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const user = await User.findByPk(Number(userId));
    if (!user) return res.status(404).json({ message: "User not found" });

    user.password = newPassword;
    user.resetPasswordCode = null;
    user.resetPasswordExpires = null;

    await user.save({ validate: false });

    return res.status(200).json({
      message: "Password reset successful",
    });
  } catch (err) {
    return next(err);
  }
};

export const resendResetCode = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(404).json({ message: "User not found" });

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetPasswordCode = resetCode;
    user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000);

    await user.save({ validate: false });

    await sendMail({
      to: user.email,
      subject: "Password Reset Code",
      text: `Your new password reset code is ${resetCode}. This code expires in 10 minutes. If you did not request a reset, you can ignore this email.`,
      html: buildEmailHtml({
        title: "Password Reset Code",
        preheader: `Your reset code is ${resetCode}`,
        greeting: `Hello ${user.first_name || ""} ${user.last_name || ""}`.trim(),
        bodyLines: [
          `Here is your new reset code: <strong>${resetCode}</strong>.`,
          "This code expires in 10 minutes for your security.",
          "If you did not request this password reset, you can safely ignore this email.",
        ],
        footerNote: `Stay safe, ${process.env.APP_NAME || "Reading Club"}`,
      }),
    });

    return res.status(200).json({
      message: "New verification code sent to email",
    });
  } catch (err) {
    return next(err);
  }
};

export default {
  createUserFromMember,
  getUserById,
  getUsers,
  getAvailableMembersForUserCreation,
  updateUserStatus,
  getProfile,
  updateProfile,
  changePassword,
  deleteAccount,
  forgotPassword,
  verifyResetCode,
  resetPassword,
  resendResetCode,
};