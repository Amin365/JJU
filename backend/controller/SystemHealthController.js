/**
 * Phase 8 - System Health Controller
 * Provides endpoints for monitoring system health, failed jobs, and queue status
 */

import Notification from "../models/Notification.js";
import sequelize from "../config/database.js";
import { Op, col, fn, QueryTypes } from 'sequelize';
import User from "../models/user.js";
import AuditLog from "../models/AuditLog.js";
import DailyReport from "../models/DailyReport.js";

// Track scheduled job status in memory
const jobStatus = {
  issueDueScheduler: {
    name: "Issue Due Scheduler",
    lastRun: null,
    status: "unknown",
    errors: [],
  },
  dailyReportMissingScheduler: {
    name: "Daily Report Missing Scheduler",
    lastRun: null,
    status: "unknown",
    errors: [],
  },
  scheduledReporting: {
    name: "Scheduled Reporting",
    lastRun: null,
    status: "unknown",
    errors: [],
  },
  scheduledPublishing: {
    name: "Scheduled Publishing",
    lastRun: null,
    status: "unknown",
    errors: [],
  },
};

/**
 * Update job status (called from scheduler modules)
 * @param {string} jobName - Name of the job
 * @param {string} status - 'success', 'error', 'running'
 * @param {string} error - Error message if status is 'error'
 */
export function updateJobStatus(jobName, status, error = null) {
  if (jobStatus[jobName]) {
    jobStatus[jobName].lastRun = new Date();
    jobStatus[jobName].status = status;
    if (error) {
      jobStatus[jobName].errors.unshift({
        message: error,
        timestamp: new Date(),
      });
      // Keep only last 10 errors
      if (jobStatus[jobName].errors.length > 10) {
        jobStatus[jobName].errors = jobStatus[jobName].errors.slice(0, 10);
      }
    } else if (status === "success") {
      // Clear errors on success
      jobStatus[jobName].errors = [];
    }
  }
}

/**
 * Get overall system health
 * GET /system-health
 */
export const getSystemHealth = async (req, res, next) => {
  try {
    const health = {
      status: "healthy",
      timestamp: new Date(),
      checks: {},
    };

    let dbConnected = true;
    try {
      await sequelize.authenticate();
    } catch {
      dbConnected = false;
    }

    // Check MySQL connection
    health.checks.database = {
      name: "MySQL",
      status: dbConnected ? "connected" : "disconnected",
      healthy: dbConnected,
    };

    // Check environment variables
    const requiredEnvVars = [
      "JWT_SECRET",
      "DB_NAME",
      "DB_USER",
      "DB_HOST",
    ];
    const optionalEnvVars = [
      "RESEND_API_KEY",
      "VAPID_PUBLIC_KEY",
      "VAPID_PRIVATE_KEY",
      "CLOUDINARY_CLOUD_NAME",
    ];

    const missingRequired = requiredEnvVars.filter((v) => !process.env[v]);
    const missingOptional = optionalEnvVars.filter((v) => !process.env[v]);

    health.checks.environment = {
      name: "Environment Variables",
      status: missingRequired.length === 0 ? "configured" : "missing required",
      healthy: missingRequired.length === 0,
      details: {
        missingRequired,
        missingOptional,
      },
    };

    // Check email configuration
    health.checks.email = {
      name: "Email Service",
      status: process.env.RESEND_API_KEY ? "configured" : "not configured",
      healthy: true, // Email is optional
    };

    // Check push notifications
    health.checks.push = {
      name: "Push Notifications",
      status:
        process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
          ? "configured"
          : "not configured",
      healthy: true, // Push is optional
    };

    // Check scheduled jobs
    health.checks.scheduledJobs = {
      name: "Scheduled Jobs",
      status: "running",
      healthy: true,
      jobs: { ...jobStatus },
    };

    // Determine overall health
    const criticalChecks = ["database", "environment"];
    const unhealthy = criticalChecks.filter((c) => !health.checks[c]?.healthy);
    if (unhealthy.length > 0) {
      health.status = "unhealthy";
    }

    return res.status(200).json({ data: health });
  } catch (err) {
    return next(err);
  }
};

/**
 * Get notification failure stats
 * GET /system-health/notifications
 */
