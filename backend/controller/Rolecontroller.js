import Role from "../models/Role.js";
import { Op } from "sequelize";
import Permission from "../models/Permissions.js";
import PermissionCategory from "../models/PermissionCategory.js";
import RolePermission from "../models/RolePermission.js";
import { logRoleAction, logAudit, buildChanges } from "../utility/auditLog.js";

/**
 * Create a new role
 * POST /roles
 */
export async function createRole(req, res) {
  try {
    const { role, plural, color, system } = req.body;

    if (!role || !role.trim()) {
      return res.status(400).json({ message: "Role name is required" });
    }

    const savedRole = await Role.create({
      role: role.trim(),
      plural: plural?.trim() || "",
      color: color || "#00000000",
      system: system || false,
    });

    await logRoleAction("created", savedRole, req.user, req, {
      description: `Role "${savedRole.role}" was created`,
    });

    return res.status(201).json({ data: savedRole });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "Role with this name already exists" });
    }
    return res.status(500).json({ message: "Server error", error: error.message });
  }
}

/**
 * Get all roles with optional permission counts
 * GET /roles
 */
export async function getRoles(req, res) {
  try {
    const { includePermissions } = req.query;
    const roles = await Role.findAll();

    if (includePermissions !== "true") {
      return res.status(200).json({ data: roles });
    }

    const permissionCounts = await RolePermission.findAll({
      attributes: ["role_id", [Role.sequelize.fn("COUNT", Role.sequelize.col("id")), "count"]],
      group: ["role_id"],
      raw: true,
    });

    const countMap = {};
    permissionCounts.forEach((pc) => {
      countMap[String(pc.role_id)] = Number(pc.count || 0);
    });

    const data = roles.map((r) => ({
      ...r.toJSON(),
      permissionCount: countMap[String(r.id)] || 0,
    }));

    return res.status(200).json({ data });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
}

/**
 * Get a single role by ID with its permissions
 * GET /roles/:id
 */
export async function getRoleById(req, res) {
  try {
    const { id } = req.params;

    if (!Number.isInteger(Number(id))) {
      return res.status(400).json({ message: "Invalid role ID" });
    }

    const role = await Role.findByPk(id);
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    const rolePermissions = await RolePermission.findAll({
      where: { role_id: id },
      include: [
        {
          model: Permission,
          as: "permission",
          include: [{ model: PermissionCategory, as: "category", required: false }],
          required: false,
        },
      ],
    });

    const permissions = rolePermissions
      .filter((rp) => rp.permission)
      .map((rp) => ({
        _id: rp.permission.id,
        permission: rp.permission.permission,
        category: rp.permission.category?.name || null,
        grouped_under: rp.permission.grouped_under,
        system: rp.system,
        addedAt: rp.createdAt || null,
      }));

    return res.status(200).json({ data: { ...role.toJSON(), permissions } });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
}

/**
 * Update a role
 * PUT /roles/:id
 */
export async function updateRole(req, res) {
  try {
    const { id } = req.params;
    const { role, plural, color } = req.body;

    if (!Number.isInteger(Number(id))) {
      return res.status(400).json({ message: "Invalid role ID" });
    }

    const existing = await Role.findByPk(id);
    if (!existing) {
      return res.status(404).json({ message: "Role not found" });
    }

    if (existing.system) {
      return res.status(403).json({ message: "Cannot modify system roles" });
    }

    const before = existing.toJSON();
    const updateData = {};
    if (role !== undefined) updateData.role = role.trim();
    if (plural !== undefined) updateData.plural = plural?.trim() || "";
    if (color !== undefined) updateData.color = color;

    if (Object.keys(updateData).length > 0) {
      await existing.update(updateData);
    }

    const changes = buildChanges(before, existing.toJSON(), ["role", "plural", "color"]);
    await logRoleAction("updated", existing, req.user, req, {
      changes,
      description: `Role "${existing.role}" was updated`,
    });

    return res.status(200).json({ data: existing });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "Role with this name already exists" });
    }
    return res.status(500).json({ message: "Server error", error: error.message });
  }
}

