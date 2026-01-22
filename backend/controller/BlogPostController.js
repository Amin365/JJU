
import mongoose from "mongoose";
import BlogPost from "../models/BlogPost.js";
// import {CleanHtml} from "../utility/cleanHtml.js";

import cleanHtml from "../utility/cleanHtml.js"

export const createBlogPost = async (req, res) => {
  try {
    const userId = req.user?._id;

    const nameParts = [
      req.user?.first_name,
      req.user?.middle_name,
      req.user?.last_name,
    ].filter(Boolean);

    const userName =
      nameParts.join(" ") || req.user?.username || req.user?.email;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // req.body will be populated by multer for multipart/form-data routes.
    // Use a local body variable so we can safely reassign `tags`.
    const body = req.body || {};
    let { title, content, tags, blog_picture, relatedBook, status } = body;

    // Normalize tags:
    // - If client sent FormData and appended JSON string: parse it
    // - If a comma-separated string: split it
    // - Ensure final value is an array
    if (typeof tags === "string") {
      try {
        const parsed = JSON.parse(tags);
        if (Array.isArray(parsed)) tags = parsed;
        else tags = String(tags).split(",").map((t) => t.trim()).filter(Boolean);
      } catch {
        tags = String(tags).split(",").map((t) => t.trim()).filter(Boolean);
      }
    }
    if (!Array.isArray(tags)) tags = [];

    // If a file was uploaded via multer/cloudinary, the storage usually
    // attaches the remote URL on req.file.path or req.file.secure_url / req.file.url.
    const uploaded = req.file;
    const uploadedImageUrl =
      (uploaded && (uploaded.path || uploaded.secure_url || uploaded.url)) || null;

    // Prefer uploaded image URL over any blog_picture string sent in body
    const finalBlogPicture =
      uploadedImageUrl || (blog_picture && String(blog_picture).trim()) || null;

    // Basic validations
    if (!title || !String(title).trim()) {
      return res.status(400).json({ message: "Title is required" });
    }
    if (!content || !String(content).trim()) {
      return res.status(400).json({ message: "Content is required" });
    }
    if (!Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({ message: "Tags must be a non-empty array" });
    }

    const finalStatus = status ?? "Draft";
    if (!["Draft", "Published"].includes(finalStatus)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    // sanitize/clean functions should exist in your codebase
    const cleanTitle = cleanHtml(title);
    const cleanContent = cleanHtml(content);

    const post = await BlogPost.create({
      title: cleanTitle,
      content: cleanContent,
      tags: tags.map((t) => t.trim()),
      relatedBook: relatedBook || "",
      status: finalStatus,

      created_by: userId,
      author: userName,
      blog_picture: finalBlogPicture,

      likes: 0,
      views: 0,
    });

    return res.status(201).json({ data: post });
  } catch (err) {
    console.error("createBlogPost error:", err);
    return res
      .status(500)
      .json({ message: err.message || "Server error" });
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

    if(req.file){
        post.blog_picture = req.file.path;
    }
    // only creator can update
    if (post.created_by && String(post.created_by) !== String(userId)) {
      return res.status(403).json({ message: "You do not have permission to edit this post" });
    }

    const { title, content, tags, relatedBook, status } = req.body;

    if (title !== undefined) post.title = title;
    if (content !== undefined) post.content = content;
    // if (blog_picture !== undefined) post.blog_picture = blog_picture;
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





export const blogMetaPage = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).send("Invalid blog id");
    }

    const post = await BlogPost.findById(id).lean();

    if (!post || post.status !== "Published") {
      return res.status(404).send("Blog not found");
    }

    const title = post.title;
    const description = post.content
      .replace(/<[^>]*>/g, "")
      .slice(0, 160);

    const image =
      post.blog_picture ||
      "https://jjureadingclub.live/default-og.jpg";

    const redirectUrl = `https://jjureadingclub.live/blogs/${id}`;
    const shareUrl = `https://jjureadingclub.live/share/blog/${id}`;

    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <title>${title}</title>

          <!-- Open Graph -->
          <meta property="og:title" content="${title}" />
          <meta property="og:description" content="${description}" />
          <meta property="og:image" content="${image}" />
          <meta property="og:url" content="${shareUrl}" />
          <meta property="og:type" content="article" />
          <meta property="og:site_name" content="JJU Reading Club" />

          <!-- Twitter -->
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="${title}" />
          <meta name="twitter:description" content="${description}" />
          <meta name="twitter:image" content="${image}" />

          <!-- Redirect users -->
          <meta http-equiv="refresh" content="0; url=${redirectUrl}" />
        </head>
        <body></body>
      </html>
    `);
  } catch (err) {
    console.error("Meta error:", err);
    res.status(500).send("Server error");
  }
};