export const getNotificationHealth = async (req, res, next) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days, 10));

    const where = { createdAt: { [Op.gte]: startDate } };

    // Count notifications by type and status
    const groupedStats = await Notification.findAll({
      where,
      attributes: [
        "type",
        "read",
        [fn("COUNT", col("id")), "count"],
      ],
      group: ["type", "read"],
      raw: true,
    });
    const notificationStats = groupedStats.map((row) => ({
      _id: { type: row.type, read: !!row.read },
      count: Number(row.count || 0),
    }));

    // Get total notifications
    const totalNotifications = await Notification.count({ where });

    // Get unread notifications
    const unreadNotifications = await Notification.count({
      where: { ...where, read: false },
    });

    // Get notifications per day
    const dailyRows = await Notification.findAll({
      where,
      attributes: [[fn("DATE_FORMAT", col("createdAt"), "%Y-%m-%d"), "day"], [fn("COUNT", col("id")), "count"]],
      group: [fn("DATE_FORMAT", col("createdAt"), "%Y-%m-%d")],
      order: [[fn("DATE_FORMAT", col("createdAt"), "%Y-%m-%d"), "ASC"]],
      raw: true,
    });
    const dailyNotifications = dailyRows.map((row) => ({
      _id: row.day,
      count: Number(row.count || 0),
    }));

    return res.status(200).json({
      data: {
        totalNotifications,
        unreadNotifications,
        notificationStats,
        dailyNotifications,
        period: parseInt(days, 10),
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * Get scheduled job status
 * GET /system-health/jobs
 */
export const getJobStatus = async (req, res, next) => {
  try {
    return res.status(200).json({
      data: {
        jobs: Object.entries(jobStatus).map(([key, value]) => ({
          _id: key,
          ...value,
        })),
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * Get database statistics
 * GET /system-health/database
 */
export const getDatabaseStats = async (req, res, next) => {
  try {
    const queryInterface = sequelize.getQueryInterface();
    const tablesRaw = await queryInterface.showAllTables();
    const tableNames = tablesRaw.map((entry) => {
      if (typeof entry === "string") return entry;
      if (entry?.tableName) return entry.tableName;
      if (entry?.table_name) return entry.table_name;
      return String(entry);
    });

    const stats = await Promise.all(
      tableNames.map(async (tableName) => {
        const safeTableName = String(tableName).replace(/`/g, "``");
        const rows = await sequelize.query(
          `SELECT COUNT(*) AS count FROM \`${safeTableName}\``,
          { type: QueryTypes.SELECT }
        );
        return {
          name: tableName,
          documentCount: Number(rows?.[0]?.count || 0),
        };
      })
    );

    // Sort by row count descending
    stats.sort((a, b) => b.documentCount - a.documentCount);

    // Get database size stats
    const sizeRows = await sequelize.query(
      `
      SELECT
        IFNULL(SUM(data_length), 0) AS dataSize,
        IFNULL(SUM(index_length), 0) AS indexSize,
        IFNULL(SUM(data_length + index_length), 0) AS storageSize,
        COUNT(*) AS tableCount
      FROM information_schema.TABLES
      WHERE table_schema = DATABASE()
      `,
      { type: QueryTypes.SELECT }
    );
    const dbStats = sizeRows?.[0] || {};

    return res.status(200).json({
      data: {
        collections: stats,
        totalCollections: Number(dbStats.tableCount || tableNames.length),
        totalDocuments: stats.reduce((sum, s) => sum + s.documentCount, 0),
        dataSize: Number(dbStats.dataSize || 0),
        storageSize: Number(dbStats.storageSize || 0),
        indexes: null,
        indexSize: Number(dbStats.indexSize || 0),
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * Get recent errors from audit log
 * GET /system-health/errors
 */
export const getRecentErrors = async (req, res, next) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days, 10));

    // Get failed login attempts
    const failedLogins = await AuditLog.count({
      where: {
        action: "auth.failed_login",
        createdAt: { [Op.gte]: startDate },
      },
    });

    // Get error actions
    const errorActions = await AuditLog.findAll({
      where: {
        createdAt: { [Op.gte]: startDate },
        action: { [Op.regexp]: "error|failed|rejected" },
      },
      order: [["createdAt", "DESC"]],
      limit: 50,
    });

    return res.status(200).json({
      data: {
        failedLogins,
        recentErrors: errorActions,
        period: parseInt(days, 10),
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * Get system summary for dashboard
 * GET /system-health/summary
 */
export const getSystemSummary = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      activeUsers,
      todayAuditLogs,
      pendingNotifications,
    ] = await Promise.all([
      User.count(),
      User.count({ where: { status: "Active" } }),
      AuditLog.count({ where: { createdAt: { [Op.gte]: today } } }),
      Notification.count({ where: { read: false } }),
    ]);

    // Get database connection status
    let dbStatus = "connected";
    try {
      await sequelize.authenticate();
    } catch {
      dbStatus = "disconnected";
    }

    return res.status(200).json({
      data: {
        database: dbStatus,
        totalUsers,
        activeUsers,
        todayAuditLogs,
        pendingNotifications,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version,
      },
    });
  } catch (err) {
    return next(err);
  }
};

export default {
  getSystemHealth,
  getNotificationHealth,
  getJobStatus,
  getDatabaseStats,
  getRecentErrors,
  getSystemSummary,
  updateJobStatus,
};
