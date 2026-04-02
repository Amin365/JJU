"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.bulkInsert("roles", [
      { role: "Super Admin", plural: "Super Admins", system: true, color: "#6366f1" },
      { role: "Members", plural: "Members", system: true, color: "#4f46e5" },
      { role: "Moderator", plural: "Moderators", system: true, color: "#10b981" },
    ], { ignoreDuplicates: true });

    const [roleCheck] = await queryInterface.sequelize.query(
      "SELECT role FROM roles WHERE role IN ('Super Admin','Members','Moderator')"
    );
    if (roleCheck.length < 3) {
      throw new Error("Seeder verification failed: required system roles were not created.");
    }

    await queryInterface.bulkInsert("permission_categories", [
      { name: "General Settings", system: true },
      { name: "Main System", system: true },
      { name: "States", system: true },
    ], { ignoreDuplicates: true });

    const [categories] = await queryInterface.sequelize.query(
      "SELECT id, name FROM permission_categories WHERE name IN ('General Settings','Main System','States')"
    );
    const map = Object.fromEntries(categories.map((c) => [c.name, c.id]));

    const permissions = [
      ["Preferences", "General Settings", ""],
      ["Add Users", "General Settings", "Manage Users"],
      ["Edit Users", "General Settings", "Manage Users"],
      ["Delete Users", "General Settings", "Manage Users"],
      ["View Users", "General Settings", "Manage Users"],
      ["View Detail", "General Settings", "Manage Users"],
      ["Add Role", "General Settings", "Manage Roles"],
      ["Edit Role", "General Settings", "Manage Roles"],
      ["Delete Role", "General Settings", "Manage Roles"],
      ["View Role", "General Settings", "Manage Roles"],
      ["Manage States", "States", ""],
      ["Manage Books", "Main System", ""],
      ["Manage Members", "Main System", ""],
      ["Manage Issues", "Main System", ""],
      ["View Moderator", "Main System", ""],
      ["View Members", "Main System", ""],
    ];

    await queryInterface.bulkInsert(
      "permissions",
      permissions.map(([permission, categoryName, groupedUnder]) => ({
        permission,
        category_id: map[categoryName] || null,
        grouped_under: groupedUnder || null,
        system: true,
      })),
      { ignoreDuplicates: true }
    );

    const [roleRows] = await queryInterface.sequelize.query(
      "SELECT id, role FROM roles WHERE role IN ('Super Admin','Members','Moderator')"
    );
    const roles = Object.fromEntries(roleRows.map((r) => [r.role, r.id]));
    const [permRows] = await queryInterface.sequelize.query("SELECT id, permission FROM permissions");
    const perms = Object.fromEntries(permRows.map((p) => [p.permission, p.id]));

    const superMappings = Object.values(perms).map((permissionId) => ({
      role_id: roles["Super Admin"],
      permission_id: permissionId,
      system: true,
      added_by_id: null,
    }));
    const moderatorMappings = ["View Moderator", "View Users"].map((name) => ({
      role_id: roles["Moderator"],
      permission_id: perms[name],
      system: true,
      added_by_id: null,
    }));
    const memberMappings = ["View Members"].map((name) => ({
      role_id: roles["Members"],
      permission_id: perms[name],
      system: true,
      added_by_id: null,
    }));

    await queryInterface.bulkInsert(
      "role_permissions",
      [...superMappings, ...moderatorMappings, ...memberMappings].filter((r) => r.role_id && r.permission_id),
      { ignoreDuplicates: true }
    );

    await queryInterface.bulkInsert("audit_logs", [
      {
        user_id: null,
        user_email: null,
        user_name: "system",
        user_role: "system",
        action: "system.settings_updated",
        entity_type: "Other",
        entity_id: null,
        entity_label: "sequelize-seed",
        changes: JSON.stringify({ seeded: true }),
        meta: JSON.stringify({ source: "sequelize/seeders/20260402153000-system-roles-and-permissions.cjs" }),
        ip_address: null,
        user_agent: "seed-script",
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("role_permissions", null, {});
    await queryInterface.bulkDelete("permissions", null, {});
    await queryInterface.bulkDelete("permission_categories", null, {});
    await queryInterface.bulkDelete("roles", { role: ["Super Admin", "Members", "Moderator"] }, {});
  },
};
