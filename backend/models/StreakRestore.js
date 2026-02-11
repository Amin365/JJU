import mongoose from "mongoose";

const StreakRestoreSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    month: { type: String, required: true, index: true }, // YYYY-MM
    count: { type: Number, default: 0 },
    restoredForDate: { type: Date, default: null },
  },
  { timestamps: true }
);

StreakRestoreSchema.index({ user: 1, month: 1 }, { unique: true });

export default mongoose.model("StreakRestore", StreakRestoreSchema);
