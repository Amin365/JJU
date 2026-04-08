/**
 * Phase 8 - Audit Log Controller
 * API endpoints for querying audit logs (admin only)
 */

import AuditLog from "../models/AuditLog.js";
import { Op, col, fn, where as sqlWhere } from "sequelize";

/**
 * Get audit logs with filtering and pagination
 * GET /audit-logs
 * Query params: page, limit, action, entityType, entityId, userId, startDate, endDate
 */
export const getAuditLogs = async (req, res, next) => {
  try {
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

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt[Op.gte] = new Date(startDate);
      if (endDate) filter.createdAt[Op.lte] = new Date(endDate);
    }

    if (search) {
      const escaped = `%${String(search).replace(/[%_]/g, "\\$&").toLowerCase()}%`;
      filter[Op.or] = [
        sqlWhere(fn("LOWER", col("description")), { [Op.like]: escaped }),
        sqlWhere(fn("LOWER", col("entityLabel")), { [Op.like]: escaped }),
        sqlWhere(fn("LOWER", col("userEmail")), { [Op.like]: escaped }),
        sqlWhere(fn("LOWER", col("userName")), { [Op.like]: escaped }),
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
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
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days, 10));
    const rangeFilter = { createdAt: { [Op.gte]: startDate } };

    const [actionCountsRaw, entityCountsRaw, activeUsersRaw, dailyCountsRaw, totalCount] = await Promise.all([
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
        attributes: [[fn("DATE_FORMAT", col("createdAt"), "%Y-%m-%d"), "_id"], [fn("COUNT", col("id")), "count"]],
        group: [fn("DATE_FORMAT", col("createdAt"), "%Y-%m-%d")],
        order: [[fn("DATE_FORMAT", col("createdAt"), "%Y-%m-%d"), "ASC"]],
        raw: true,
      }),
      AuditLog.count({ where: rangeFilter }),
    ]);

    const actionCounts = actionCountsRaw.map((row) => ({ _id: row.action, count: Number(row.count || 0) }));
    const entityCounts = entityCountsRaw.map((row) => ({ _id: row.entityType, count: Number(row.count || 0) }));
    const activeUsers = activeUsersRaw.map((row) => ({
      _id: row.user_id,
      count: Number(row.count || 0),
      userName: row.userName,
      userEmail: row.userEmail,
    }));
    const dailyCounts = dailyCountsRaw.map((row) => ({ _id: row._id, count: Number(row.count || 0) }));

    return res.status(200).json({
      data: {
        totalCount,
        actionCounts,
        entityCounts,
        activeUsers,
        dailyCounts,
        period: parseInt(days, 10),
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
    const { entityType, entityId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * perPage;

    const filter = { entityType, entityId };
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
 * Get available action types
 * GET /audit-logs/actions
 */
export const getActionTypes = async (req, res, next) => {
  try {
    const rows = await AuditLog.findAll({
      attributes: [[fn("DISTINCT", col("action")), "action"]],
      raw: true,
    });
    return res.status(200).json({ data: rows.map((r) => r.action).filter(Boolean) });
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
    const rows = await AuditLog.findAll({
      attributes: [[fn("DISTINCT", col("entityType")), "entityType"]],
      raw: true,
    });
    return res.status(200).json({ data: rows.map((r) => r.entityType).filter(Boolean) });
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
