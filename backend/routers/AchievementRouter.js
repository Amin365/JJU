import express from "express";
import { protect } from "../middleware/auth.js";
import { getAchievements, getMyAchievements } from "../controller/AchievementController.js";

const AchievementRouter = express.Router();

AchievementRouter.get("/achievements", getAchievements);
AchievementRouter.get("/users/me/achievements", protect, getMyAchievements);

export default AchievementRouter;
