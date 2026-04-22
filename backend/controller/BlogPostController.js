import BlogPost from "../models/BlogPost.js";
import { Op, literal } from "sequelize";
import cleanTitle from "../utility/cleanHtml.js";
import cleanQuillHtml from "../utility/cleanQuillHtml.js";
import { generateUniqueSlug, isValidSlug } from "../utility/slugUtils.js";
import sanitizeHtml from "sanitize-html";

/*
   Helpers
*/

const normalizeTags = (tags) => {
  if (!tags) return [];

  if (Array.isArray(tags)) {
    return tags.map((t) => String(t).trim()).filter(Boolean);
  }

  if (typeof tags === "string") {
    try {
      const parsed = JSON.parse(tags);
      if (Array.isArray(parsed)) {
        return parsed.map((t) => String(t).trim()).filter(Boolean);
      }
    } catch {
      return tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }
  }

  return [];
};

const normalizeUserName = (user) => {
  const parts = [user?.first_name, user?.middle_name, user?.last_name].filter(Boolean);

  const name = parts.join(" ") || user?.username || user?.email || "";

  const words = name.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  const unique = [...new Set(words.map((w) => w.toLowerCase()))];
  return unique.map((w) => words.find((o) => o.toLowerCase() === w)).join(" ");
};

const getUploadedImage = (file) => file?.path || file?.secure_url || file?.url || "";

const isValidNumericId = (id) => Number.isInteger(Number(id)) && Number(id) > 0;
const isUuid = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );

