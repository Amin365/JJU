import express from "express";
import { createDailyReport, getDailyReports, getDailyReportById, getDailyReportsByMember, getDailyReportsScope, getStreakRestoreStatus, restoreStreak } from "../controller/DailyReportControler.js";
import { protect } from "../middleware/auth.js";
// import { createDailyReport, getDailyReports, getDailyReportById } from "../controllers/dailyReport.controller.js";

// If you have auth middleware, use it here:
// import { protect } from "../middleware/auth.js";

const DailyReport = express.Router();

// Order matters: define static/specific routes before dynamic :id
DailyReport.get("/daily-reports", protect, getDailyReports);
DailyReport.get("/daily-reports/admin", protect, getDailyReportsByMember);
DailyReport.get("/daily-reports/scope", protect, getDailyReportsScope); // add adminOnly if needed
DailyReport.get("/daily-reports/streak-restore", protect, getStreakRestoreStatus);
DailyReport.post("/daily-reports/streak-restore", protect, restoreStreak);
DailyReport.post("/daily-reports", protect, createDailyReport);
DailyReport.get("/daily-reports/:id", protect, getDailyReportById);
export default DailyReport;