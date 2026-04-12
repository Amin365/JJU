import AuditLog from "../models/AuditLog.js";
import { Op, col, fn, where as sqlWhere } from "sequelize";

const toPositiveInt = (value, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) => {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const toValidDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const hasAnyPermission = (req, perms = []) => {
  const userPerms = new Set((req.user?.permissions || []).map((p) => String(p).toLowerCase()));
  return perms.some((p) => userPerms.has(String(p).toLowerCase()));
};

const canAccessAuditLogs = (req) => {
  const roleName = String(req.user?.role?.role || req.user?.role?.plural || req.user?.role || "").toLowerCase();
  if (/super\s*admin/i.test(roleName) || /admin/i.test(roleName)) return true;
  return hasAnyPermission(req, ["View Role", "Edit Role", "Delete Role"]);
};

/**
 * Get audit logs with filtering and pagination
 * GET /audit-logs
 */
export const getAuditLogs = async (req, res, next) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });
    if (!canAccessAuditLogs(req)) return res.status(403).json({ message: "Access denied" });

    const {
      page = 1,
      limit = 50,
      action,
      entityType,
      entityId,
      userId,
      startDate,
      endDate,
      search,
    } = req.query;

    const filter = {};

    if (action) filter.action = action;
    if (entityType) filter.entityType = entityType;
    if (entityId) filter.entityId = entityId;
    if (userId) filter.user_id = userId;

    const start = toValidDate(startDate);
    const end = toValidDate(endDate);

    if (startDate && !start) {
      return res.status(400).json({ message: "Invalid startDate" });
    }
    if (endDate && !end) {
      return res.status(400).json({ message: "Invalid endDate" });
    }

    if (start || end) {
      filter.createdAt = {};
      if (start) filter.createdAt[Op.gte] = start;
      if (end) filter.createdAt[Op.lte] = end;
    }

    if (search) {
      const escaped = `%${String(search).replace(/[\\%_]/g, "\\$&").toLowerCase()}%`;
      filter[Op.or] = [
        sqlWhere(fn("LOWER", col("description")), { [Op.like]: escaped }),
        sqlWhere(fn("LOWER", col("entityLabel")), { [Op.like]: escaped }),
        sqlWhere(fn("LOWER", col("userEmail")), { [Op.like]: escaped }),
        sqlWhere(fn("LOWER", col("userName")), { [Op.like]: escaped }),
      ];
    }

    const pageNum = toPositiveInt(page, 1, 1);
    const perPage = toPositiveInt(limit, 50, 1, 100);
    const offset = (pageNum - 1) * perPage;

    const { rows: logs, count: total } = await AuditLog.findAndCountAll({
      where: filter,
      order: [["createdAt", "DESC"]],
      offset,
      limit: perPage,
    });

    return res.status(200).json({
      data: logs,
      page: pageNum,
      limit: perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * Get a single audit log entry by ID
 * GET /audit-logs/:id
 */
export const getAuditLogById = async (req, res, next) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });
    if (!canAccessAuditLogs(req)) return res.status(403).json({ message: "Access denied" });

    const { id } = req.params;
    const log = await AuditLog.findByPk(id);

    if (!log) {
      return res.status(404).json({ message: "Audit log not found" });
    }

    return res.status(200).json({ data: log });
  } catch (err) {
    return next(err);
  }
};

/**
 * Get audit log statistics
 * GET /audit-logs/stats
 */
