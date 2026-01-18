import express from "express";
import { protect } from "../middleware/auth.js";
import Role from "../models/Role.js";
import {
  getUsers,
  getUserById,
  createUserFromMember,
  updateUserStatus,
  getAvailableMembersForUserCreation,
  updateProfile,
  changePassword,
  deleteAccount,
  getProfile
} from "../controller/UserController.js";

import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from '../utility/cloudinary.js'
    const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "Profile", // folder in cloudinary
    allowed_formats: ["jpg", "jpeg", "png", "gif"],
    public_id: (req, file) => Date.now() + "-" + file.originalname.split(".")[0],
  },
});

const upload = multer({ storage });

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

// Profile routes (for current user, no admin guard)
router.put("/profile", protect, upload.single('profile'), updateProfile); 
router.put("/profile/change-password", protect, changePassword); // Change password
router.delete("/profile/delete", protect, deleteAccount); // Delete account

// Users management routes (admin only)
router.get('/available_members', protect, getAvailableMembersForUserCreation);
router.get("/users", protect, requireSuperAdmin, getUsers);
router.get("/users/:id", protect, requireSuperAdmin, getUserById);
router.post("/users/from-member", protect, requireSuperAdmin, createUserFromMember);
router.patch("/users/:id/status", protect, requireSuperAdmin, updateUserStatus);
router.get("/profile", protect, getProfile);
export default router;