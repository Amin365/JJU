import BlogPost from "../models/BlogPost.js";
import { Op } from "sequelize";
import Comment, { Reply } from "../models/Comments.js";
import User from "../models/user.js";
import Role from "../models/Role.js";

/**
 * Endpoints:
 * GET  /blogposts/:id/comments
 * POST /blogposts/:id/comments
 * POST /blogposts/:id/comments/:commentId/replies
 * PUT  /blogposts/:id/comments/:commentId/like
 */

const isValidId = (id) => Number.isInteger(Number(id)) && Number(id) > 0;

const normalizeRole = (value) => {
  const roleName = String(value || "").toLowerCase();
  return /moderator|admin/.test(roleName) ? "Moderator" : "Member";
};

const pickAuthorName = (user) => {
  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
  return fullName || user?.username || user?.email || "Unknown";
};

const pickDisplayRole = (user, fallback = "Member") => {
  const roleFromUser = user?.role?.role || user?.role?.plural;
  if (typeof roleFromUser === "string" && roleFromUser.trim()) return roleFromUser;
  return fallback || "Member";
};

// GET COMMENTS (public)
export const getCommentsByPostId = async (req, res) => {
  try {
    const { id } = req.params; // blog post id

    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid blog post id" });
    }

    const exists = await BlogPost.findByPk(Number(id), { attributes: ["id"] });
    if (!exists) return res.status(404).json({ message: "Blog post not found" });

    // Public view: approved + pending (hidden/deleted excluded)
    const comments = await Comment.findAll({
      where: {
        post_id: Number(id),
        status: { [Op.in]: ["approved", "pending"] },
      },
      include: [
        {
          model: User,
          as: "authorUser",
          attributes: ["id", "first_name", "last_name", "username", "email", "profile_picture"],
          include: [{ model: Role, as: "role", attributes: ["role", "plural"], required: false }],
          required: false,
        },
        {
          model: Reply,
          as: "replies",
          required: false,
          where: { status: { [Op.in]: ["approved", "pending"] } },
          attributes: [
            "id",
            "content",
            "author_user_id",
            "author_name",
            "author_avatar",
            "author_role",
            "likes",
            "createdAt",
            "updatedAt",
          ],
          include: [
            {
              model: User,
              as: "authorUser",
              attributes: ["id", "first_name", "last_name", "username", "email", "profile_picture"],
              include: [{ model: Role, as: "role", attributes: ["role", "plural"], required: false }],
              required: false,
            },
          ],
        },
      ],
      order: [
        ["isPinned", "DESC"],
        ["isBestInsight", "DESC"],
        ["createdAt", "DESC"],
        [{ model: Reply, as: "replies" }, "createdAt", "ASC"],
      ],
    });

    const data = comments.map((comment) => {
      const c = comment.toJSON ? comment.toJSON() : comment;
      const commentAuthor = c.authorUser || null;
      const replies = Array.isArray(c.replies) ? c.replies : [];

      return {
        id: c.id,
        content: c.content,
        likes: c.likes || 0,
        likedBy: Array.isArray(c.likedBy) ? c.likedBy : [],
        isPinned: !!c.isPinned,
        isBestInsight: !!c.isBestInsight,
        status: c.status,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        author: {
          id: c.author_user_id,
          name: c.author_name || pickAuthorName(commentAuthor),
          avatar: c.author_avatar || commentAuthor?.profile_picture || "",
          role: pickDisplayRole(commentAuthor, c.author_role),
        },
        replies: replies.map((reply) => ({
          id: reply.id,
          content: reply.content,
          likes: reply.likes || 0,
          createdAt: reply.createdAt,
          updatedAt: reply.updatedAt,
          author: {
            id: reply.author_user_id,
            name: reply.author_name || pickAuthorName(reply.authorUser),
            avatar: reply.author_avatar || reply.authorUser?.profile_picture || "",
            role: pickDisplayRole(reply.authorUser, reply.author_role),
          },
        })),
      };
    });

    return res.status(200).json({ data });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

// CREATE COMMENT (auth required)
export const createCommentForPost = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userName = pickAuthorName(req.user);
    const userRole = normalizeRole(req.user?.role?.role || req.user?.role?.name || req.user?.role);

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params; // blog post id
    const { content } = req.body;

    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid blog post id" });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Comment content is required" });
    }

    const exists = await BlogPost.findByPk(Number(id), { attributes: ["id"] });
    if (!exists) return res.status(404).json({ message: "Blog post not found" });

    const comment = await Comment.create({
      post_id: Number(id),
      content: content.trim(),
      author_user_id: Number(userId),
      author_name: userName,
      author_avatar: req.user?.profile_picture || req.user?.avatar || "",
      author_role: userRole,
      likes: 0,
      likedBy: [],
      status: "pending",
    });

    return res.status(201).json({
      data: {
        id: comment.id,
        content: comment.content,
        likes: comment.likes || 0,
        likedBy: Array.isArray(comment.likedBy) ? comment.likedBy : [],
        isPinned: !!comment.isPinned,
        isBestInsight: !!comment.isBestInsight,
        status: comment.status,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        author: {
          id: comment.author_user_id,
          name: comment.author_name,
          avatar: comment.author_avatar || "",
          role: comment.author_role || "Member",
        },
        replies: [],
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

// CREATE REPLY (auth required)
export const createReplyForComment = async (req, res) => {
  try {
    const userId = req.user?.id;
    const userName = pickAuthorName(req.user);
    const userRole = normalizeRole(req.user?.role?.role || req.user?.role?.name || req.user?.role);

    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { id, commentId } = req.params;
    const { content } = req.body;

    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid blog post id" });
    }
    if (!isValidId(commentId)) {
      return res.status(400).json({ message: "Invalid comment id" });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Reply content is required" });
    }

    const exists = await BlogPost.findByPk(Number(id), { attributes: ["id"] });
    if (!exists) return res.status(404).json({ message: "Blog post not found" });

    const comment = await Comment.findOne({
      where: { id: Number(commentId), post_id: Number(id) },
    });
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const newReply = await Reply.create({
      comment_id: Number(commentId),
      content: content.trim(),
      author_user_id: Number(userId),
      author_name: userName,
      author_avatar: req.user?.profile_picture || req.user?.avatar || "",
      author_role: userRole,
      likes: 0,
      status: "pending",
    });

    return res.status(201).json({
      data: {
        id: newReply.id,
        content: newReply.content,
        likes: newReply.likes || 0,
        createdAt: newReply.createdAt,
        updatedAt: newReply.updatedAt,
        author: {
          id: newReply.author_user_id,
          name: newReply.author_name,
          avatar: newReply.author_avatar || "",
          role: newReply.author_role || "Member",
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

// TOGGLE COMMENT LIKE (auth required)
export const toggleCommentLike = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { id, commentId } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({ message: "Invalid blog post id" });
    }
    if (!isValidId(commentId)) {
      return res.status(400).json({ message: "Invalid comment id" });
    }

    const exists = await BlogPost.findByPk(Number(id), { attributes: ["id"] });
    if (!exists) return res.status(404).json({ message: "Blog post not found" });

    const comment = await Comment.findOne({
      where: { id: Number(commentId), post_id: Number(id) },
    });
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const likedBy = Array.isArray(comment.likedBy) ? [...comment.likedBy] : [];
    const alreadyLiked = likedBy.some((u) => String(u) === String(userId));

    let nextLikedBy;
    let nextLikes;

    if (alreadyLiked) {
      nextLikedBy = likedBy.filter((u) => String(u) !== String(userId));
      nextLikes = Math.max(0, (comment.likes || 0) - 1);
    } else {
      nextLikedBy = [...likedBy, userId];
      nextLikes = (comment.likes || 0) + 1;
    }

    comment.likedBy = nextLikedBy;
    comment.likes = nextLikes;
    await comment.save();

    return res.status(200).json({
      data: {
        commentId: comment.id,
        likes: comment.likes,
        liked: !alreadyLiked,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

export default {
  getCommentsByPostId,
  createCommentForPost,
  createReplyForComment,
  toggleCommentLike,
};