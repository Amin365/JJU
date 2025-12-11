import User from "../module/user.js";




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
      username: "aminbashir07",
      email: "aminbashir@gmail.com",
      password: "aminbashir07",
      role: "admin",
    });

    console.log("✅ Default admin user created successfully");
  } catch (error) {
    console.error("❌ Error creating default user:", error);
  }
}

export default MigrateDefaults;
