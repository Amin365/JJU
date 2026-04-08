// src/utils/systemRoles.js
import Role from "../models/Role.js";
import User from "../models/user.js";

export const systemRoles = async () => {
  try {
    // Define the roles
    const rolesData = [
      { role: "Super Admin", plural: "Super Admins", system: true, color: "#6366f1" },
      { role: "Members", plural: "Members", system: true, color: "#4f46e5" },
      { role: "Moderator", plural: "Moderators", system: true, color: "#10b981" },
    ];

    // Insert or update roles
    const createdRoles = [];
    for (const roleData of rolesData) {
      const [role, created] = await Role.findOrCreate({
        where: { role: roleData.role },
        defaults: roleData,
      });
      if (!created) {
        await role.update(roleData);
      }
      createdRoles.push(role);
    }

    // Assign Super Admin role to first user
    const user = await User.findOne({ where: { username: "superadmin" } }); // or some criteria
    if (user) {
      const superAdminRole = createdRoles.find(r => r.role === "Super Admin");
      if (superAdminRole) {
        await user.update({ role_id: superAdminRole.id });
      }
    }

    console.log("System roles initialized ✅");
  } catch (error) {
    console.error("Error initializing system roles:", error);
  }
};

// Default export so runMigrations can pick it up
export default async function runSystemRoles() {
  await systemRoles();
}
