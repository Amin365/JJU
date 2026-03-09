import mongoose from "mongoose";

const ReadingGoalSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  goalType: {
    type: String,
    enum: ["pages_per_day", "minutes_per_day", "reports_per_week"],
    required: true,
  },
  targetValue: { type: Number, required: true, min: 1 },
  startDate: { type: Date, required: true },
  endDate: { type: Date, default: null },
  status: {
    type: String,
    enum: ["Active", "Completed", "Expired"],
    default: "Active",
  },
  completedAt: { type: Date, default: null },
  completionNotifiedAt: { type: Date, default: null },
}, { timestamps: true });

const ReadingGoal = mongoose.model("ReadingGoal", ReadingGoalSchema);
export default ReadingGoal;
