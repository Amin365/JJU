import express from "express"
import dotenv from "dotenv"
import mongoose from "mongoose"
import BookRouter from "./routers/BookRouter.js"
import { ErrorHandle } from "./middleware/ErorHandle.js"
import { NotFound } from "./middleware/NotFound.js"
import seedAllModules from "./seeds/index.js"
import AuthRouter from "./routers/AuthRouter.js"
import cors from 'cors'
import RoleRouter from "./routers/RoleRouter.js"
import MemberRouter from "./routers/MemberRouter.js"
import DailyReportRouter from "./routers/DailyReportRouter.js"
import NotificationRouter from "./routers/NotificationRouter.js"
import { startIssueDueScheduler } from "./modules/issueDueScheduler.js"
import issueRouter from "./routers/IssueRouter.js"
import ModeratorRouter from "./routers/ModeratorRouter.js"
import UserRouter from "./routers/UserRouter.js"
import BlogRouter from "./routers/BlogRouter.js"
import CommentRouter from "./routers/CommentRouter.js"
import helmet from "helmet";
import {xss} from "express-xss-sanitizer";
import hpp from 'hpp'
import cookieParser from "cookie-parser";

import path from 'path'
import { fileURLToPath } from "url";  
import Mpesarouter from "./routers/MpesRouter.js"

dotenv.config()
const app = express()
const PORT = process.env.PORT || 5000
app.set("trust proxy", 1);
app.use(express.json())
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(cors(
  {origin:"http://localhost:5173",
  credentials:true
}
))

// app.use(cors({
//   origin: "http://64.225.119.153",
//   credentials: true
// }))


// after express app created, before routes:
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: [
          "'self'",
          "data:",
          "https://res.cloudinary.com", // allow Cloudinary
          "https://i.pravatar.cc",     // allow avatar service
          "https://res.cloudinary.com",
"https://images.unsplash.com"          
          // include any other domains you need
        ],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  })
);
app.use(xss());
app.use(hpp());




app.use('/api',AuthRouter)

app.use("/api", BookRouter);
// Register moderator routes before member routes so static paths like
// `/api/members/unassigned` handled by ModeratorRouter instead of being
// captured by MemberRouter's dynamic `:id` param.
app.use('/api',ModeratorRouter)
app.use("/api",MemberRouter);
app.use("/api", RoleRouter);
app.use('/api',issueRouter)
app.use('/api',DailyReportRouter)
app.use('/api',NotificationRouter)
app.use('/api',UserRouter)
app.use('/api',BlogRouter)
app.use('/api/blogposts', CommentRouter)
app.use('/api',Mpesarouter)

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

if (process.env.NODE_ENV === 'production') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  app.use(express.static(path.join(__dirname, '../frontend/dist')));

  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}



app.use(NotFound)
app.use(ErrorHandle);

mongoose.connect(process.env.NODE_ENV === 'production' ? process.env.Mongo_atlas : process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB successfully')
    // start background scheduler for due/overdue notifications
    startIssueDueScheduler();
  })
  .catch((error) => console.log('❌ MongoDB Connection Error:', error));

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
