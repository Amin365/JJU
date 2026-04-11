import crypto from "crypto";
import User from "../models/user.js";
import Member from "../models/Members.js";

export default async function runUuidIdentifiersMigration() {
  try {
    const [users, members] = await Promise.all([
      User.findAll({ attributes: ["id", "uuid"] }),
      Member.findAll({ attributes: ["id", "uuid"] }),
    ]);

    for (const user of users) {
      if (!user.uuid) {
        await user.update({ uuid: crypto.randomUUID() });
      }
    }

    for (const member of members) {
      if (!member.uuid) {
        await member.update({ uuid: crypto.randomUUID() });
      }
    }

    console.log("UUID identifiers migration completed ✅");
  } catch (error) {
    console.error("UUID identifiers migration failed:", error);
  }
}
