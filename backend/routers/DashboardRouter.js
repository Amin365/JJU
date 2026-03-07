import express from "express";
import { protect } from "../middleware/auth.js";
import {
  getDashboardStats,
  getRecentActivity,
  getTopReaders,
  getPopularBooks,
  getPendingApprovals,
} from "../controller/DashboardController.js";

const DashboardRouter = express.Router();

DashboardRouter.get("/dashboard/stats", protect, getDashboardStats);
DashboardRouter.get("/dashboard/activity", protect, getRecentActivity);
DashboardRouter.get("/dashboard/top-readers", protect, getTopReaders);
DashboardRouter.get("/dashboard/popular-books", protect, getPopularBooks);
DashboardRouter.get("/dashboard/pending-approvals", protect, getPendingApprovals);

export default DashboardRouter;
