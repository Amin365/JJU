import Resource from "../models/Resource.js";
import User from "../models/user.js";
import BlogPost from "../models/BlogPost.js";
import { Op } from 'sequelize';
import { generateUniqueSlug, isValidSlug } from "../utility/slugUtils.js";
import cleanTitle from "../utility/cleanHtml.js";
import cleanQuillHtml from "../utility/cleanQuillHtml.js";

const hasAnyPermission = (req, perms = []) => {
  const userPerms = new Set((req.user?.permissions || []).map((p) => String(p).toLowerCase()));
  return perms.some((p) => userPerms.has(String(p).toLowerCase()));
};

const hasModerationRole = (req) => {
  const roleName = String(req.user?.role?.role || req.user?.role?.plural || req.user?.role || "").toLowerCase();
  return /super\s*admin/i.test(roleName) || /moderator/i.test(roleName) || /admin/i.test(roleName);
};

const canManageResources = (req) =>
  hasModerationRole(req) ||
  hasAnyPermission(req, ["Manage Members", "Manage Books", "Manage Issues", "Add Role", "Edit Role"]);

const isValidNumericId = (id) => Number.isInteger(Number(id)) && Number(id) > 0;

const findResourceByPathId = async (pathId, options = {}) => {
  const normalized = String(pathId || "").trim();
  if (!normalized) return null;

  const where = isValidNumericId(normalized)
    ? { id: Number(normalized) }
    : { slug: normalized };

  return Resource.findOne({ where, ...options });
};

/**
 * Helper: Normalize tags
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

/**
 * Helper: Get uploaded image URL
 */
const getUploadedFile = (file) =>
  file?.path || file?.secure_url || file?.url || "";

/**
 * Helper: Get author name from user
 */
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

/**
 * POST /resources
 * Create a new resource (admin/moderator only)
 */
