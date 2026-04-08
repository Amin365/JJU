import BlogPost from "../models/BlogPost.js";
import { Op } from 'sequelize';
import cleanTitle from "../utility/cleanHtml.js";
import cleanQuillHtml from "../utility/cleanQuillHtml.js";
import { generateUniqueSlug, isValidSlug } from "../utility/slugUtils.js";
import User from "../models/user.js";
import Role from "../models/Role.js";
import sanitizeHtml from "sanitize-html";



/* 
   Helpers
 */

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

/**
 * Helper: Check if user is admin/moderator
 */
const isModeratorOrAdmin = async (userId) => {
  const user = await User.findByPk(userId).populate("role", "role plural");
  if (!user) return false;

  const roleName = (user.role?.role || user.role?.plural || "").toLowerCase();
  return /super\s*admin/i.test(roleName) || /moderator/i.test(roleName);
};




export const createBlogPost = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const {
      title,
      content,
      tags,
      relatedBook,
      status = "Draft",
      author_type,
      author_name,
      author_picture, // can be a string URL if no file uploaded
      // Phase 7: New fields
      slug: customSlug,
      seoTitle,
      seoDescription,
      socialImage,
      canonicalUrl,
      keywords,
      publishAt,
    } = req.body || {};

    if (!title?.trim()) return res.status(400).json({ message: "Title is required" });
    if (!content?.trim()) return res.status(400).json({ message: "Content is required" });

    const finalTags = normalizeTags(tags);
    if (!finalTags.length) {
      return res.status(400).json({ message: "Tags must be a non-empty array" });
    }

    // Validate status including new "Scheduled" option
    let finalStatus = status;
    if (!["Draft", "Published", "Scheduled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    // Handle scheduled publishing
    let finalPublishAt = null;
    if (publishAt) {
      finalPublishAt = new Date(publishAt);
      if (isNaN(finalPublishAt.getTime())) {
        return res.status(400).json({ message: "Invalid publishAt date" });
      }
      if (finalPublishAt <= new Date()) {
        // If publish date is in the past, just publish immediately
        finalStatus = "Published";
        finalPublishAt = null;
      } else {
        finalStatus = "Scheduled";
      }
    }

    const blogImage = getUploadedImage(req.files?.image?.[0]) || "";

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

      // Prefer uploaded file if present, else accept a URL string in body
      finalAuthorPicture =
        getUploadedImage(req.files?.author_picture?.[0]) ||
        (typeof author_picture === "string" ? author_picture.trim() : "") ||
        "";
    } else {
      return res.status(400).json({ message: "Invalid author type" });
    }

    // Generate slug
    let finalSlug = null;
    if (customSlug?.trim()) {
      // Validate custom slug
      const cleanSlug = customSlug.trim().toLowerCase();
      if (!isValidSlug(cleanSlug)) {
        return res.status(400).json({ message: "Invalid slug format" });
      }
      // Check uniqueness
      const existing = await BlogPost.findOne({ slug: cleanSlug }).select("_id");
      if (existing) {
        return res.status(400).json({ message: "Slug already in use" });
      }
      finalSlug = cleanSlug;
    } else {
      // Auto-generate slug from title
      finalSlug = await generateUniqueSlug(BlogPost, title);
    }

    const post = await BlogPost.create({
      title: cleanTitle(title),

      // IMPORTANT: preserve blank lines from Quill here
      content: cleanQuillHtml(content),

      tags: finalTags,
      relatedBook: relatedBook || "",
      status: finalStatus,
      created_by: userId,

      author: finalAuthorName,
      author_name: finalAuthorName,
      author_picture: finalAuthorPicture,

      blog_picture: blogImage,
      likes: 0,
      views: 0,

      // Phase 7: New fields
      slug: finalSlug,
      seoTitle: seoTitle?.trim() || "",
      seoDescription: seoDescription?.trim() || "",
      socialImage: socialImage?.trim() || blogImage || "",
      canonicalUrl: canonicalUrl?.trim() || "",
      keywords: normalizeTags(keywords),
      publishAt: finalPublishAt,
      publishedAt: finalStatus === "Published" ? new Date() : null,
    });

    res.status(201).json({ data: post });
  } catch (err) {
    console.error("createBlogPost:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* 
   GET BLOG POSTS
 */

export const getBlogPosts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      q = "",
      status,
      scope = "all",
      // Phase 7: New filters
      featured,
      pinned,
      editorsPick,
      tag,
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const perPage = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * perPage;

    const filter = {};

    if (scope === "mine") {
      if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });
      filter.created_by = req.user.id;
    }

    if (scope === "public") {
      filter.status = "Published";
    }

    if (status) {
      if (!["Draft", "Published", "Scheduled"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      filter.status = status;
    }

    // Phase 7: Featured/Pinned/Editor's Pick filters
    if (featured === "true") filter.isFeatured = true;
    if (pinned === "true") filter.isPinned = true;
    if (editorsPick === "true") filter.isEditorsPick = true;

    // Filter by tag
    if (tag?.trim()) {
      filter.tags = { [Op.in]: [new RegExp(tag.trim(), "i")] };
    }

    if (q.trim()) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { title: regex },
        { content: regex },
        { author_name: regex },
        { tags: regex },
        { slug: regex },
      ];
    }

    // Sort: pinned first, then featured, then by date
    const sortOrder = { isPinned: -1, isFeatured: -1, displayOrder: -1, createdAt: -1 };

    const [items, total] = await Promise.all([
      BlogPost.find(filter).sort(sortOrder).skip(skip).limit(perPage),
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

/* 
   GET BLOG POST BY ID OR SLUG
 */

export const getBlogPostById = async (req, res) => {
  try {
    const { id } = req.params;

    let post;
    
    // Check if id is a valid ObjectId or a slug
    if (mongoose.isValidObjectId(id)) {
      post = await BlogPost.findByPk(id).populate("created_by", "email").populate("relatedPosts", "title slug blog_picture");
    } else {
      // Try to find by slug
      post = await BlogPost.findOne({ slug: id }).populate("created_by", "email").populate("relatedPosts", "title slug blog_picture");
    }

    if (!post) return res.status(404).json({ message: "Blog not found" });

    res.json({ data: post });
  } catch {
    res.status(500).json({ message: "Server error" });
  }
};

/* 
   UPDATE BLOG POST
 */

export const updateBlogPost = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid blog id" });
    }

    const post = await BlogPost.findByPk(id);
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
      // Phase 7: New fields
      slug: customSlug,
      seoTitle,
      seoDescription,
      socialImage,
      canonicalUrl,
      keywords,
      publishAt,
      relatedPosts,
    } = req.body || {};

    if (title !== undefined) post.title = cleanTitle(title);

    // IMPORTANT: preserve blank lines from Quill here too
    if (content !== undefined) post.content = cleanQuillHtml(content);

    if (tags !== undefined) {
      const finalTags = normalizeTags(tags);
      if (!finalTags.length) {
        return res.status(400).json({ message: "Invalid tags" });
      }
      post.tags = finalTags;
    }

    if (status !== undefined) {
      if (!["Draft", "Published", "Scheduled"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      post.status = status;
      
      // Set publishedAt when first published
      if (status === "Published" && !post.publishedAt) {
        post.publishedAt = new Date();
      }
    }

    // Handle scheduled publishing
    if (publishAt !== undefined) {
      if (publishAt === null || publishAt === "") {
        post.publishAt = null;
      } else {
        const newPublishAt = new Date(publishAt);
        if (isNaN(newPublishAt.getTime())) {
          return res.status(400).json({ message: "Invalid publishAt date" });
        }
        if (newPublishAt <= new Date()) {
          post.status = "Published";
          post.publishAt = null;
          if (!post.publishedAt) post.publishedAt = new Date();
        } else {
          post.status = "Scheduled";
          post.publishAt = newPublishAt;
        }
      }
    }

    if (relatedBook !== undefined) post.relatedBook = relatedBook;

    const blogImage = getUploadedImage(req.files?.image?.[0]);
    if (blogImage) post.blog_picture = blogImage;

    if (author_type === "me") {
      post.author_name = normalizeUserName(req.user);
      post.author_picture = req.user?.profile_picture || "";
      post.author = post.author_name;
    } else if (author_type === "another") {
      if (author_name !== undefined) post.author_name = author_name?.trim() || post.author_name;

      post.author_picture =
        getUploadedImage(req.files?.author_picture?.[0]) ||
        (typeof author_picture === "string" ? author_picture.trim() : "") ||
        post.author_picture;

      post.author = post.author_name;
    }

    // Phase 7: Handle slug update
    if (customSlug !== undefined && customSlug !== post.slug) {
      if (customSlug === null || customSlug === "") {
        // Auto-generate new slug from title
        post.slug = await generateUniqueSlug(BlogPost, post.title, id);
      } else {
        const cleanSlug = customSlug.trim().toLowerCase();
        if (!isValidSlug(cleanSlug)) {
          return res.status(400).json({ message: "Invalid slug format" });
        }
        // Check uniqueness (excluding current post)
        const existing = await BlogPost.findOne({ 
          slug: cleanSlug, 
          _id: { [Op.ne]: id } 
        }).select("_id");
        if (existing) {
          return res.status(400).json({ message: "Slug already in use" });
        }
        post.slug = cleanSlug;
      }
    }

    // Phase 7: SEO fields
    if (seoTitle !== undefined) post.seoTitle = seoTitle?.trim() || "";
    if (seoDescription !== undefined) post.seoDescription = seoDescription?.trim() || "";
    if (socialImage !== undefined) post.socialImage = socialImage?.trim() || "";
    if (canonicalUrl !== undefined) post.canonicalUrl = canonicalUrl?.trim() || "";
    if (keywords !== undefined) post.keywords = normalizeTags(keywords);

    // Phase 7: Related posts
    if (relatedPosts !== undefined) {
      const validIds = (Array.isArray(relatedPosts) ? relatedPosts : [])
        .filter(id => mongoose.isValidObjectId(id));
      post.relatedPosts = validIds;
    }

    await post.save();
    res.json({ data: post });
  } catch (err) {
    console.error("updateBlogPost:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* 
   DELETE BLOG POST
 */

export const deleteBlogPost = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid blog id" });
    }

    const post = await BlogPost.findByPk(id);
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




export const blogMetaPage = async (req, res) => {
  try {
    const { id } = req.params;

    let post;
    
    // Support both ObjectId and slug
    if (mongoose.isValidObjectId(id)) {
      post = await BlogPost.findByPk(id);
    } else {
      post = await BlogPost.findOne({ slug: id });
    }

    if (!post || post.status !== "Published") {
      return res.status(404).send("Blog not found");
    }

    const BASE_URL = process.env.APP_URL; // 🔒 forced canonical

    // Use slug for URL if available, otherwise use ID
    const urlIdentifier = post.slug || post.id;
    const redirectUrl = `${BASE_URL}/blogs/${urlIdentifier}`;
    const shareUrl = `${BASE_URL}/api/share/blog/${urlIdentifier}`;

    // Phase 7: Use custom SEO fields if available, fallback to defaults
    const pageTitle = post.seoTitle?.trim() || post.title;
    // Strip all HTML tags safely using sanitize-html with no allowed tags
    const plainTextContent = sanitizeHtml(post.content || "", { allowedTags: [], allowedAttributes: {} });
    const description = post.seoDescription?.trim() || 
      plainTextContent.replace(/\s+/g, " ").trim().slice(0, 160);
    const image = post.socialImage?.trim() || 
      post.blog_picture || 
      `${BASE_URL}/default-og.jpg`;
    const canonical = post.canonicalUrl?.trim() || redirectUrl;

    // Escape special characters for HTML
    const escapeHtml = (str) => str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

    const safeTitle = escapeHtml(pageTitle);
    const safeDescription = escapeHtml(description);

    res.status(200).send(`
        <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${safeTitle}</title>

    <!-- Open Graph -->
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:url" content="${shareUrl}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="JJU Reading Club" />

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <meta name="twitter:image" content="${image}" />

    <!-- SEO Meta -->
    <meta name="description" content="${safeDescription}" />
    ${post.keywords?.length ? `<meta name="keywords" content="${escapeHtml(post.keywords.join(", "))}" />` : ""}

    <!-- Canonical -->
    <link rel="canonical" href="${canonical}" />

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

export const incrementViews = async (req, res) => {
  try {
    const { id } = req.params;
    // Use atomic $inc to increment
    const updated = await BlogPost.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } },
      { new: true, select: "views" }
    );
    if (!updated) return res.status(404).json({ message: "Post not found" });
    res.json({ views: updated.views });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};


/* 
   PHASE 7: Featured Content Management (Admin/Moderator only)
 */

/**
 * GET /blogposts/featured
 * Get featured, pinned, and editor's pick posts for homepage
 */
export const getFeaturedPosts = async (req, res) => {
  try {
    const { type = "all", limit = 10 } = req.query;
    const perPage = Math.min(20, Math.max(1, Number(limit)));

    const filter = { status: "Published" };

    if (type === "featured") filter.isFeatured = true;
    else if (type === "pinned") filter.isPinned = true;
    else if (type === "editorsPick") filter.isEditorsPick = true;
    else {
      // Get all special posts
      filter.$or = [
        { isFeatured: true },
        { isPinned: true },
        { isEditorsPick: true },
      ];
    }

    const posts = await BlogPost.find(filter)
      .sort({ isPinned: -1, isFeatured: -1, displayOrder: -1, createdAt: -1 })
      .limit(perPage)
      .select("title slug blog_picture author_name tags views createdAt isFeatured isPinned isEditorsPick seoDescription")
      ;

    res.json({ data: posts });
  } catch (err) {
    console.error("getFeaturedPosts:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * PUT /blogposts/:id/feature
 * Toggle featured status (admin/moderator only)
 */
export const toggleFeature = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const canModerate = await isModeratorOrAdmin(userId);
    if (!canModerate) {
      return res.status(403).json({ message: "Permission denied" });
    }

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid blog id" });
    }

    const post = await BlogPost.findByPk(id);
    if (!post) return res.status(404).json({ message: "Blog not found" });

    post.isFeatured = !post.isFeatured;
    await post.save();

    res.json({
      data: post,
      message: post.isFeatured ? "Post featured" : "Post unfeatured",
    });
  } catch (err) {
    console.error("toggleFeature:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * PUT /blogposts/:id/pin
 * Toggle pinned status (admin/moderator only)
 */
export const togglePin = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const canModerate = await isModeratorOrAdmin(userId);
    if (!canModerate) {
      return res.status(403).json({ message: "Permission denied" });
    }

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid blog id" });
    }

    const post = await BlogPost.findByPk(id);
    if (!post) return res.status(404).json({ message: "Blog not found" });

    post.isPinned = !post.isPinned;
    await post.save();

    res.json({
      data: post,
      message: post.isPinned ? "Post pinned" : "Post unpinned",
    });
  } catch (err) {
    console.error("togglePin:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * PUT /blogposts/:id/editors-pick
 * Toggle editor's pick status (admin/moderator only)
 */
export const toggleEditorsPick = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const canModerate = await isModeratorOrAdmin(userId);
    if (!canModerate) {
      return res.status(403).json({ message: "Permission denied" });
    }

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid blog id" });
    }

    const post = await BlogPost.findByPk(id);
    if (!post) return res.status(404).json({ message: "Blog not found" });

    post.isEditorsPick = !post.isEditorsPick;
    await post.save();

    res.json({
      data: post,
      message: post.isEditorsPick ? "Marked as editor's pick" : "Removed editor's pick",
    });
  } catch (err) {
    console.error("toggleEditorsPick:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * PUT /blogposts/:id/display-order
 * Update display order (admin/moderator only)
 */
export const updateDisplayOrder = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const canModerate = await isModeratorOrAdmin(userId);
    if (!canModerate) {
      return res.status(403).json({ message: "Permission denied" });
    }

    const { id } = req.params;
    const { displayOrder } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid blog id" });
    }

    if (typeof displayOrder !== "number") {
      return res.status(400).json({ message: "displayOrder must be a number" });
    }

    const post = await BlogPost.findByIdAndUpdate(
      id,
      { displayOrder },
      { new: true }
    );

    if (!post) return res.status(404).json({ message: "Blog not found" });

    res.json({ data: post });
  } catch (err) {
    console.error("updateDisplayOrder:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * PUT /blogposts/:id/related-posts
 * Update related posts (admin/moderator only)
 */
export const updateRelatedPosts = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const canModerate = await isModeratorOrAdmin(userId);
    if (!canModerate) {
      return res.status(403).json({ message: "Permission denied" });
    }

    const { id } = req.params;
    const { relatedPosts } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid blog id" });
    }

    if (!Array.isArray(relatedPosts)) {
      return res.status(400).json({ message: "relatedPosts must be an array" });
    }

    const validIds = relatedPosts.filter(pid => 
      mongoose.isValidObjectId(pid) && String(pid) !== String(id)
    );

    const post = await BlogPost.findByIdAndUpdate(
      id,
      { relatedPosts: validIds },
      { new: true }
    ).populate("relatedPosts", "title slug blog_picture");

    if (!post) return res.status(404).json({ message: "Blog not found" });

    res.json({ data: post });
  } catch (err) {
    console.error("updateRelatedPosts:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /blogposts/scheduled
 * Get scheduled posts (admin/moderator only)
 */
export const getScheduledPosts = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const canModerate = await isModeratorOrAdmin(userId);
    if (!canModerate) {
      return res.status(403).json({ message: "Permission denied" });
    }

    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, Number(page));
    const perPage = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * perPage;

    const filter = { status: "Scheduled", publishAt: { [Op.ne]: null } };

    const [posts, total] = await Promise.all([
      BlogPost.find(filter)
        .sort({ publishAt: 1 })
        .skip(skip)
        .limit(perPage)
        .populate("created_by", "email first_name last_name")
        ,
      BlogPost.countDocuments(filter),
    ]);

    res.json({
      data: posts,
      total,
      page: pageNum,
      limit: perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (err) {
    console.error("getScheduledPosts:", err);
    res.status(500).json({ message: "Server error" });
  }
};










