import mongoose from "mongoose";

const ReadingChallengeSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: "" },
  type: {
    type: String,
    enum: ["streak", "pages", "minutes", "reports"],
    required: true,
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  rules: {
    minPagesPerDay: { type: Number, default: 0 },
    minMinutesPerDay: { type: Number, default: 0 },
    requiredConsecutiveDays: { type: Number, default: 0 },
    targetTotal: { type: Number, default: 0 },
  },
  status: { type: String, enum: ["Draft", "Active", "Completed"], default: "Draft" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

const ReadingChallenge = mongoose.model("ReadingChallenge", ReadingChallengeSchema);
export default ReadingChallenge;
