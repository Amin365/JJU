import express from "express";
import {
  getModerators,
  getAssignedMembers,
  getMembersForAssignment,
  assignMemberToModerator,
  unassignMemberFromModerator,
  getModeratorWorkspace,
} from "../controller/ModeratorController.js";
import { protect } from "../middleware/auth.js"
import { apiLimiter } from "../utility/rateLimiter.js"


const ModeratorRouter = express.Router();

// Fetch all moderators (users with moderator role)
ModeratorRouter.get("/moderators",  getModerators);

// Moderator workspace
ModeratorRouter.get("/moderators/:moderatorId/workspace", protect, apiLimiter, getModeratorWorkspace);

// Fetch members assigned to a specific moderator
ModeratorRouter.get("/moderators/:moderatorId/members", protect, getAssignedMembers);

// Fetch all unassigned members for assignment
ModeratorRouter.get("/members/unassigned", protect, getMembersForAssignment);

// Assign a member to a moderator
ModeratorRouter.post("/moderators/:moderatorId/assign", protect, assignMemberToModerator);

// Unassign a member from a moderator
ModeratorRouter.delete("/moderators/:moderatorId/unassign/:memberId", protect, unassignMemberFromModerator);

export default ModeratorRouter;