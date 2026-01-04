// src/utils/statePermissions.js
import Permission from '../models/Permissions.js';
import RolePermission from '../models/RolePermission.js';
import UserPermission from '../models/UserPermission.js';

export const statePermissions = async () => {
  try {
    // Example: adding permissions 209 to 300 to SUPER_ADMIN role & user
    for (let i = 209; i <= 300; i++) {
      await RolePermission.findOneAndUpdate(
        { role: 1, permission: i }, // SUPER_ADMIN role = 1
        { system: true, added_by: 1, role: 1, permission: i },
        { upsert: true, new: true }
      );

      await UserPermission.findOneAndUpdate(
        { user: 1, permission: i }, // SUPER_ADMIN user = 1
        { added_by: 1, user: 1, permission: i },
        { upsert: true, new: true }
      );
    }

    console.log("State permissions initialized ✅");
  } catch (error) {
    console.error("Error initializing state permissions:", error);
  }
};
