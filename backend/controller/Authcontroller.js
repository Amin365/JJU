import dotenv from "dotenv";
dotenv.config();

import crypto from "crypto";
import User from "../models/user.js";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Role from "../models/Role.js";
import RolePermission from "../models/RolePermission.js";
import UserPermission from "../models/UserPermission.js";
import Permission from "../models/Permissions.js";
import RefreshToken from "../models/RefreshToken.js";
import { Op } from 'sequelize';
import { signAccessToken, signRefreshToken, hashToken, verifyRefreshToken } from "../utility/tokenUtils.js";
import { logAuthAction } from "../utility/auditLog.js";
import { sendMail, buildEmailHtml } from "./EmailController.js";

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    let retryAfterMinutes = 1;
    if (req.rateLimit && req.rateLimit.resetTime) {
      retryAfterMinutes = Math.ceil((req.rateLimit.resetTime - Date.now()) / 60000);
      if (retryAfterMinutes < 1) retryAfterMinutes = 1;
    }
    return res.status(429).json({
      error: true,
      message: `Too many login attempts. Try again in ${retryAfterMinutes} minute${retryAfterMinutes > 1 ? "s" : ""}.`,
    });
  },
});

export const registerUser = async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: "username, email and password are required" });
  }

  try {
    const userExists = await User.findOne({ where: { email } });
    if (userExists) return res.status(400).json({ message: "User already exists" });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    if (user) {
      return res.status(201).json({
        id: user.id,
        username: user.username,
        email: user.email,
        role_id: user.role_id,
      });
    } else {
      return res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const loginUser = async (req, res) => {
  const { email, username, identifier, password } = req.body;
  const id = identifier || email || username;

  const rateLimitRemaining = req.rateLimit ? req.rateLimit.remaining : "unknown";

  if (!id || !password) {
    return res.status(400).json({ message: "identifier (email or username) and password are required" });
  }

  try {
    const user = await User.findOne({
      where: { [Op.or]: [{ email: id }, { username: id }] },
    });

    if (!user) {
      return res
        .status(401)
        .send({ message: "Incorrect Credentials." + (rateLimitRemaining != "unknown" ? " ( " + rateLimitRemaining + " attempts left )" : "") });
    }

    if (user.status && user.status !== "Active") {
      return res.status(403).json({ message: "Account is not active. Please contact support." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .send({ message: "Incorrect Credentials." + (rateLimitRemaining != "unknown" ? " ( " + rateLimitRemaining + " attempts left )" : "") });
    }

    const roleDoc = user.role_id ? await Role.findByPk(user.role_id) : null;

    const [rolePermDocs, userPermDocs] = await Promise.all([
      roleDoc ? RolePermission.findAll({ where: { role_id: roleDoc.id }, include: [{ model: Permission, as: 'permission' }] }) : [],
      UserPermission.findAll({ where: { user_id: user.id }, include: [{ model: Permission, as: 'permission' }] }),
    ]);

    const permissionSet = new Set();
    rolePermDocs.forEach((rp) => {
      if (rp.permission?.permission) permissionSet.add(rp.permission.permission);
    });
    userPermDocs.forEach((up) => {
      if (up.permission?.permission) permissionSet.add(up.permission.permission);
    });

    const payload = { id: user.id, role: user.role_id };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    const tokenHash = hashToken(refreshToken);
    const decodedRefresh = verifyRefreshToken(refreshToken);
    const expiresAt = new Date(decodedRefresh.exp * 1000);

    await RefreshToken.create({
      tokenHash,
      user_id: user.id,
      expiresAt,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth", 
      maxAge: expiresAt.getTime() - Date.now(),
    };

    res.cookie("refreshToken", refreshToken, cookieOptions);

    await logAuthAction("login", user, req, {
      description: `User "${user.email}" logged in successfully`,
    });

    return res.json({
      token: accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        status: user.status,
        role: roleDoc ? { id: roleDoc.id, role: roleDoc.role } : null,
        permissions: Array.from(permissionSet),
        mustChangePassword: user.mustChangePassword || false,
      },
    });
  } catch (error) {
    console.error("loginUser error:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ message: "No refresh token provided" });
    }

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch (err) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const tokenHash = hashToken(token);

    const stored = await RefreshToken.findOne({ where: { tokenHash } });
    if (!stored || stored.revoked) {
      return res.status(401).json({ message: "Refresh token revoked or not found" });
    }

    if (stored.expiresAt.getTime() < Date.now()) {
      return res.status(401).json({ message: "Refresh token expired" });
    }

    const newPayload = { id: payload.id, role: payload.role || null };
    const newAccessToken = signAccessToken(newPayload);
    const newRefreshToken = signRefreshToken(newPayload);

    const newTokenHash = hashToken(newRefreshToken);
    const newDecoded = verifyRefreshToken(newRefreshToken);
    const newExpiresAt = new Date(newDecoded.exp * 1000);

    stored.revoked = true;
    stored.replacedByTokenHash = newTokenHash;
    await stored.save();

    await RefreshToken.create({
      tokenHash: newTokenHash,
      user_id: stored.user_id,
      expiresAt: newExpiresAt,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
    });

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/auth",
      maxAge: newExpiresAt.getTime() - Date.now(),
    };
    res.cookie("refreshToken", newRefreshToken, cookieOptions);

    return res.json({ token: newAccessToken });
  } catch (err) {
    console.error("refreshToken error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const logout = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      const tokenHash = hashToken(token);
      await RefreshToken.update({ revoked: true }, { where: { tokenHash } });
    }
    res.clearCookie("refreshToken", { path: "/api/auth" });
    return res.json({ message: "Logged out" });
  } catch (err) {
    console.error("logout error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const GetProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] },
      include: [{ model: Role, as: 'roleInfo' }],
    });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ success: true, user: user.toJSON() });
  } catch (err) {
    next(err);
  }
};

