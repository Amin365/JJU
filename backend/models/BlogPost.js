import mongoose from "mongoose";

const BlogPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },

    author: { type: String, required: true, trim: true }, // derived from JWT user

    relatedBook: { type: String, default: "" },

    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    status: { type: String, enum: ["Draft", "Published"], default: "Draft" },

    tags: { type: [String], required: true, default: [] },

    likes: { type: Number, required: true, default: 0 },
    views: { type: Number, required: true, default: 0 },

    blog_picture: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("BlogPost", BlogPostSchema);