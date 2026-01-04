import mongoose from "mongoose";

const PermissionCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,        // 🔒 prevent duplicates
      trim: true,
      default: "",
    },

    system: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: false,
  }
);

// 📌 Index for fast lookup
PermissionCategorySchema.index({ name: 1 });

const PermissionCategory = mongoose.model(
  "PermissionCategory",
  PermissionCategorySchema
);

export default PermissionCategory;
