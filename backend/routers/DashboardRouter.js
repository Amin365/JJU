import express from "express";
import {
  getDashboardStats,
  getRecentActivity,
  getTopReaders,
  getPopularBooks,
} from "../controller/DashboardController.js";
import { protect } from "../middleware/auth.js";

const DashboardRouter = express.Router();

DashboardRouter.get("/dashboard/stats", protect, getDashboardStats);
DashboardRouter.get("/dashboard/activity", protect, getRecentActivity);
DashboardRouter.get("/dashboard/top-readers", protect, getTopReaders);
DashboardRouter.get("/dashboard/popular-books", protect, getPopularBooks);

export default DashboardRouter;
