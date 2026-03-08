import express from "express";
import { protect } from "../middleware/auth.js";
import { apiLimiter } from "../utility/rateLimiter.js";
import { getAchievements, getMyAchievements } from "../controller/AchievementController.js";

const AchievementRouter = express.Router();

AchievementRouter.get("/achievements", apiLimiter, getAchievements);
AchievementRouter.get("/users/me/achievements", apiLimiter, protect, getMyAchievements);

export default AchievementRouter;
