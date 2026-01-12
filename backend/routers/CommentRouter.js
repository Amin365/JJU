
import { Router } from "express";
import { protect } from "../middleware/auth.js";
import {
  getCommentsByPostId,
  createCommentForPost,
  createReplyForComment,
  toggleCommentLike
} from "../controller/CommentsCtroller.js";

const CommentRouter = Router();

// Mount this under /blogposts in your main routes file:
// app.use("/blogposts", blogPostCommentRoutes);

CommentRouter.get("/:id/comments", getCommentsByPostId);
CommentRouter.post("/:id/comments", protect, createCommentForPost);
CommentRouter.post("/:id/comments/:commentId/replies", protect, createReplyForComment);
CommentRouter.post("/:id/comments/:commentId/like", protect, toggleCommentLike);
export default CommentRouter;