/**
 * Delete a role
 * DELETE /roles/:id
 */
export async function deleteRole(req, res) {
  try {
    const { id } = req.params;

    if (!Number.isInteger(Number(id))) {
      return res.status(400).json({ message: "Invalid role ID" });
    }

    const role = await Role.findByPk(id);
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    if (role.system) {
      return res.status(403).json({ message: "Cannot delete system roles" });
    }

    const roleSnapshot = role.toJSON();
    await Role.sequelize.transaction(async (transaction) => {
      await RolePermission.destroy({ where: { role_id: id }, transaction });
      await role.destroy({ transaction });
    });
    await logRoleAction("deleted", roleSnapshot, req.user, req, {
      description: `Role "${roleSnapshot.role}" was deleted`,
    });

    return res.status(200).json({ message: "Role deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
}

/**
 * Add permission to role
 * POST /roles/:id/permissions
 */
export async function addPermissionToRole(req, res) {
  try {
    const { id } = req.params;
    const { permissionId } = req.body;

    if (!Number.isInteger(Number(id))) {
      return res.status(400).json({ message: "Invalid role ID" });
    }
    if (!Number.isInteger(Number(permissionId))) {
      return res.status(400).json({ message: "Invalid permission ID" });
    }

    const role = await Role.findByPk(id);
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    const permission = await Permission.findByPk(permissionId);
    if (!permission) {
      return res.status(404).json({ message: "Permission not found" });
    }

    const existing = await RolePermission.findOne({
      where: { role_id: id, permission_id: permissionId },
    });
    if (existing) {
      return res.status(409).json({ message: "Permission already assigned to role" });
    }

    await RolePermission.create({
      role: id,
      permission: permissionId,
      added_by: req.user?.id || null,
    });

    await logAudit({
      user: req.user,
      action: "role.permission_added",
      entityType: "Role",
      entityId: role.id,
      entityLabel: role.role,
      req,
      meta: { permissionId, permissionName: permission.permission },
      description: `Permission "${permission.permission}" added to role "${role.role}"`,
    });

    return res.status(201).json({ message: "Permission added to role" });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
}

/**
 * Remove permission from role
 * DELETE /roles/:id/permissions/:permissionId
 */
export async function removePermissionFromRole(req, res) {
  try {
    const { id, permissionId } = req.params;

    if (!Number.isInteger(Number(id))) {
      return res.status(400).json({ message: "Invalid role ID" });
    }
    if (!Number.isInteger(Number(permissionId))) {
      return res.status(400).json({ message: "Invalid permission ID" });
    }

    const role = await Role.findByPk(id);
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    const permission = await Permission.findByPk(permissionId);
    const deleted = await RolePermission.destroy({
      where: { role_id: id, permission_id: permissionId },
    });

    if (!deleted) {
      return res.status(404).json({ message: "Role-permission mapping not found" });
    }

    await logAudit({
      user: req.user,
      action: "role.permission_removed",
      entityType: "Role",
      entityId: role.id,
      entityLabel: role.role,
      req,
      meta: { permissionId, permissionName: permission?.permission },
      description: `Permission "${permission?.permission}" removed from role "${role.role}"`,
    });

    return res.status(200).json({ message: "Permission removed from role" });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
}

/**
 * Get all permissions grouped by category
 * GET /permissions
 */
export async function getPermissions(req, res) {
  try {
    const permissions = await Permission.findAll({
      include: [{ model: PermissionCategory, as: "category", required: false }],
    });

    const grouped = {};
    permissions.forEach((p) => {
      const categoryName = p.category?.name || "Uncategorized";
      if (!grouped[categoryName]) grouped[categoryName] = [];
      grouped[categoryName].push(p);
    });

    return res.status(200).json({ data: { permissions, grouped } });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
}

/**
 * Get permission categories
 * GET /permission-categories
 */
export async function getPermissionCategories(req, res) {
  try {
    const categories = await PermissionCategory.findAll();
    return res.status(200).json({ data: categories });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
}

/**
 * Get permission matrix (all roles with their permissions)
 * GET /permission-matrix
 */
export async function getPermissionMatrix(req, res) {
  try {
    const roles = await Role.findAll();
    const permissions = await Permission.findAll({
      include: [{ model: PermissionCategory, as: "category", required: false }],
    });
    const rolePermissions = await RolePermission.findAll();

    const matrix = {};
    roles.forEach((role) => {
      matrix[String(role.id)] = { role, permissions: new Set() };
    });

    rolePermissions.forEach((rp) => {
      const roleId = String(rp.role_id);
      if (matrix[roleId]) {
        matrix[roleId].permissions.add(String(rp.permission_id));
      }
    });

    const result = roles.map((role) => ({
      ...role.toJSON(),
      permissions: Array.from(matrix[String(role.id)]?.permissions || []),
    }));

    const groupedPermissions = {};
    permissions.forEach((p) => {
      const categoryName = p.category?.name || "Uncategorized";
      if (!groupedPermissions[categoryName]) groupedPermissions[categoryName] = [];
      groupedPermissions[categoryName].push(p);
    });

    return res.status(200).json({
      data: {
        roles: result,
        permissions,
        groupedPermissions,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
}

/**
 * Bulk update role permissions
 * PUT /roles/:id/permissions/bulk
 */
export async function bulkUpdateRolePermissions(req, res) {
  try {
    const { id } = req.params;
    const { permissionIds } = req.body;

    if (!Number.isInteger(Number(id))) {
      return res.status(400).json({ message: "Invalid role ID" });
    }
    if (!Array.isArray(permissionIds)) {
      return res.status(400).json({ message: "permissionIds must be an array" });
    }

    const role = await Role.findByPk(id);
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    const currentPermissions = await RolePermission.findAll({
      where: { role_id: id },
      attributes: ["permission_id"],
      raw: true,
    });
    const currentPermIds = new Set(currentPermissions.map((rp) => String(rp.permission_id)));

    const sanitizedNewIds = permissionIds
      .map((pid) => parseInt(pid, 10))
      .filter((pid) => Number.isInteger(pid));
    const newPermIds = new Set(sanitizedNewIds.map((pid) => String(pid)));

    const toAdd = [...newPermIds]
      .filter((pid) => !currentPermIds.has(pid))
      .map((pid) => parseInt(pid, 10));
    const toRemove = [...currentPermIds]
      .filter((pid) => !newPermIds.has(pid))
      .map((pid) => parseInt(pid, 10));

    if (toRemove.length > 0) {
      await RolePermission.destroy({
        where: { role_id: id, permission_id: { [Op.in]: toRemove } },
      });
    }

    if (toAdd.length > 0) {
      const newMappings = toAdd.map((pid) => ({
        role: id,
        permission: pid,
        added_by: req.user?.id || null,
      }));
      await RolePermission.bulkCreate(newMappings);
    }

    await logAudit({
      user: req.user,
      action: "role.updated",
      entityType: "Role",
      entityId: role.id,
      entityLabel: role.role,
      req,
      meta: { added: toAdd.length, removed: toRemove.length },
      description: `Role "${role.role}" permissions updated: ${toAdd.length} added, ${toRemove.length} removed`,
    });

    return res.status(200).json({
      message: "Role permissions updated",
      added: toAdd.length,
      removed: toRemove.length,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
}

export default {
  createRole,
  getRoles,
  getRoleById,
  updateRole,
  deleteRole,
  addPermissionToRole,
  removePermissionFromRole,
  getPermissions,
  getPermissionCategories,
  getPermissionMatrix,
  bulkUpdateRolePermissions,
};
