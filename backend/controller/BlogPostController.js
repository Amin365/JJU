import mongoose from "mongoose";
import BlogPost from "../models/BlogPost.js";
import cleanHtml from "../utility/cleanHtml.js";

/* ======================================================
   Helpers
====================================================== */

const normalizeTags = (tags) => {
  if (!tags) return [];

  if (Array.isArray(tags)) {
    return tags.map(t => String(t).trim()).filter(Boolean);
  }

  if (typeof tags === "string") {
    try {
      const parsed = JSON.parse(tags);
      if (Array.isArray(parsed)) {
        return parsed.map(t => String(t).trim()).filter(Boolean);
      }
    } catch {
      return tags.split(",").map(t => t.trim()).filter(Boolean);
    }
  }

  return [];
};

const normalizeUserName = (user) => {
  const parts = [
    user?.first_name,
    user?.middle_name,
    user?.last_name,
  ].filter(Boolean);

  let name = parts.join(" ") || user?.username || user?.email || "";

  const words = name.trim().replace(/\s+/g, " ").split(" ");
  const unique = [...new Set(words.map(w => w.toLowerCase()))];
  return unique.map(w => words.find(o => o.toLowerCase() === w)).join(" ");
};

const getUploadedImage = (file) =>
  file?.path || file?.secure_url || file?.url || "";

/* ======================================================
   CREATE BLOG POST
====================================================== */

export const createBlogPost = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const {
      title,
      content,
      tags,
      relatedBook,
      status = "Draft",
      author_type,
      author_name,
      author_picture,
    } = req.body || {};

    if (!title?.trim()) return res.status(400).json({ message: "Title is required" });
    if (!content?.trim()) return res.status(400).json({ message: "Content is required" });

    const finalTags = normalizeTags(tags);
    if (!finalTags.length) {
      return res.status(400).json({ message: "Tags must be a non-empty array" });
    }

    if (!["Draft", "Published"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const blogImage = getUploadedImage(req.files?.image?.[0]) || null;

    let finalAuthorName = "";
    let finalAuthorPicture = "";

    if (author_type === "me") {
      finalAuthorName = normalizeUserName(req.user);
      finalAuthorPicture = req.user?.profile_picture || "";
    } else if (author_type === "another") {
      if (!author_name?.trim()) {
        return res.status(400).json({ message: "Author name is required" });
      }
      finalAuthorName = author_name.trim();
      finalAuthorPicture =
        getUploadedImage(req.files?.author_picture?.[0]) ||
        author_picture?.trim() ||
        "";
    } else {
      return res.status(400).json({ message: "Invalid author type" });
    }

    const post = await BlogPost.create({
      title: cleanHtml(title),
      content: cleanHtml(content),
      tags: finalTags,
      relatedBook: relatedBook || "",
      status,
      created_by: userId,
      author: finalAuthorName,
      author_name: finalAuthorName,
      author_picture: finalAuthorPicture,
      blog_picture: blogImage,
      likes: 0,
      views: 0,
    });

    res.status(201).json({ data: post });
  } catch (err) {
    console.error("createBlogPost:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ======================================================
   GET BLOG POSTS
====================================================== */

export const getBlogPosts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      q = "",
      status,
      scope = "all",
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const perPage = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * perPage;

    const filter = {};

    if (scope === "mine") {
      if (!req.user?._id) return res.status(401).json({ message: "Unauthorized" });
      filter.created_by = req.user._id;
    }

    if (scope === "public") {
      filter.status = "Published";
    }

    if (status) {
      if (!["Draft", "Published"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      filter.status = status;
    }

    if (q.trim()) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { title: regex },
        { content: regex },
        { author_name: regex },
        { tags: regex },
      ];
    }

    const [items, total] = await Promise.all([
      BlogPost.find(filter).sort({ createdAt: -1 }).skip(skip).limit(perPage).lean(),
      BlogPost.countDocuments(filter),
    ]);

    res.json({
      data: items,
      total,
      page: pageNum,
      limit: perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

/* ======================================================
   GET BLOG POST BY ID
====================================================== */

export const getBlogPostById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid blog id" });
    }

    const post = await BlogPost.findById(id).populate("created_by", "email");
    if (!post) return res.status(404).json({ message: "Blog not found" });

    res.json({ data: post });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
};

/* ======================================================
   UPDATE BLOG POST
====================================================== */

export const updateBlogPost = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid blog id" });
    }

    const post = await BlogPost.findById(id);
    if (!post) return res.status(404).json({ message: "Blog not found" });

    if (String(post.created_by) !== String(userId)) {
      return res.status(403).json({ message: "Permission denied" });
    }

    const {
      title,
      content,
      tags,
      relatedBook,
      status,
      author_type,
      author_name,
      author_picture,
    } = req.body || {};

    if (title !== undefined) post.title = cleanHtml(title);
    if (content !== undefined) post.content = cleanHtml(content);

    if (tags !== undefined) {
      const finalTags = normalizeTags(tags);
      if (!finalTags.length) {
        return res.status(400).json({ message: "Invalid tags" });
      }
      post.tags = finalTags;
    }

    if (status !== undefined) {
      if (!["Draft", "Published"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      post.status = status;
    }

    if (relatedBook !== undefined) post.relatedBook = relatedBook;

    const blogImage = getUploadedImage(req.files?.image?.[0]);
    if (blogImage) post.blog_picture = blogImage;

    if (author_type === "me") {
      post.author_name = normalizeUserName(req.user);
      post.author_picture = req.user?.profile_picture || "";
      post.author = post.author_name;
    }

    if (author_type === "another") {
      post.author_name = author_name?.trim() || post.author_name;
      post.author_picture =
        getUploadedImage(req.files?.author_picture?.[0]) ||
        author_picture ||
        post.author_picture;
      post.author = post.author_name;
    }

    await post.save();
    res.json({ data: post });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

/* ======================================================
   DELETE BLOG POST
====================================================== */

export const deleteBlogPost = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid blog id" });
    }

    const post = await BlogPost.findById(id);
    if (!post) return res.status(404).json({ message: "Blog not found" });

    if (String(post.created_by) !== String(userId)) {
      return res.status(403).json({ message: "Permission denied" });
    }

    await post.deleteOne();
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
};

/* ======================================================
   BLOG META PAGE (SOCIAL SHARE)
====================================================== */

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

    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const blogUrl = `${baseUrl}/blogs/${id}`;

    const description = post.content.replace(/<[^>]*>/g, "").slice(0, 160);
    const image = post.blog_picture || `${baseUrl}/default-og.jpg`;

    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${post.title}</title>

  <link rel="canonical" href="${blogUrl}" />

  <meta property="og:title" content="${post.title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:url" content="${blogUrl}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="JJU Reading Club" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${post.title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />

  <script>
    setTimeout(() => {
      window.location.href = "${blogUrl}";
    }, 1000);
  </script>
</head>
<body></body>
</html>
`);
  } catch (err) {
    console.error("blogMetaPage:", err);
    res.status(500).send("Server error");
  }
};
