import dotenv from 'dotenv'
dotenv.config()

import User from "../models/user.js"
import rateLimit from 'express-rate-limit'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import Role from "../models/Role.js"
import RolePermission from "../models/RolePermission.js"
import UserPermission from "../models/UserPermission.js"
import Permission from "../models/Permissions.js" // ensure model is registered for populate

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    let retryAfterMinutes = 1
    if (req.rateLimit && req.rateLimit.resetTime) {
      retryAfterMinutes = Math.ceil((req.rateLimit.resetTime - Date.now()) / 60000)
      if (retryAfterMinutes < 1) retryAfterMinutes = 1
    }
    return res.status(429).json({
      error: true,
      message: `Too many login attempts. Try again in ${retryAfterMinutes} minute${retryAfterMinutes > 1 ? 's' : ''}.`
    })
  }
})

export const registerUser = async (req, res) => {
  const { username, email, password } = req.body
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'username, email and password are required' })
  }

  try {
    const userExists = await User.findOne({ email })
    if (userExists) return res.status(400).json({ message: 'User already exists' })

    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    const user = await User.create({
      username,
      email,
      password: hashedPassword
    })

    if (user) {
      return res.status(201).json({
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role
      })
    } else {
      return res.status(400).json({ message: 'Invalid user data' })
    }
  } catch (error) {
    console.error(error)
    return res.status(500).json({ message: 'Server error' })
  }
}


export const loginUser = async (req, res) => {
  // Accept either email or username or generic "identifier"
  const { email, username, identifier, password } = req.body
  const id = identifier || email || username

  if (!id || !password) {
    return res.status(400).json({ message: 'identifier (email or username) and password are required' })
  }

  try {
    // find by email OR username
    const user = await User.findOne({
      $or: [
        { email: id },
        { username: id }
      ]
    })

    if (!user) {
      // generic message to avoid user enumeration
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const roleDoc = user.role ? await Role.findById(user.role) : null

    const [rolePermDocs, userPermDocs] = await Promise.all([
      roleDoc ? RolePermission.find({ role: roleDoc._id }).populate("permission", "permission") : [],
      UserPermission.find({ user: user._id }).populate("permission", "permission"),
    ])

    const permissionSet = new Set()
    rolePermDocs.forEach((rp) => {
      if (rp.permission?.permission) permissionSet.add(rp.permission.permission)
    })
    userPermDocs.forEach((up) => {
      if (up.permission?.permission) permissionSet.add(up.permission.permission)
    })

    const payload = { id: user._id, role: user.role }
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'please_set_a_secret', {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    })

    return res.json({
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: roleDoc ? { _id: roleDoc._id, role: roleDoc.role } : user.role,
        permissions: Array.from(permissionSet),
      }
    })
  } catch (error) {
    console.error('loginUser error:', error)
    return res.status(500).json({ message: 'Server error' })
  }
}

export const GetProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};