import express from "express"
import dotenv from "dotenv"
import mongoose from "mongoose"
import BookRouter from "./routers/BookRouter.js"
import { ErrorHandle } from "./middleware/ErorHandle.js"
import { NotFound } from "./middleware/NotFound.js"
import seedAllModules from "./seeds/index.js"
import AuthRouter from "./routers/AuthRouter.js"
import cors from 'cors'
import MemberRouter from "./routers/MemberRouter.js"
import RoleRouter from "./routers/RoleRouter.js"
import DailyReportRouter from "./routers/DailyReportRouter.js"
import issueRouter from "./routers/IssueRouter.js"
// import DailyReportRouter from "./routers/DailyReportRouter.js"

dotenv.config()
const app = express()
const PORT = process.env.PORT || 5000

app.use(express.json())

app.use(cors(
  {origin:"http://localhost:5173"}
))

app.use('/api',AuthRouter)

app.use("/api", BookRouter);
app.use("/api",MemberRouter);
app.use("/api", RoleRouter);
app.use('/api',issueRouter)
app.use('/api',DailyReportRouter)



app.post("/sync-and-migration", async (req, res) => {
  try {
 
    await mongoose.connection.db.listCollections().toArray();
    await mongoose.syncIndexes?.();

    // Run all seeders
    await seedAllModules();

    return res.json({
      success: true,
      message: "MongoDB migration & seeding completed successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: true,
      message: `Migration failed: ${error.message}`,
    });
  }
});



app.post("/db-alter/sync-seed", async (req, res) => {
  try {
    await seedAllModules();

    return res.json({
      success: true,
      message: "MongoDB seeding completed successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: true,
      message: `Seeding failed: ${error.message}`,
    });
  }
});





app.use(NotFound)
app.use(ErrorHandle);

mongoose.connect(process.env.MONGO_URI, )
  .then(() => console.log('✅ Connected to MongoDB successfully'))
  .catch((error) => console.log('❌ MongoDB Connection Error:', error));

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
