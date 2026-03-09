import mongoose from "mongoose";

const ResourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    content: { type: String, default: "" },

    type: {
      type: String,
      enum: ["guide", "announcement", "event-recap", "download"],
      required: true,
      index: true,
    },

    // For downloadable resources
    fileUrl: { type: String, default: "" },
    fileName: { type: String, default: "" },
    fileSize: { type: Number, default: 0 },
    fileType: { type: String, default: "" },

    // For event recaps
    eventDate: { type: Date, default: null },
    eventLocation: { type: String, default: "" },

    // Featured image
    coverImage: { type: String, default: "" },

    // Author
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    author_name: { type: String, default: "" },

    // Status and visibility
    status: {
      type: String,
      enum: ["Draft", "Published", "Archived"],
      default: "Draft",
      index: true,
    },

    // Featured/Pinned
    isFeatured: { type: Boolean, default: false },
    isPinned: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 0 },

    // SEO
    slug: { type: String, unique: true, sparse: true, trim: true },
    seoTitle: { type: String, default: "", trim: true, maxlength: 70 },
    seoDescription: { type: String, default: "", trim: true, maxlength: 160 },

    // Tags and categories
    tags: { type: [String], default: [] },
    category: { type: String, default: "" },

    // Stats
    views: { type: Number, default: 0 },
    downloads: { type: Number, default: 0 },

    // Scheduling
    publishAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null },

    // Related content
    relatedResources: [{ type: mongoose.Schema.Types.ObjectId, ref: "Resource" }],
    relatedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: "BlogPost" }],
  },
  { timestamps: true }
);

// Indexes for common queries
ResourceSchema.index({ type: 1, status: 1, createdAt: -1 });
ResourceSchema.index({ status: 1, isFeatured: -1, isPinned: -1 });

export default mongoose.model("Resource", ResourceSchema);
