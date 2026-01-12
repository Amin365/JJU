
import mongoose from "mongoose";
import BlogPost from "../models/BlogPost.js";
import Comment from "../models/Comments.js";

/**
 * Endpoints used by your frontend:
 * GET  /blogposts/:id/comments
 * POST /blogposts/:id/comments                 (JWT required)
 * POST /blogposts/:id/comments/:commentId/replies (JWT required)
 */

// GET COMMENTS (public)
export const getCommentsByPostId = async (req, res) => {
  try {
    const { id } = req.params; // blogpost id

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid blog post id" });
    }

    // ensure post exists (optional but nice)
    const exists = await BlogPost.exists({ _id: id });
    if (!exists) return res.status(404).json({ message: "Blog post not found" });

    const comments = await Comment.find({ postId: id })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ data: comments });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

// CREATE COMMENT (auth required)
export const createCommentForPost = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userName = req.user?.name || req.user?.username || req.user?.email;
    const rawRole = req.user?.role;
    // const userRole =
    //   (typeof rawRole === "string" && rawRole) ||
    //   rawRole?.roleName ||
    //   "Member";
    const userRole = req.user?.role?.roleName || req.user?.role || "Member";

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params; // blogpost id
    const { content } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid blog post id" });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Comment content is required" });
    }

    const exists = await BlogPost.exists({ _id: id });
    if (!exists) return res.status(404).json({ message: "Blog post not found" });

    const comment = await Comment.create({
      postId: id,
      content: content.trim(),
      author: {
        userId,
        name: userName || "Unknown",
        avatar: req.user?.avatar || "",
        role: typeof userRole === "string" ? userRole : "Member",
      },
      likes: 0,
      replies: [],
    });

    return res.status(201).json({ data: comment });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

// CREATE REPLY (auth required)
export const createReplyForComment = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userName = req.user?.name || req.user?.username || req.user?.email;
    const rawRole = req.user?.role;
    // const userRole =
    //   (typeof rawRole === "string" && rawRole) ||
    //   rawRole?.roleName ||
    //   "Member";
    const userRole = req.user?.role?.roleName || req.user?.role || "Member";

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { id, commentId } = req.params; // id = blogpostId (for validation), commentId = comment
    const { content } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid blog post id" });
    }
    if (!mongoose.isValidObjectId(commentId)) {
      return res.status(400).json({ message: "Invalid comment id" });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Reply content is required" });
    }

    const exists = await BlogPost.exists({ _id: id });
    if (!exists) return res.status(404).json({ message: "Blog post not found" });

    const comment = await Comment.findOne({ _id: commentId, postId: id });
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    comment.replies.push({
      content: content.trim(),
      author: {
        userId,
        name: userName || "Unknown",
        avatar: req.user?.avatar || "",
        role: typeof userRole === "string" ? userRole : "Member",
      },
      likes: 0,
    });

    await comment.save();

    // return the newly added reply (last element)
    const newReply = comment.replies[comment.replies.length - 1];

    return res.status(201).json({ data: newReply });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error" });
  }
};



export const toggleCommentLike = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { id, commentId } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid blog post id" });
    }
    if (!mongoose.isValidObjectId(commentId)) {
      return res.status(400).json({ message: "Invalid comment id" });
    }

    // optional: ensure post exists
    const exists = await BlogPost.exists({ _id: id });
    if (!exists) return res.status(404).json({ message: "Blog post not found" });

    const comment = await Comment.findOne({ _id: commentId, postId: id });
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    comment.likedBy = comment.likedBy || [];

    const alreadyLiked = comment.likedBy.some((u) => String(u) === String(userId));

    if (alreadyLiked) {
      // unlike
      comment.likedBy = comment.likedBy.filter((u) => String(u) !== String(userId));
      comment.likes = Math.max(0, (comment.likes || 0) - 1);
    } else {
      // like
      comment.likedBy.push(userId);
      comment.likes = (comment.likes || 0) + 1;
    }

    await comment.save();

    return res.status(200).json({
      data: {
        commentId: comment._id,
        likes: comment.likes,
        liked: !alreadyLiked,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error" });
  }
};