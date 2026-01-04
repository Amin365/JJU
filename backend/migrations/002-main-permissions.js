import RolePermission from '../models/RolePermission.js';
import UserPermission from '../models/UserPermission.js';
import Permission from '../models/Permissions.js';
import PermissionCategory from '../models/PermissionCategory.js';
import Role from '../models/Role.js';
import User from '../models/user.js';
import mongoose from 'mongoose';

export const mainPermissions = async () => {
  try {
    // -------------------------------
    // Create permission categories
    // -------------------------------
    const categoriesData = [
      { name: "General Settings", system: true },
      { name: "Main System", system: true },
      { name: "States", system: true },
    ];

    const categories = {};
    for (const cat of categoriesData) {
      const category = await PermissionCategory.findOneAndUpdate(
        { name: cat.name },
        cat,
        { upsert: true, new: true }
      );
      categories[cat.name] = category;
    }

    // -------------------------------
    // Create permissions
    // -------------------------------
    const permissionsData = [
      { permission: "Preferences", system: true, category: categories["General Settings"]._id, grouped_under: "" },
      { permission: "Add Users", system: true, category: categories["General Settings"]._id, grouped_under: "Manage Users" },
      { permission: "Edit Users", system: true, category: categories["General Settings"]._id, grouped_under: "Manage Users" },
      { permission: "Delete Users", system: true, category: categories["General Settings"]._id, grouped_under: "Manage Users" },
      { permission: "View Users", system: true, category: categories["General Settings"]._id, grouped_under: "Manage Users" },
      { permission: "View Detail", system: true, category: categories["General Settings"]._id, grouped_under: "Manage Users" },
      { permission: "Add Role", system: true, category: categories["General Settings"]._id, grouped_under: "Manage Roles" },
      { permission: "Edit Role", system: true, category: categories["General Settings"]._id, grouped_under: "Manage Roles" },
      { permission: "Delete Role", system: true, category: categories["General Settings"]._id, grouped_under: "Manage Roles" },
      { permission: "View Role", system: true, category: categories["General Settings"]._id, grouped_under: "Manage Roles" },
      { permission: "Chat", system: true, category: categories["General Settings"]._id, grouped_under: "" },
      { permission: "My Tasks", system: true, category: categories["General Settings"]._id, grouped_under: "" },
      { permission: "Manage Companies", system: true, category: categories["General Settings"]._id, grouped_under: "" },
      { permission: "HR Manager", system: true, category: categories["Main System"]._id, grouped_under: "" },
      { permission: "Archive", system: true, category: categories["Main System"]._id, grouped_under: "" },
      { permission: "Accountant", system: true, category: categories["Main System"]._id, grouped_under: "" },
      { permission: "Projects", system: true, category: categories["Main System"]._id, grouped_under: "" },
      { permission: "Task", system: true, category: categories["States"]._id, grouped_under: "" },
      { permission: "Report", system: true, category: categories["States"]._id, grouped_under: "" },
    ];

    const permissions = {};
    for (const perm of permissionsData) {
      const permission = await Permission.findOneAndUpdate(
        { permission: perm.permission },
        perm,
        { upsert: true, new: true }
      );
      permissions[perm.permission] = permission;
    }

    // -------------------------------
    // Assign permissions to system roles
    // -------------------------------
    const rolesData = await Role.find({});
    const roles = {};
    rolesData.forEach(r => { roles[r.role] = r; });

    const SUPER_ADMIN_USER = await User.findOne({ username: "superadmin" });

    // Assign all permissions to Super Admin
    if (roles["Super Admin"] && SUPER_ADMIN_USER) {
      for (const perm of Object.values(permissions)) {
        await RolePermission.findOneAndUpdate(
          { role: roles["Super Admin"]._id, permission: perm._id },
          { role: roles["Super Admin"]._id, permission: perm._id, system: true, added_by: SUPER_ADMIN_USER._id },
          { upsert: true, new: true }
        );

        await UserPermission.findOneAndUpdate(
          { user: SUPER_ADMIN_USER._id, permission: perm._id },
          { user: SUPER_ADMIN_USER._id, permission: perm._id, added_by: SUPER_ADMIN_USER._id },
          { upsert: true, new: true }
        );
      }
    }

    console.log("Permissions initialized ✅");
  } catch (error) {
    console.error("Error initializing permissions:", error);
  }
};
