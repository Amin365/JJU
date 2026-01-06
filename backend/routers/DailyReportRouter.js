
import express from "express";
import { createDailyReport,getDailyReports,getDailyReportById} from "../controller/DailyReportControler.js";
import { protect } from "../middleware/auth.js";
// import { createDailyReport, getDailyReports, getDailyReportById } from "../controllers/dailyReport.controller.js";

// If you have auth middleware, use it here:
// import { protect } from "../middleware/auth.js";

const DailyReport = express.Router();



DailyReport.get("/daily-reports",protect, getDailyReports);
DailyReport.get("/daily-reports/:id", protect, getDailyReportById); 
DailyReport.post("/daily-reports", protect, createDailyReport);

export default DailyReport;