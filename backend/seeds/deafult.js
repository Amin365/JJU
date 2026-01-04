import { runMigrations } from "../migrations/index.js";
import Role from "../models/Role.js";
import User from "../models/user.js";




async function MigrateDefaults() {
  try {
    const existingUser = await User.findOne({
      username: "aminbashir07",
    });

    if (existingUser) {
      console.log("✅ Default user already exists");
      return;
    }
     
   
    await User.create({
      first_name: "Amin",
      last_name: "Bashir",
      username: "aminbashir07",
      email: "aminbashir@gmail.com",
      password: "aminbashir07",
   
    });
    await runMigrations();
    console.log('Migrations ran successfully')

  
  } catch (error) {
    console.error("❌ Error creating default user:", error);
  }
}

export default MigrateDefaults;
