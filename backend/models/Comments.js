import mongoose from "mongoose";

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
  },
  { timestamps: true }
);

export default mongoose.model("Comment", CommentSchema);