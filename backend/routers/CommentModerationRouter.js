import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { requirePermission } from "../middleware/role.js";
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
CommentModerationRouter.get("/comments/moderation/queue", protect, requirePermission(["Manage Members", "Manage Issues", "View Members"]), apiLimiter, getModerationQueue);
CommentModerationRouter.get("/comments/moderation/stats", protect, requirePermission(["Manage Members", "Manage Issues", "View Members"]), apiLimiter, getModerationStats);

// Moderate a comment (approve/hide/delete/restore)
CommentModerationRouter.put("/comments/:commentId/moderate", protect, requirePermission(["Manage Members", "Manage Issues"]), apiLimiter, moderateComment);

// Report a comment (any authenticated user)
CommentModerationRouter.post("/comments/:commentId/report", protect, apiLimiter, reportComment);

// Clear reports from a comment (admin/moderator only)
CommentModerationRouter.delete("/comments/:commentId/reports", protect, requirePermission(["Manage Members", "Manage Issues"]), apiLimiter, clearReports);

// Toggle pin status (admin/moderator only)
CommentModerationRouter.put("/comments/:commentId/pin", protect, requirePermission(["Manage Members", "Manage Issues"]), apiLimiter, togglePinComment);

// Toggle best insight status (admin/moderator only)
CommentModerationRouter.put("/comments/:commentId/best-insight", protect, requirePermission(["Manage Members", "Manage Issues"]), apiLimiter, toggleBestInsight);

export default CommentModerationRouter;