const getUuidFromCompositeIdentifier = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) return null;

  const match = normalized.match(
    /([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i
  );

  return match ? match[1] : null;
};

const buildPublicBlogIdentifier = (post) => {
  const slug = String(post?.slug || "").trim();
  const uuid = String(post?.uuid || "").trim();

  if (slug && uuid) return `${slug}-${uuid}`;
  if (slug) return slug;
  if (uuid) return uuid;

  return post?.id;
};

const toAbsoluteUrl = (url, baseUrl) => {
  const value = String(url || "").trim();
  if (!value) return "";

  if (/^https?:\/\//i.test(value)) return value;

  const normalizedBase = String(baseUrl || "").trim().replace(/\/$/, "");
  if (!normalizedBase) return value;

  const normalizedPath = value.startsWith("/") ? value : `/${value}`;
  return `${normalizedBase}${normalizedPath}`;
};

const isSocialCrawlerRequest = (req) => {
  const ua = String(req.headers["user-agent"] || "");
  return /(facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|whatsapp|telegrambot|discordbot|skypeuripreview|pinterest|vkshare)/i.test(
    ua
  );
};

const getBlogIdentifierWhere = (pathId) => {
  const normalized = String(pathId || "").trim();
  if (!normalized) return null;

  if (isValidNumericId(normalized)) return { id: Number(normalized) };
  if (isUuid(normalized)) return { uuid: normalized };

  const compositeUuid = getUuidFromCompositeIdentifier(normalized);
  if (compositeUuid) return { uuid: compositeUuid };

  return { slug: normalized };
};

const findBlogPostByPathId = async (pathId, options = {}) => {
  const where = getBlogIdentifierWhere(pathId);
  if (!where) return null;
  return BlogPost.findOne({ where, ...options });
};

const hasAnyPermission = (req, perms = []) => {
  const userPerms = new Set((req.user?.permissions || []).map((p) => String(p).toLowerCase()));
  return perms.some((p) => userPerms.has(String(p).toLowerCase()));
};

const hasModerationRole = (req) => {
  const roleName = String(req.user?.role?.role || req.user?.role?.plural || req.user?.role || "").toLowerCase();
  return /super\s*admin/i.test(roleName) || /moderator/i.test(roleName) || /admin/i.test(roleName);
};

const canManageBlogs = (req) =>
  hasModerationRole(req) ||
  hasAnyPermission(req, ["Manage Members", "Manage Books", "Manage Issues", "Add Role", "Edit Role"]);

export const createBlogPost = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!canManageBlogs(req)) {
      return res.status(403).json({ message: "Permission denied" });
    }

    const {
      title,
      content,
      tags,
      relatedBook,
      status = "Draft",
      author_type,
      author_name,
      author_picture,
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

    let finalStatus = status;
    if (!["Draft", "Published", "Scheduled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    let finalPublishAt = null;
    if (publishAt) {
      finalPublishAt = new Date(publishAt);
      if (Number.isNaN(finalPublishAt.getTime())) {
        return res.status(400).json({ message: "Invalid publishAt date" });
      }
      if (finalPublishAt <= new Date()) {
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
      finalAuthorPicture =
        getUploadedImage(req.files?.author_picture?.[0]) ||
        (typeof author_picture === "string" ? author_picture.trim() : "") ||
        "";
    } else {
      return res.status(400).json({ message: "Invalid author type" });
    }

    let finalSlug = null;
    if (customSlug?.trim()) {
      const cleanSlug = customSlug.trim().toLowerCase();
      if (!isValidSlug(cleanSlug)) {
        return res.status(400).json({ message: "Invalid slug format" });
      }

      const existing = await BlogPost.findOne({
        where: { slug: cleanSlug },
        attributes: ["id"],
      });

      if (existing) {
        return res.status(400).json({ message: "Slug already in use" });
      }
      finalSlug = cleanSlug;
    } else {
      finalSlug = await generateUniqueSlug(BlogPost, title);
    }

    const post = await BlogPost.create({
      title: cleanTitle(title),
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
      slug: finalSlug,
      seoTitle: seoTitle?.trim() || "",
      seoDescription: seoDescription?.trim() || "",
      socialImage: socialImage?.trim() || blogImage || "",
      canonicalUrl: canonicalUrl?.trim() || "",
      keywords: normalizeTags(keywords),
      publishAt: finalPublishAt,
      publishedAt: finalStatus === "Published" ? new Date() : null,
    });

    return res.status(201).json({ data: post });
  } catch (err) {
    console.error("createBlogPost:", err);
    return res.status(500).json({ message: "Server error" });
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
      featured,
      pinned,
      editorsPick,
      tag,
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const perPage = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * perPage;

    const where = {};

    if (scope === "mine") {
      if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });
      where.created_by = req.user.id;
    }

    if (scope === "public") {
      where.status = "Published";
    }

    if (status) {
      if (!["Draft", "Published", "Scheduled"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      where.status = status;
    }

    if (featured === "true") where.isFeatured = true;
    if (pinned === "true") where.isPinned = true;
    if (editorsPick === "true") where.isEditorsPick = true;

    const andFilters = [];

    if (tag?.trim()) {
      andFilters.push(
        literal(`JSON_SEARCH(tags, 'one', ${BlogPost.sequelize.escape(tag.trim())}) IS NOT NULL`)
      );
    }

    if (q.trim()) {
      const safeQ = `%${q.trim()}%`;
      where[Op.or] = [
        { title: { [Op.like]: safeQ } },
        { content: { [Op.like]: safeQ } },
        { author_name: { [Op.like]: safeQ } },
        { slug: { [Op.like]: safeQ } },
        { uuid: { [Op.like]: safeQ } },
      ];
    }

    if (andFilters.length) {
      where[Op.and] = andFilters;
    }

    const { rows: items, count: total } = await BlogPost.findAndCountAll({
      where,
      order: [
        ["isPinned", "DESC"],
        ["isFeatured", "DESC"],
        ["displayOrder", "DESC"],
        ["createdAt", "DESC"],
      ],
      offset,
      limit: perPage,
    });

    return res.json({
      data: items,
      total,
      page: pageNum,
      limit: perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (err) {
    console.error("getBlogPosts:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/*
   GET BLOG POST BY ID OR SLUG
*/
export const getBlogPostById = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await findBlogPostByPathId(id);

    if (!post) return res.status(404).json({ message: "Blog not found" });

    return res.json({ data: post });
  } catch (err) {
    console.error("getBlogPostById:", err);
    return res.status(500).json({ message: "Server error" });
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
    const where = getBlogIdentifierWhere(id);
    if (!where) {
      return res.status(400).json({ message: "Invalid blog id" });
    }

    const post = await BlogPost.findOne({ where });
    if (!post) return res.status(404).json({ message: "Blog not found" });

    if (String(post.created_by) !== String(userId) && !canManageBlogs(req)) {
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

      if (status === "Published" && !post.publishedAt) {
        post.publishedAt = new Date();
      }
    }

    if (publishAt !== undefined) {
      if (publishAt === null || publishAt === "") {
        post.publishAt = null;
      } else {
        const newPublishAt = new Date(publishAt);
        if (Number.isNaN(newPublishAt.getTime())) {
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
      if (author_name !== undefined) {
        post.author_name = author_name?.trim() || post.author_name;
      }

      post.author_picture =
        getUploadedImage(req.files?.author_picture?.[0]) ||
        (typeof author_picture === "string" ? author_picture.trim() : "") ||
        post.author_picture;

      post.author = post.author_name;
    }

    if (customSlug !== undefined && customSlug !== post.slug) {
      if (customSlug === null || customSlug === "") {
        post.slug = await generateUniqueSlug(BlogPost, post.title, post.id);
      } else {
        const cleanSlug = customSlug.trim().toLowerCase();
        if (!isValidSlug(cleanSlug)) {
          return res.status(400).json({ message: "Invalid slug format" });
        }

        const existing = await BlogPost.findOne({
          where: {
            slug: cleanSlug,
            id: { [Op.ne]: post.id },
          },
          attributes: ["id"],
        });

        if (existing) {
          return res.status(400).json({ message: "Slug already in use" });
        }

        post.slug = cleanSlug;
      }
    }

    if (seoTitle !== undefined) post.seoTitle = seoTitle?.trim() || "";
    if (seoDescription !== undefined) post.seoDescription = seoDescription?.trim() || "";
    if (socialImage !== undefined) post.socialImage = socialImage?.trim() || "";
    if (canonicalUrl !== undefined) post.canonicalUrl = canonicalUrl?.trim() || "";
    if (keywords !== undefined) post.keywords = normalizeTags(keywords);

    if (relatedPosts !== undefined) {
      const validIds = (Array.isArray(relatedPosts) ? relatedPosts : [])
        .filter((rid) => isValidNumericId(rid))
        .map((rid) => Number(rid));
      post.relatedPosts = validIds;
    }

    await post.save();
    return res.json({ data: post });
  } catch (err) {
    console.error("updateBlogPost:", err);
    return res.status(500).json({ message: "Server error" });
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
    const where = getBlogIdentifierWhere(id);
    if (!where) {
      return res.status(400).json({ message: "Invalid blog id" });
    }

    const post = await BlogPost.findOne({ where });
    if (!post) return res.status(404).json({ message: "Blog not found" });

    if (String(post.created_by) !== String(userId) && !canManageBlogs(req)) {
      return res.status(403).json({ message: "Permission denied" });
    }

    await post.destroy();
    return res.json({ success: true });
  } catch (err) {
    console.error("deleteBlogPost:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const blogMetaPage = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await findBlogPostByPathId(id);

    if (!post || post.status !== "Published") {
      return res.status(404).send("Blog not found");
    }

    const BASE_URL = process.env.APP_URL || "";
    const urlIdentifier = buildPublicBlogIdentifier(post);
    const redirectUrl = toAbsoluteUrl(`/blogs/${urlIdentifier}`, BASE_URL);
    const shareUrl = toAbsoluteUrl(`/api/share/blog/${urlIdentifier}`, BASE_URL);

    const pageTitle = post.seoTitle?.trim() || post.title;
    const plainTextContent = sanitizeHtml(post.content || "", {
      allowedTags: [],
      allowedAttributes: {},
    });
    const description =
      post.seoDescription?.trim() ||
      plainTextContent.replace(/\s+/g, " ").trim().slice(0, 160);
    const image = toAbsoluteUrl(
      post.socialImage?.trim() || post.blog_picture || "/default-og.jpg",
      BASE_URL
    );
    const canonical = post.canonicalUrl?.trim() || redirectUrl;

    const escapeHtml = (str) =>
      String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const safeTitle = escapeHtml(pageTitle);
    const safeDescription = escapeHtml(description);

    if (!isSocialCrawlerRequest(req)) {
      return res.redirect(302, redirectUrl);
    }

    return res.status(200).send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${safeTitle}</title>

  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDescription}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:image:secure_url" content="${image}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="${shareUrl}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="JJU Reading Club" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDescription}" />
  <meta name="twitter:image" content="${image}" />
  <meta name="twitter:url" content="${shareUrl}" />

  <meta name="description" content="${safeDescription}" />
  ${
    post.keywords?.length
      ? `<meta name="keywords" content="${escapeHtml(post.keywords.join(", "))}" />`
      : ""
  }

  <link rel="canonical" href="${canonical}" />
</head>
<body>
  <p>If you are not redirected automatically, <a href="${redirectUrl}">open the blog post</a>.</p>
</body>
</html>
    `);
  } catch (err) {
    console.error("Meta error:", err);
    return res.status(500).send("Server error");
  }
};

export const incrementViews = async (req, res) => {
  try {
    const { id } = req.params;

    const where = getBlogIdentifierWhere(id);
    if (!where) {
      return res.status(400).json({ message: "Invalid blog id" });
    }

    const post = await BlogPost.findOne({ where });
    if (!post) return res.status(404).json({ message: "Post not found" });

    await post.increment("views", { by: 1 });
    await post.reload({ attributes: ["views"] });

    return res.json({ views: post.views });
  } catch (error) {
    console.error("incrementViews:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

/*
   PHASE 7: Featured Content Management (Admin/Moderator only)
*/

/**
 * GET /blogposts/featured
 */
export const getFeaturedPosts = async (req, res) => {
  try {
    const { type = "all", limit = 10 } = req.query;
    const perPage = Math.min(20, Math.max(1, Number(limit)));

    const where = { status: "Published" };

    if (type === "featured") where.isFeatured = true;
    else if (type === "pinned") where.isPinned = true;
    else if (type === "editorsPick") where.isEditorsPick = true;
    else {
      where[Op.or] = [{ isFeatured: true }, { isPinned: true }, { isEditorsPick: true }];
    }

    const posts = await BlogPost.findAll({
      where,
      order: [
        ["isPinned", "DESC"],
        ["isFeatured", "DESC"],
        ["displayOrder", "DESC"],
        ["createdAt", "DESC"],
      ],
      limit: perPage,
      attributes: [
        "id",
        "uuid",
        "title",
        "slug",
        "blog_picture",
        "author_name",
        "tags",
        "views",
        "createdAt",
        "isFeatured",
        "isPinned",
        "isEditorsPick",
        "seoDescription",
      ],
    });

    return res.json({ data: posts });
  } catch (err) {
    console.error("getFeaturedPosts:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * PUT /blogposts/:id/feature
 */
export const toggleFeature = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!canManageBlogs(req)) return res.status(403).json({ message: "Permission denied" });

    const { id } = req.params;
    const where = getBlogIdentifierWhere(id);
    if (!where) return res.status(400).json({ message: "Invalid blog id" });

    const post = await BlogPost.findOne({ where });
    if (!post) return res.status(404).json({ message: "Blog not found" });

    post.isFeatured = !post.isFeatured;
    await post.save();

    return res.json({
      data: post,
      message: post.isFeatured ? "Post featured" : "Post unfeatured",
    });
  } catch (err) {
    console.error("toggleFeature:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * PUT /blogposts/:id/pin
 */
export const togglePin = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!canManageBlogs(req)) return res.status(403).json({ message: "Permission denied" });

    const { id } = req.params;
    const where = getBlogIdentifierWhere(id);
    if (!where) return res.status(400).json({ message: "Invalid blog id" });

    const post = await BlogPost.findOne({ where });
    if (!post) return res.status(404).json({ message: "Blog not found" });

    post.isPinned = !post.isPinned;
    await post.save();

    return res.json({
      data: post,
      message: post.isPinned ? "Post pinned" : "Post unpinned",
    });
  } catch (err) {
    console.error("togglePin:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * PUT /blogposts/:id/editors-pick
 */
export const toggleEditorsPick = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!canManageBlogs(req)) return res.status(403).json({ message: "Permission denied" });

    const { id } = req.params;
    const where = getBlogIdentifierWhere(id);
    if (!where) return res.status(400).json({ message: "Invalid blog id" });

    const post = await BlogPost.findOne({ where });
    if (!post) return res.status(404).json({ message: "Blog not found" });

    post.isEditorsPick = !post.isEditorsPick;
    await post.save();

    return res.json({
      data: post,
      message: post.isEditorsPick ? "Marked as editor's pick" : "Removed editor's pick",
    });
  } catch (err) {
    console.error("toggleEditorsPick:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * PUT /blogposts/:id/display-order
 */
export const updateDisplayOrder = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!canManageBlogs(req)) return res.status(403).json({ message: "Permission denied" });

    const { id } = req.params;
    const { displayOrder } = req.body;

    const where = getBlogIdentifierWhere(id);
    if (!where) return res.status(400).json({ message: "Invalid blog id" });
    if (typeof displayOrder !== "number") {
      return res.status(400).json({ message: "displayOrder must be a number" });
    }

    const post = await BlogPost.findOne({ where });
    if (!post) return res.status(404).json({ message: "Blog not found" });

    post.displayOrder = displayOrder;
    await post.save();

    return res.json({ data: post });
  } catch (err) {
    console.error("updateDisplayOrder:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * PUT /blogposts/:id/related-posts
 */
export const updateRelatedPosts = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!canManageBlogs(req)) return res.status(403).json({ message: "Permission denied" });

    const { id } = req.params;
    const { relatedPosts } = req.body;

    const where = getBlogIdentifierWhere(id);
    if (!where) return res.status(400).json({ message: "Invalid blog id" });
    if (!Array.isArray(relatedPosts)) {
      return res.status(400).json({ message: "relatedPosts must be an array" });
    }

    const post = await BlogPost.findOne({ where });
    if (!post) return res.status(404).json({ message: "Blog not found" });

    const validIds = relatedPosts
      .filter((pid) => isValidNumericId(pid) && Number(pid) !== Number(post.id))
      .map((pid) => Number(pid));

    post.relatedPosts = validIds;
    await post.save();

    return res.json({ data: post });
  } catch (err) {
    console.error("updateRelatedPosts:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /blogposts/scheduled
 */
export const getScheduledPosts = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!canManageBlogs(req)) return res.status(403).json({ message: "Permission denied" });

    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, Number(page));
    const perPage = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * perPage;

    const where = { status: "Scheduled", publishAt: { [Op.ne]: null } };

    const { rows: posts, count: total } = await BlogPost.findAndCountAll({
      where,
      order: [["publishAt", "ASC"]],
      offset,
      limit: perPage,
    });

    return res.json({
      data: posts,
      total,
      page: pageNum,
      limit: perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (err) {
    console.error("getScheduledPosts:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export default {
  createBlogPost,
  getBlogPosts,
  getBlogPostById,
  updateBlogPost,
  deleteBlogPost,
  blogMetaPage,
  incrementViews,
  getFeaturedPosts,
  toggleFeature,
  togglePin,
  toggleEditorsPick,
  updateDisplayOrder,
  updateRelatedPosts,
  getScheduledPosts,
};