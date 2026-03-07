import express from "express";
import rateLimit from "express-rate-limit";
import {
  getDashboardStats,
  getRecentActivity,
  getTopReaders,
  getPopularBooks,
} from "../controller/DashboardController.js";
import { protect } from "../middleware/auth.js";

const DashboardRouter = express.Router();

const dashboardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many dashboard requests, please try again later." },
});

DashboardRouter.get("/dashboard/stats", dashboardLimiter, protect, getDashboardStats);
DashboardRouter.get("/dashboard/activity", dashboardLimiter, protect, getRecentActivity);
DashboardRouter.get("/dashboard/top-readers", dashboardLimiter, protect, getTopReaders);
DashboardRouter.get("/dashboard/popular-books", dashboardLimiter, protect, getPopularBooks);

export default DashboardRouter;