export const validateInviteToken = async (req, res, next) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }

    const user = await User.findOne({
      where: {
        inviteToken: token,
        inviteTokenExpires: { [Op.gt]: new Date() },
      },
      attributes: ['first_name', 'last_name', 'email', 'inviteTokenExpires'],
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired invite token" });
    }

    return res.json({
      valid: true,
      user: {
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        expiresAt: user.inviteTokenExpires,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const setupPasswordFromInvite = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Token is required" });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const user = await User.findOne({
      where: {
        inviteToken: token,
        inviteTokenExpires: { [Op.gt]: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired invite token" });
    }

    user.password = password;
    user.status = "Active";
    user.mustChangePassword = false;
    user.inviteToken = null;
    user.inviteTokenExpires = null;

    await user.save();

    return res.json({
      success: true,
      message: "Password set successfully. You can now log in.",
    });
  } catch (err) {
    next(err);
  }
};

export const resendInvite = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ where: { email, mustChangePassword: true } });

    if (!user) {
      return res.status(404).json({ message: "No pending invite found for this email" });
    }

    const inviteToken = crypto.randomBytes(32).toString("hex");
    const inviteTokenExpires = new Date(Date.now() + 72 * 60 * 60 * 1000);

    user.inviteToken = inviteToken;
    user.inviteTokenExpires = inviteTokenExpires;
    await user.save();

    const appUrl = process.env.APP_URL || "http://localhost:5173";
    const setupUrl = `${appUrl}/setup-password?token=${inviteToken}`;

    await sendMail({
      to: user.email,
      subject: "Set up your account - Reminder",
      html: buildEmailHtml({
        title: "Complete Your Account Setup",
        preheader: "Set up your account password",
        greeting: `Hello ${user.first_name}`,
        bodyLines: [
          "This is a reminder to set up your JJU Reading Club account.",
          "Please click the button below to set up your password.",
          "This link will expire in 72 hours.",
        ],
        ctaLabel: "Set Up Password",
        ctaUrl: setupUrl,
        footerNote: "If you didn't expect this email, you can safely ignore it.",
      }),
    });

    return res.json({
      success: true,
      message: "Invite email has been resent",
    });
  } catch (err) {
    next(err);
  }
};

export const checkMustChangePassword = async (req, res, next) => {
  try {
    if (req.user?.mustChangePassword) {
      return res.status(403).json({
        message: "Password change required",
        mustChangePassword: true,
      });
    }
    next();
  } catch (err) {
    next(err);
  }
};
