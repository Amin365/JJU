import express from "express";
import { createDailyReport, getDailyReports, getDailyReportById, getDailyReportsByMember, getDailyReportsScope, getStreakRestoreStatus, restoreStreak, getDailyReportsPublic, getLeaderboardEnhanced, updateDailyReportStatus } from "../controller/DailyReportControler.js";
import { protect } from "../middleware/auth.js";
import { apiLimiter } from "../utility/rateLimiter.js";
// import { createDailyReport, getDailyReports, getDailyReportById } from "../controllers/dailyReport.controller.js";

// If you have auth middleware, use it here:
// import { protect } from "../middleware/auth.js";

const DailyReport = express.Router();

// Order matters: define static/specific routes before dynamic :id
DailyReport.get("/daily-reports", protect, getDailyReports);

DailyReport.get("/daily-reports/admin", protect, getDailyReportsByMember);

DailyReport.get("/daily-reports/scope", protect, getDailyReportsScope);
 // add adminOnly if needed
DailyReport.get("/daily-reports/public", getDailyReportsPublic);

DailyReport.get("/daily-reports/streak-restore", protect, getStreakRestoreStatus);

DailyReport.post("/daily-reports/streak-restore", protect, restoreStreak);

DailyReport.get("/daily-reports/leaderboard", apiLimiter, getLeaderboardEnhanced);

DailyReport.post("/daily-reports", protect, createDailyReport);

DailyReport.patch("/daily-reports/:id/status", protect, updateDailyReportStatus);

DailyReport.get(
	"/daily-reports/:id",
	(req, res, next) => {
		const id = Number(req.params.id);
		if (!Number.isInteger(id) || id <= 0) return next("route");
		return next();
	},
	protect,
	getDailyReportById
);

export default DailyReport;