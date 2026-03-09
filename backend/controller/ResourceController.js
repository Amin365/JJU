import mongoose from "mongoose";
import Resource from "../models/Resource.js";
import User from "../models/user.js";
import { generateUniqueSlug, isValidSlug } from "../utility/slugUtils.js";
import cleanTitle from "../utility/cleanHtml.js";
import cleanQuillHtml from "../utility/cleanQuillHtml.js";

/**
 * Helper: Check if user is admin/moderator
 */
const isModeratorOrAdmin = async (userId) => {
  const user = await User.findById(userId).populate("role", "role plural").lean();
  if (!user) return false;

  const roleName = (user.role?.role || user.role?.plural || "").toLowerCase();
  return /super\s*admin/i.test(roleName) || /moderator/i.test(roleName);
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
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const canCreate = await isModeratorOrAdmin(userId);
    if (!canCreate) {
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
      const existing = await Resource.findOne({ slug: cleanSlug }).select("_id").lean();
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
    const skip = (pageNum - 1) * perPage;

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
      filter.tags = { $in: [new RegExp(tag.trim(), "i")] };
    }

    // Category filter
    if (category?.trim()) {
      filter.category = new RegExp(category.trim(), "i");
    }

    // Featured/Pinned filters
    if (featured === "true") filter.isFeatured = true;
    if (pinned === "true") filter.isPinned = true;

    // Search
    if (q?.trim()) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { title: regex },
        { description: regex },
        { content: regex },
        { tags: regex },
      ];
    }

    const sortOrder = { isPinned: -1, isFeatured: -1, displayOrder: -1, createdAt: -1 };

    const [resources, total] = await Promise.all([
      Resource.find(filter)
        .sort(sortOrder)
        .skip(skip)
        .limit(perPage)
        .populate("created_by", "email first_name last_name")
        .lean(),
      Resource.countDocuments(filter),
    ]);

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

    let resource;
    if (mongoose.isValidObjectId(id)) {
      resource = await Resource.findById(id)
        .populate("created_by", "email first_name last_name")
        .populate("relatedResources", "title slug coverImage type")
        .populate("relatedPosts", "title slug blog_picture");
    } else {
      resource = await Resource.findOne({ slug: id })
        .populate("created_by", "email first_name last_name")
        .populate("relatedResources", "title slug coverImage type")
        .populate("relatedPosts", "title slug blog_picture");
    }

    if (!resource) {
      return res.status(404).json({ message: "Resource not found" });
    }

    res.json({ data: resource });
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
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const canUpdate = await isModeratorOrAdmin(userId);
    if (!canUpdate) {
      return res.status(403).json({ message: "Permission denied" });
    }

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid resource id" });
    }

    const resource = await Resource.findById(id);
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
          slug: cleanSlug, 
          _id: { $ne: id } 
        }).select("_id").lean();
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
        .filter(rid => mongoose.isValidObjectId(rid) && String(rid) !== String(id));
      resource.relatedResources = validIds;
    }
    if (relatedPosts !== undefined) {
      const validIds = (Array.isArray(relatedPosts) ? relatedPosts : [])
        .filter(pid => mongoose.isValidObjectId(pid));
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
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const canDelete = await isModeratorOrAdmin(userId);
    if (!canDelete) {
      return res.status(403).json({ message: "Permission denied" });
    }

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid resource id" });
    }

    const resource = await Resource.findById(id);
    if (!resource) {
      return res.status(404).json({ message: "Resource not found" });
    }

    await resource.deleteOne();
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
    
    const updated = await Resource.findByIdAndUpdate(
      id,
      { $inc: { views: 1 } },
      { new: true, select: "views" }
    );

    if (!updated) {
      return res.status(404).json({ message: "Resource not found" });
    }

    res.json({ views: updated.views });
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
    
    const updated = await Resource.findByIdAndUpdate(
      id,
      { $inc: { downloads: 1 } },
      { new: true, select: "downloads fileUrl" }
    );

    if (!updated) {
      return res.status(404).json({ message: "Resource not found" });
    }

    res.json({ 
      downloads: updated.downloads,
      fileUrl: updated.fileUrl,
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
    const filter = { status: "Published" };

    const summary = await Resource.aggregate([
      { $match: filter },
      { 
        $group: { 
          _id: "$type", 
          count: { $sum: 1 },
          totalViews: { $sum: "$views" },
          totalDownloads: { $sum: "$downloads" },
        } 
      },
    ]);

    const result = {
      guide: { count: 0, views: 0, downloads: 0 },
      announcement: { count: 0, views: 0, downloads: 0 },
      "event-recap": { count: 0, views: 0, downloads: 0 },
      download: { count: 0, views: 0, downloads: 0 },
    };

    summary.forEach(item => {
      if (result[item._id]) {
        result[item._id] = {
          count: item.count,
          views: item.totalViews,
          downloads: item.totalDownloads,
        };
      }
    });

    res.json({ data: result });
  } catch (err) {
    console.error("getResourceTypeSummary:", err);
    res.status(500).json({ message: "Server error" });
  }
};
