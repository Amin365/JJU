import express from "express";
import { protect } from "../middleware/auth.js";
import Role from "../models/Role.js";
import {
  getUsers,
  getUserById,
  createUserFromMember,
  updateUserStatus,
} from "../controller/UserController.js";

const router = express.Router();

// Simple admin guard: allow only Super Admin role
const requireSuperAdmin = async (req, res, next) => {
  try {
    const roleId = req.user?.role;
    const roleDoc = roleId ? await Role.findById(roleId).lean().exec() : null;
    const roleName = roleDoc?.role ? String(roleDoc.role).toLowerCase() : "";
    const isSuperAdmin = /super\s*admin/.test(roleName);
    if (!isSuperAdmin) {
      return res.status(403).json({ message: "Forbidden: Admins only" });
    }
    next();
  } catch (err) {
    next(err);
  }
};

// Users management routes
router.get("/users", protect, requireSuperAdmin, getUsers);
router.get("/users/:id", protect, requireSuperAdmin, getUserById);
router.post("/users/from-member", protect, requireSuperAdmin, createUserFromMember);
router.patch("/users/:id/status", protect, requireSuperAdmin, updateUserStatus);

export default router;
