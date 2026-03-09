import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { apiLimiter } from "../utility/rateLimiter.js";
import {
  getModerationQueue,
  getModerationStats,
  moderateComment,
  reportComment,
  clearReports,
  togglePinComment,
  toggleBestInsight,
} from "../controller/CommentModerationController.js";

const CommentModerationRouter = Router();

// Moderation queue and stats (admin/moderator only)
CommentModerationRouter.get("/comments/moderation/queue", protect, apiLimiter, getModerationQueue);
CommentModerationRouter.get("/comments/moderation/stats", protect, apiLimiter, getModerationStats);

// Moderate a comment (approve/hide/delete/restore)
CommentModerationRouter.put("/comments/:commentId/moderate", protect, apiLimiter, moderateComment);

// Report a comment (any authenticated user)
CommentModerationRouter.post("/comments/:commentId/report", protect, apiLimiter, reportComment);

// Clear reports from a comment (admin/moderator only)
CommentModerationRouter.delete("/comments/:commentId/reports", protect, apiLimiter, clearReports);

// Toggle pin status (admin/moderator only)
CommentModerationRouter.put("/comments/:commentId/pin", protect, apiLimiter, togglePinComment);

// Toggle best insight status (admin/moderator only)
CommentModerationRouter.put("/comments/:commentId/best-insight", protect, apiLimiter, toggleBestInsight);

export default CommentModerationRouter;