export const getAuditLogStats = async (req, res, next) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });
    if (!canAccessAuditLogs(req)) return res.status(403).json({ message: "Access denied" });

    const days = toPositiveInt(req.query.days, 30, 1, 3650);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const rangeFilter = { createdAt: { [Op.gte]: startDate } };

    const [actionCountsRaw, entityCountsRaw, activeUsersRaw, dailyCountsRaw, totalCount] =
      await Promise.all([
        AuditLog.findAll({
          where: rangeFilter,
          attributes: ["action", [fn("COUNT", col("id")), "count"]],
          group: ["action"],
          order: [[fn("COUNT", col("id")), "DESC"]],
          raw: true,
        }),
        AuditLog.findAll({
          where: rangeFilter,
          attributes: ["entityType", [fn("COUNT", col("id")), "count"]],
          group: ["entityType"],
          order: [[fn("COUNT", col("id")), "DESC"]],
          raw: true,
        }),
        AuditLog.findAll({
          where: { ...rangeFilter, user_id: { [Op.ne]: null } },
          attributes: ["user_id", "userName", "userEmail", [fn("COUNT", col("id")), "count"]],
          group: ["user_id", "userName", "userEmail"],
          order: [[fn("COUNT", col("id")), "DESC"]],
          limit: 10,
          raw: true,
        }),
        AuditLog.findAll({
          where: rangeFilter,
          attributes: [
            [fn("DATE_FORMAT", col("createdAt"), "%Y-%m-%d"), "date"],
            [fn("COUNT", col("id")), "count"],
          ],
          group: [fn("DATE_FORMAT", col("createdAt"), "%Y-%m-%d")],
          order: [[fn("DATE_FORMAT", col("createdAt"), "%Y-%m-%d"), "ASC"]],
          raw: true,
        }),
        AuditLog.count({ where: rangeFilter }),
      ]);

    const actionCounts = actionCountsRaw.map((row) => ({
      key: row.action,
      count: Number(row.count || 0),
    }));

    const entityCounts = entityCountsRaw.map((row) => ({
      key: row.entityType,
      count: Number(row.count || 0),
    }));

    const activeUsers = activeUsersRaw.map((row) => ({
      userId: row.user_id,
      count: Number(row.count || 0),
      userName: row.userName,
      userEmail: row.userEmail,
    }));

    const dailyCounts = dailyCountsRaw.map((row) => ({
      date: row.date,
      count: Number(row.count || 0),
    }));

    return res.status(200).json({
      data: {
        totalCount,
        actionCounts,
        entityCounts,
        activeUsers,
        dailyCounts,
        period: days,
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * Get audit logs for a specific entity
 * GET /audit-logs/entity/:entityType/:entityId
 */
export const getEntityAuditLogs = async (req, res, next) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });
    if (!canAccessAuditLogs(req)) return res.status(403).json({ message: "Access denied" });

    const { entityType, entityId } = req.params;
    const pageNum = toPositiveInt(req.query.page, 1, 1);
    const perPage = toPositiveInt(req.query.limit, 20, 1, 100);
    const offset = (pageNum - 1) * perPage;

    const { rows: logs, count: total } = await AuditLog.findAndCountAll({
      where: { entityType, entityId },
      order: [["createdAt", "DESC"]],
      offset,
      limit: perPage,
    });

    return res.status(200).json({
      data: logs,
      page: pageNum,
      limit: perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * Get available action types
 * GET /audit-logs/actions
 */
export const getActionTypes = async (req, res, next) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });
    if (!canAccessAuditLogs(req)) return res.status(403).json({ message: "Access denied" });

    const rows = await AuditLog.findAll({
      attributes: [[fn("DISTINCT", col("action")), "action"]],
      raw: true,
    });

    return res.status(200).json({
      data: rows.map((r) => r.action).filter(Boolean),
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * Get available entity types
 * GET /audit-logs/entity-types
 */
export const getEntityTypes = async (req, res, next) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });
    if (!canAccessAuditLogs(req)) return res.status(403).json({ message: "Access denied" });

    const rows = await AuditLog.findAll({
      attributes: [[fn("DISTINCT", col("entityType")), "entityType"]],
      raw: true,
    });

    return res.status(200).json({
      data: rows.map((r) => r.entityType).filter(Boolean),
    });
  } catch (err) {
    return next(err);
  }
};

export default {
  getAuditLogs,
  getAuditLogById,
  getAuditLogStats,
  getEntityAuditLogs,
  getActionTypes,
  getEntityTypes,
};