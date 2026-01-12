
import mongoose from "mongoose";
import BlogPost from "../models/BlogPost.js";

// CREATE (JWT required)
export const createBlogPost = async (req, res) => {
  try {
    // Normalize user identity from JWT payload (protect middleware attaches full user document)
    const userId = req.user?._id;
    const nameParts = [req.user?.first_name, req.user?.middle_name, req.user?.last_name]
      .filter(Boolean)
      .join(" ");
    const userName = nameParts || req.user?.username || req.user?.email;

    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!userName) return res.status(400).json({ message: "User name not found in token" });

    const { title, content, tags, blog_picture, relatedBook, status } = req.body;

    if (!title?.trim()) return res.status(400).json({ message: "Title is required" });
    if (!content?.trim()) return res.status(400).json({ message: "Content is required" });

    if (!Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({ message: "Tags must be a non-empty array" });
    }

    const finalStatus = status ?? "Draft";
    if (!["Draft", "Published"].includes(finalStatus)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const post = await BlogPost.create({
      title: title.trim(),
      content,
      tags,
      blog_picture: blog_picture || "",
      relatedBook: relatedBook || "",
      status: finalStatus,

      created_by: userId,
      author: userName,

      likes: 0,
      views: 0,
    });

    return res.status(201).json({ data: post });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

// LIST (auth required; supports scope=all|mine|public, search, pagination)
export const getBlogPosts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      q = "",
      status,
      scope = "all", // all | mine | public
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * perPage;

    const filter = {};

    // Scope handling
    if (scope === "mine") {
      if (!req.user?._id) return res.status(401).json({ message: "Unauthorized" });
      filter.created_by = req.user._id;
    } else if (scope === "public") {
      filter.status = "Published";
    }

    // Optional status filter
    if (status) {
      const allowed = ["Draft", "Published"];
      if (!allowed.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      filter.status = status;
    }

    // Search across title, content, author, tags
    if (q && String(q).trim()) {
      const regex = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { title: regex },
        { content: regex },
        { author: regex },
        { tags: regex },
      ];
    }

    const [items, total] = await Promise.all([
      BlogPost.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(perPage)
        .lean(),
      BlogPost.countDocuments(filter),
    ]);

    return res.status(200).json({
      data: items,
      total,
      page: pageNum,
      limit: perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

// GET BY ID (public)
export const getBlogPostById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid blog post id" });
    }

    const post = await BlogPost.findById(id).populate("created_by", "name email");
    if (!post) return res.status(404).json({ message: "Blog post not found" });

    return res.status(200).json({ data: post });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

// UPDATE (JWT required, only owner)
export const updateBlogPost = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid blog post id" });
    }

    const post = await BlogPost.findById(id);
    if (!post) return res.status(404).json({ message: "Blog post not found" });

    // only creator can update
    if (post.created_by && String(post.created_by) !== String(userId)) {
      return res.status(403).json({ message: "You do not have permission to edit this post" });
    }

    const { title, content, tags, blog_picture, relatedBook, status } = req.body;

    if (title !== undefined) post.title = title;
    if (content !== undefined) post.content = content;
    if (blog_picture !== undefined) post.blog_picture = blog_picture;
    if (relatedBook !== undefined) post.relatedBook = relatedBook;

    if (tags !== undefined) {
      if (!Array.isArray(tags)) {
        return res.status(400).json({ message: "Tags must be an array" });
      }
      post.tags = tags;
    }

    if (status !== undefined) {
      if (!["Draft", "Published"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      post.status = status;
    }

    await post.save();

    return res.status(200).json({ data: post });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

// DELETE (JWT required, only owner)
export const deleteBlogPost = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid blog post id" });
    }

    const post = await BlogPost.findById(id);
    if (!post) return res.status(404).json({ message: "Blog post not found" });

    if (post.created_by && String(post.created_by) !== String(userId)) {
      return res.status(403).json({ message: "You do not have permission to delete this post" });
    }

    await BlogPost.deleteOne({ _id: id });
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error" });
  }
};