export const createResource = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    if (!canManageResources(req)) {
      return res.status(403).json({ message: "Permission denied" });
    }

    const {
      title,
      description,
      content,
      type,
      status = "Draft",
      tags,
      category,
      slug: customSlug,
      seoTitle,
      seoDescription,
      eventDate,
      eventLocation,
      publishAt,
    } = req.body || {};

    if (!title?.trim()) {
      return res.status(400).json({ message: "Title is required" });
    }

    if (!type || !["guide", "announcement", "event-recap", "download"].includes(type)) {
      return res.status(400).json({ message: "Invalid resource type" });
    }

    if (!["Draft", "Published", "Archived"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    // Handle file upload for downloadable resources
    const coverImage = getUploadedFile(req.files?.coverImage?.[0]) || "";
    const uploadedFile = getUploadedFile(req.files?.file?.[0]);
    
    // Generate slug
    let finalSlug = null;
    if (customSlug?.trim()) {
      const cleanSlug = customSlug.trim().toLowerCase();
      if (!isValidSlug(cleanSlug)) {
        return res.status(400).json({ message: "Invalid slug format" });
      }
      const existing = await Resource.findOne({ where: { slug: cleanSlug }, attributes: ["id"] });
      if (existing) {
        return res.status(400).json({ message: "Slug already in use" });
      }
      finalSlug = cleanSlug;
    } else {
      finalSlug = await generateUniqueSlug(Resource, title);
    }

    // Handle scheduled publishing
    let finalStatus = status;
    let finalPublishAt = null;
    if (publishAt) {
      finalPublishAt = new Date(publishAt);
      if (isNaN(finalPublishAt.getTime())) {
        return res.status(400).json({ message: "Invalid publishAt date" });
      }
      if (finalPublishAt <= new Date()) {
        finalStatus = "Published";
        finalPublishAt = null;
      }
    }

    const resource = await Resource.create({
      title: cleanTitle(title),
      description: description?.trim() || "",
      content: content ? cleanQuillHtml(content) : "",
      type,
      status: finalStatus,
      tags: normalizeTags(tags),
      category: category?.trim() || "",
      slug: finalSlug,
      seoTitle: seoTitle?.trim() || "",
      seoDescription: seoDescription?.trim() || "",
      coverImage,
      fileUrl: uploadedFile || "",
      fileName: req.files?.file?.[0]?.originalname || "",
      fileSize: req.files?.file?.[0]?.size || 0,
      fileType: req.files?.file?.[0]?.mimetype || "",
      eventDate: eventDate ? new Date(eventDate) : null,
      eventLocation: eventLocation?.trim() || "",
      created_by: userId,
      author_name: normalizeUserName(req.user),
      publishAt: finalPublishAt,
      publishedAt: finalStatus === "Published" ? new Date() : null,
    });

    res.status(201).json({ data: resource });
  } catch (err) {
    console.error("createResource:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /resources
 * Get list of resources with filters
 */
export const getResources = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      status,
      tag,
      category,
      q,
      featured,
      pinned,
    } = req.query;

    const pageNum = Math.max(1, Number(page));
    const perPage = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * perPage;

    const filter = {};

    // Type filter
    if (type && ["guide", "announcement", "event-recap", "download"].includes(type)) {
      filter.type = type;
    }

    // Status filter - public only shows Published by default
    if (status && ["Draft", "Published", "Archived"].includes(status)) {
      filter.status = status;
    } else if (!req.user) {
      // For unauthenticated users, only show published
      filter.status = "Published";
    }

    // Tag filter
    if (tag?.trim()) {
      filter.tags = { [Op.like]: `%${tag.trim()}%` };
    }

    // Category filter
    if (category?.trim()) {
      filter.category = { [Op.like]: `%${category.trim()}%` };
    }

    // Featured/Pinned filters
    if (featured === "true") filter.isFeatured = true;
    if (pinned === "true") filter.isPinned = true;

    // Search
    if (q?.trim()) {
      const safeQ = `%${String(q).trim()}%`;
      filter[Op.or] = [
        { title: { [Op.like]: safeQ } },
        { description: { [Op.like]: safeQ } },
        { content: { [Op.like]: safeQ } },
        { tags: { [Op.like]: safeQ } },
      ];
    }

    const sortOrder = [
      ["isPinned", "DESC"],
      ["isFeatured", "DESC"],
      ["displayOrder", "DESC"],
      ["createdAt", "DESC"],
    ];

    const { rows: resources, count: total } = await Resource.findAndCountAll({
      where: filter,
      order: sortOrder,
      offset,
      limit: perPage,
      include: [
        {
          model: User,
          as: "createdBy",
          attributes: ["id", "email", "first_name", "last_name"],
          required: false,
        },
      ],
    });

    res.json({
      data: resources,
      total,
      page: pageNum,
      limit: perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (err) {
    console.error("getResources:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /resources/:id
 * Get a single resource by ID or slug
 */
export const getResourceById = async (req, res) => {
  try {
    const { id } = req.params;

    const resource = await findResourceByPathId(id, {
      include: [
        {
          model: User,
          as: "createdBy",
          attributes: ["id", "email", "first_name", "last_name"],
          required: false,
        },
      ],
    });

    if (!resource) {
      return res.status(404).json({ message: "Resource not found" });
    }

    const plain = resource.get({ plain: true });
    const relatedResourceIds = Array.isArray(plain.relatedResources)
      ? plain.relatedResources.filter((rid) => isValidNumericId(rid)).map((rid) => Number(rid))
      : [];
    const relatedPostIds = Array.isArray(plain.relatedPosts)
      ? plain.relatedPosts.filter((pid) => isValidNumericId(pid)).map((pid) => Number(pid))
      : [];

    const [relatedResources, relatedPosts] = await Promise.all([
      relatedResourceIds.length
        ? Resource.findAll({
            where: { id: { [Op.in]: relatedResourceIds } },
            attributes: ["id", "title", "slug", "coverImage", "type"],
          })
        : [],
      relatedPostIds.length
        ? BlogPost.findAll({
            where: { id: { [Op.in]: relatedPostIds } },
            attributes: ["id", "title", "slug", "blog_picture"],
          })
        : [],
    ]);

    plain.relatedResourcesData = relatedResources;
    plain.relatedPostsData = relatedPosts;

    res.json({ data: plain });
  } catch (err) {
    console.error("getResourceById:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * PUT /resources/:id
 * Update a resource (admin/moderator only)
 */
export const updateResource = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    if (!canManageResources(req)) {
      return res.status(403).json({ message: "Permission denied" });
    }

    const { id } = req.params;
    const resource = await findResourceByPathId(id);
    if (!resource) {
      return res.status(404).json({ message: "Resource not found" });
    }

    const {
      title,
      description,
      content,
      type,
      status,
      tags,
      category,
      slug: customSlug,
      seoTitle,
      seoDescription,
      eventDate,
      eventLocation,
      publishAt,
      isFeatured,
      isPinned,
      displayOrder,
      relatedResources,
      relatedPosts,
    } = req.body || {};

    // Update fields
    if (title !== undefined) resource.title = cleanTitle(title);
    if (description !== undefined) resource.description = description?.trim() || "";
    if (content !== undefined) resource.content = cleanQuillHtml(content);
    
    if (type !== undefined) {
      if (!["guide", "announcement", "event-recap", "download"].includes(type)) {
        return res.status(400).json({ message: "Invalid resource type" });
      }
      resource.type = type;
    }

    if (status !== undefined) {
      if (!["Draft", "Published", "Archived"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      resource.status = status;
      if (status === "Published" && !resource.publishedAt) {
        resource.publishedAt = new Date();
      }
    }

    if (tags !== undefined) resource.tags = normalizeTags(tags);
    if (category !== undefined) resource.category = category?.trim() || "";

    // Handle slug update
    if (customSlug !== undefined && customSlug !== resource.slug) {
      if (customSlug === null || customSlug === "") {
        resource.slug = await generateUniqueSlug(Resource, resource.title, id);
      } else {
        const cleanSlug = customSlug.trim().toLowerCase();
        if (!isValidSlug(cleanSlug)) {
          return res.status(400).json({ message: "Invalid slug format" });
        }
        const existing = await Resource.findOne({ 
          where: {
            slug: cleanSlug,
            id: { [Op.ne]: resource.id },
          },
          attributes: ["id"],
        });
        if (existing) {
          return res.status(400).json({ message: "Slug already in use" });
        }
        resource.slug = cleanSlug;
      }
    }

    // SEO fields
    if (seoTitle !== undefined) resource.seoTitle = seoTitle?.trim() || "";
    if (seoDescription !== undefined) resource.seoDescription = seoDescription?.trim() || "";

    // Event fields
    if (eventDate !== undefined) {
      resource.eventDate = eventDate ? new Date(eventDate) : null;
    }
    if (eventLocation !== undefined) resource.eventLocation = eventLocation?.trim() || "";

    // Handle scheduled publishing
    if (publishAt !== undefined) {
      if (publishAt === null || publishAt === "") {
        resource.publishAt = null;
      } else {
        const newPublishAt = new Date(publishAt);
        if (isNaN(newPublishAt.getTime())) {
          return res.status(400).json({ message: "Invalid publishAt date" });
        }
        resource.publishAt = newPublishAt;
      }
    }

    // Featured/Pinned
    if (isFeatured !== undefined) resource.isFeatured = Boolean(isFeatured);
    if (isPinned !== undefined) resource.isPinned = Boolean(isPinned);
    if (displayOrder !== undefined) resource.displayOrder = Number(displayOrder) || 0;

    // Related content
    if (relatedResources !== undefined) {
      const validIds = (Array.isArray(relatedResources) ? relatedResources : [])
        .filter((rid) => isValidNumericId(rid) && Number(rid) !== Number(resource.id))
        .map((rid) => Number(rid));
      resource.relatedResources = validIds;
    }
    if (relatedPosts !== undefined) {
      const validIds = (Array.isArray(relatedPosts) ? relatedPosts : [])
        .filter((pid) => isValidNumericId(pid))
        .map((pid) => Number(pid));
      resource.relatedPosts = validIds;
    }

    // Handle file uploads
    const coverImage = getUploadedFile(req.files?.coverImage?.[0]);
    if (coverImage) resource.coverImage = coverImage;

    const downloadFile = getUploadedFile(req.files?.file?.[0]);
    if (downloadFile) {
      resource.fileUrl = downloadFile;
      resource.fileName = req.files?.file?.[0]?.originalname || "";
      resource.fileSize = req.files?.file?.[0]?.size || 0;
      resource.fileType = req.files?.file?.[0]?.mimetype || "";
    }

    await resource.save();
    res.json({ data: resource });
  } catch (err) {
    console.error("updateResource:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * DELETE /resources/:id
 * Delete a resource (admin/moderator only)
 */
export const deleteResource = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    if (!canManageResources(req)) {
      return res.status(403).json({ message: "Permission denied" });
    }

    const { id } = req.params;
    const resource = await findResourceByPathId(id);
    if (!resource) {
      return res.status(404).json({ message: "Resource not found" });
    }

    await resource.destroy();
    res.json({ success: true, message: "Resource deleted" });
  } catch (err) {
    console.error("deleteResource:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /resources/:id/views
 * Increment view count
 */
export const incrementResourceViews = async (req, res) => {
  try {
    const { id } = req.params;
    
    const resource = await findResourceByPathId(id);
    if (!resource) {
      return res.status(404).json({ message: "Resource not found" });
    }

    await resource.increment("views", { by: 1 });
    await resource.reload({ attributes: ["views"] });

    res.json({ views: resource.views });
  } catch (err) {
    console.error("incrementResourceViews:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /resources/:id/downloads
 * Increment download count
 */
export const incrementResourceDownloads = async (req, res) => {
  try {
    const { id } = req.params;
    
    const resource = await findResourceByPathId(id);
    if (!resource) {
      return res.status(404).json({ message: "Resource not found" });
    }

    await resource.increment("downloads", { by: 1 });
    await resource.reload({ attributes: ["downloads", "fileUrl"] });

    res.json({ 
      downloads: resource.downloads,
      fileUrl: resource.fileUrl,
    });
  } catch (err) {
    console.error("incrementResourceDownloads:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * GET /resources/types/summary
 * Get summary count by type
 */
export const getResourceTypeSummary = async (req, res) => {
  try {
    const summary = await Resource.findAll({
      where: { status: "Published" },
      attributes: [
        "type",
        [Resource.sequelize.fn("COUNT", Resource.sequelize.col("id")), "count"],
        [Resource.sequelize.fn("SUM", Resource.sequelize.col("views")), "totalViews"],
        [Resource.sequelize.fn("SUM", Resource.sequelize.col("downloads")), "totalDownloads"],
      ],
      group: ["type"],
      raw: true,
    });

    const result = {
      guide: { count: 0, views: 0, downloads: 0 },
      announcement: { count: 0, views: 0, downloads: 0 },
      "event-recap": { count: 0, views: 0, downloads: 0 },
      download: { count: 0, views: 0, downloads: 0 },
    };

    summary.forEach((item) => {
      if (result[item.type]) {
        result[item.type] = {
          count: Number(item.count || 0),
          views: Number(item.totalViews || 0),
          downloads: Number(item.totalDownloads || 0),
        };
      }
    });

    res.json({ data: result });
  } catch (err) {
    console.error("getResourceTypeSummary:", err);
    res.status(500).json({ message: "Server error" });
  }
};
