import express from "express";
import { protect } from "../middleware/auth.js";
import { apiLimiter } from "../utility/rateLimiter.js";
import {
  createChallenge, getChallenges, getChallengeById,
  joinChallenge, getChallengeLeaderboard, updateChallengeStatus, getMyProgress
} from "../controller/ChallengeController.js";

const ChallengeRouter = express.Router();

ChallengeRouter.post("/challenges", apiLimiter, protect, createChallenge);
ChallengeRouter.get("/challenges", getChallenges);
ChallengeRouter.get("/challenges/:id", getChallengeById);
ChallengeRouter.post("/challenges/:id/join", apiLimiter, protect, joinChallenge);
ChallengeRouter.get("/challenges/:id/leaderboard", getChallengeLeaderboard);
ChallengeRouter.get("/challenges/:id/my-progress", protect, getMyProgress);
ChallengeRouter.patch("/challenges/:id/status", apiLimiter, protect, updateChallengeStatus);

export default ChallengeRouter;
