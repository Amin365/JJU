/**
 * Phase 5 - Admin Reporting Router
 * Routes for analytics and reporting endpoints
 */

import express from "express";
import rateLimit from "express-rate-limit";
import { protect } from "../middleware/auth.js";
import { responseCache } from "../middleware/responseCache.js";
import {
  getAdminReports,
  getTopReadersReport,
  getWeakestParticipation,
  getReadingHealth,
  getMonthlyComparison,
  getDepartmentComparison,
  getReportQuality,
  exportReportsCSV,
  getReportingSummary,
} from "../controller/ReportingController.js";

const ReportingRouter = express.Router();

// Rate limiter for reporting endpoints (expensive aggregations)
const reportingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({ message: "Too many requests. Please slow down." }),
});

const reportingCache = responseCache(Number.parseInt(process.env.REPORTING_CACHE_TTL_MS || "45000", 10));

// Admin reports with filters
ReportingRouter.get("/reporting/admin-reports", reportingLimiter, protect, reportingCache, getAdminReports);

// Top readers report
ReportingRouter.get("/reporting/top-readers", reportingLimiter, protect, reportingCache, getTopReadersReport);

// Weakest participation report
ReportingRouter.get("/reporting/weakest-participation", reportingLimiter, protect, reportingCache, getWeakestParticipation);

// Reading health indicators
ReportingRouter.get("/reporting/reading-health", reportingLimiter, protect, reportingCache, getReadingHealth);

// Monthly comparison (current vs previous)
ReportingRouter.get("/reporting/monthly-comparison", reportingLimiter, protect, reportingCache, getMonthlyComparison);

// Department comparison
ReportingRouter.get("/reporting/department-comparison", reportingLimiter, protect, reportingCache, getDepartmentComparison);

// Report quality summary
ReportingRouter.get("/reporting/report-quality", reportingLimiter, protect, reportingCache, getReportQuality);

// Export endpoints
ReportingRouter.get("/reporting/export/csv", reportingLimiter, protect, exportReportsCSV);

// Summary for scheduled reports
ReportingRouter.get("/reporting/summary", reportingLimiter, protect, reportingCache, getReportingSummary);

export default ReportingRouter;
