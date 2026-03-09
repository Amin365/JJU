import mongoose from "mongoose";

// Report sub-schema for abuse reports
const ReportSchema = new mongoose.Schema(
  {
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, required: true, trim: true },
    details: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

const ReplySchema = new mongoose.Schema(
  {
    content: { type: String, required: true, trim: true },
    author: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      name: { type: String, required: true, trim: true },
      avatar: { type: String, default: "" },
      role: { type: String, enum: ["Member", "Moderator"], default: "Member" },
    },
    likes: { type: Number, default: 0 },
    // Phase 7: Moderation fields for replies
    status: {
      type: String,
      enum: ["approved", "pending", "hidden", "deleted"],
      default: "approved",
    },
    reports: { type: [ReportSchema], default: [] },
  },
  { timestamps: true }
);

const CommentSchema = new mongoose.Schema(
  {
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "BlogPost", required: true, index: true },
    content: { type: String, required: true, trim: true },

    author: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      name: { type: String, required: true, trim: true },
      avatar: { type: String, default: "" },
      role: { type: String, enum: ["Member", "Moderator"], default: "Member" },
    },

    // cached count
    likes: { type: Number, default: 0 },

    // NEW: who liked this comment
    likedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    isPinned: { type: Boolean, default: false },
    isBestInsight: { type: Boolean, default: false },

    replies: { type: [ReplySchema], default: [] },

    // Phase 7: Moderation fields
    status: {
      type: String,
      enum: ["approved", "pending", "hidden", "deleted"],
      default: "approved",
      index: true,
    },
    reports: { type: [ReportSchema], default: [] },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    moderatedAt: { type: Date, default: null },
    moderationNote: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

// Index for moderation queue queries
CommentSchema.index({ status: 1, createdAt: -1 });
CommentSchema.index({ "reports.0": 1 }); // Index for comments with reports

export default mongoose.model("Comment", CommentSchema);