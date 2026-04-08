import Role from "../models/Role.js";
import { Op } from 'sequelize';
import Permission from "../models/Permissions.js";
import PermissionCategory from "../models/PermissionCategory.js";
import RolePermission from "../models/RolePermission.js";
import UserPermission from "../models/UserPermission.js";
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
    
    // Audit log
    await logRoleAction("created", savedRole, req.user, req, {
      description: `Role "${savedRole.role}" was created`,
    });

    res.status(201).json({ data: savedRole });
  } catch (error) {
    if (error?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "Role with this name already exists" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
  }
}

/**
 * Get all roles with optional permission counts
 * GET /roles
 */
export async function getRoles(req, res) {
  try {
    const { includePermissions } = req.query;

    const roles = await Role.findAll({
      order: [["role", "ASC"]],
    });

    if (includePermissions === "true") {
      const permissionCounts = await RolePermission.findAll({
        attributes: [
          "role",
          [RolePermission.sequelize.fn("COUNT", RolePermission.sequelize.col("permission")), "count"],
        ],
        group: ["role"],
        raw: true,
      });

      const countMap = new Map(
        permissionCounts.map((pc) => [Number(pc.role), Number(pc.count) || 0])
      );

      return res.status(200).json({
        data: roles.map((r) => ({
          ...r.toJSON(),
          permissionCount: countMap.get(Number(r.id)) || 0,
        })),
      });
    }

    res.status(200).json({ data: roles.map((r) => r.toJSON()) });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
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
      where: { role_id: Number(id) },
      raw: true,
    });

    const permissionIds = [...new Set(rolePermissions.map((rp) => rp.permission_id).filter(Boolean))];
    const permissionsRaw = permissionIds.length
      ? await Permission.findAll({
          where: { id: { [Op.in]: permissionIds } },
          raw: true,
        })
      : [];

    const categoryIds = [...new Set(permissionsRaw.map((p) => p.category_id).filter(Boolean))];
    const categories = categoryIds.length
      ? await PermissionCategory.findAll({
          where: { id: { [Op.in]: categoryIds } },
          attributes: ["id", "name"],
          raw: true,
        })
      : [];

    const permissionMap = new Map(permissionsRaw.map((p) => [p.id, p]));
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    const permissions = rolePermissions
      .map((rp) => {
        const permission = permissionMap.get(rp.permission_id);
        if (!permission) return null;
        return {
          id: permission.id,
          permission: permission.permission,
          category: permission.category_id ? categoryMap.get(permission.category_id) || null : null,
          grouped_under: permission.grouped_under,
          system: rp.system,
          addedAt: null,
        };
      })
      .filter(Boolean);

    res.status(200).json({ data: { ...role.toJSON(), permissions } });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
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

    // Don't allow editing system roles
    if (existing.system) {
      return res.status(403).json({ message: "Cannot modify system roles" });
    }

    const updateData = {};
    if (role) updateData.role = role.trim();
    if (plural !== undefined) updateData.plural = plural?.trim() || "";
    if (color !== undefined) updateData.color = color;

    await Role.update(updateData, { where: { id: Number(id) } });
    const updated = await Role.findByPk(id);

    // Audit log
    const changes = buildChanges(existing, updated, ["role", "plural", "color"]);
    await logRoleAction("updated", updated, req.user, req, {
      changes,
      description: `Role "${updated.role}" was updated`,
    });

    res.status(200).json({ data: updated });
  } catch (error) {
    if (error?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "Role with this name already exists" });
    }
    res.status(500).json({ message: "Server error", error: error.message });
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

    // Don't allow deleting system roles
    if (role.system) {
      return res.status(403).json({ message: "Cannot delete system roles" });
    }

    // Delete role-permission mappings
    await RolePermission.destroy({ where: { role_id: Number(id) } });

    // Delete the role
    await Role.destroy({ where: { id: Number(id) } });

    // Audit log
    await logRoleAction("deleted", role, req.user, req, {
      description: `Role "${role.role}" was deleted`,
    });

    res.status(200).json({ message: "Role deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
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

    // Check if mapping already exists
    const existing = await RolePermission.findOne({
      where: { role_id: Number(id), permission_id: Number(permissionId) },
    });
    if (existing) {
      return res.status(409).json({ message: "Permission already assigned to role" });
    }

    await RolePermission.create({
      role_id: Number(id),
      permission_id: Number(permissionId),
      added_by: req.user?.id || null,
    });

    // Audit log
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

    res.status(201).json({ message: "Permission added to role" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
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

    const deletedCount = await RolePermission.destroy({
      where: { role_id: Number(id), permission_id: Number(permissionId) },
    });
    if (!deletedCount) {
      return res.status(404).json({ message: "Role-permission mapping not found" });
    }

    // Audit log
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

    res.status(200).json({ message: "Permission removed from role" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
}

/**
 * Get all permissions grouped by category
 * GET /permissions
 */
export async function getPermissions(req, res) {
  try {
    const permissions = await Permission.findAll({ raw: true });
    const categoryIds = [...new Set(permissions.map((p) => p.category_id).filter(Boolean))];
    const categories = categoryIds.length
      ? await PermissionCategory.findAll({
          where: { id: { [Op.in]: categoryIds } },
          attributes: ["id", "name"],
          raw: true,
        })
      : [];
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    const permissionsWithCategory = permissions.map((p) => ({
      ...p,
      category: p.category_id ? { id: p.category_id, name: categoryMap.get(p.category_id) || null } : null,
    }));

    // Group by category
    const grouped = {};
    permissionsWithCategory.forEach((p) => {
      const catName = p.category?.name || "Uncategorized";
      if (!grouped[catName]) {
        grouped[catName] = [];
      }
      grouped[catName].push(p);
    });

    res.status(200).json({ data: { permissions: permissionsWithCategory, grouped } });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
}

/**
 * Get permission categories
 * GET /permission-categories
 */
export async function getPermissionCategories(req, res) {
  try {
    const categories = await PermissionCategory.findAll({ order: [["name", "ASC"]] });
    res.status(200).json({ data: categories });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
}

/**
 * Get permission matrix (all roles with their permissions)
 * GET /permission-matrix
 */
export async function getPermissionMatrix(req, res) {
  try {
    // Get all roles
    const roles = await Role.findAll({ raw: true });

    // Get all permissions grouped by category
    const permissions = await Permission.findAll({ raw: true });
    const categoryIds = [...new Set(permissions.map((p) => p.category_id).filter(Boolean))];
    const categories = categoryIds.length
      ? await PermissionCategory.findAll({
          where: { id: { [Op.in]: categoryIds } },
          attributes: ["id", "name"],
          raw: true,
        })
      : [];
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
    const permissionsWithCategory = permissions.map((p) => ({
      ...p,
      category: p.category_id ? { id: p.category_id, name: categoryMap.get(p.category_id) || null } : null,
    }));

    // Get all role-permission mappings
    const rolePermissions = await RolePermission.findAll({ raw: true });

    // Build matrix
    const matrix = {};
    roles.forEach((role) => {
      matrix[role.id.toString()] = {
        role,
        permissions: new Set(),
      };
    });

    rolePermissions.forEach((rp) => {
      const roleId = String(rp.role_id);
      if (matrix[roleId]) {
        matrix[roleId].permissions.add(String(rp.permission_id));
      }
    });

    // Convert Sets to arrays and group permissions by category
    const result = roles.map((role) => ({
      ...role,
      permissions: Array.from(matrix[role.id.toString()].permissions),
    }));

    // Group permissions by category
    const groupedPermissions = {};
    permissionsWithCategory.forEach((p) => {
      const catName = p.category?.name || "Uncategorized";
      if (!groupedPermissions[catName]) {
        groupedPermissions[catName] = [];
      }
      groupedPermissions[catName].push(p);
    });

    res.status(200).json({
      data: {
        roles: result,
        permissions: permissionsWithCategory,
        groupedPermissions,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
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

    // Get current permissions
    const normalizedPermissionIds = permissionIds
      .map((pid) => Number(pid))
      .filter((pid) => Number.isInteger(pid));

    const currentPermissions = await RolePermission.findAll({
      where: { role_id: Number(id) },
      raw: true,
    });
    const currentPermIds = new Set(currentPermissions.map((rp) => Number(rp.permission_id)));
    const newPermIds = new Set(normalizedPermissionIds);

    // Permissions to add
    const toAdd = [...newPermIds].filter((pid) => !currentPermIds.has(pid));
    
    // Permissions to remove
    const toRemove = [...currentPermIds].filter((pid) => !newPermIds.has(pid));

    // Remove old permissions
    if (toRemove.length > 0) {
      await RolePermission.destroy({
        where: {
          role_id: Number(id),
          permission_id: { [Op.in]: toRemove },
        },
      });
    }

    // Add new permissions
    if (toAdd.length > 0) {
      const newMappings = toAdd.map((pid) => ({
        role_id: Number(id),
        permission_id: pid,
        added_by: req.user?.id || null,
      }));
      await RolePermission.bulkCreate(newMappings);
    }

    // Audit log
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

    res.status(200).json({
      message: "Role permissions updated",
      added: toAdd.length,
      removed: toRemove.length,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
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

