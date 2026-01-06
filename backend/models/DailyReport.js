import mongoose from "mongoose";

const DailyReportSchema = new mongoose.Schema(
  {
    // who submitted the report
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // what book the report is for
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: true,
      index: true,
    },

    // report day (only date part is used by UI)
    readingDate: {
      type: Date,
      required: true,
      index: true,
    },

    pagesFrom: { type: Number, required: true, min: 0 },
    pagesTo: { type: Number, required: true, min: 0 },

    timeSpent: { type: Number, required: true, min: 0 }, // minutes
    summary: { type: String, required: true, trim: true },

    rating: { type: Number, required: true, min: 1, max: 5 },

    status: {
      type: String,
      enum: ["Pending", "Approved", "Needs Improvement"],
      default: "Pending",
      index: true,
    },
  },
  { timestamps: true }
);

// Prevent duplicate report for same user+book+day
DailyReportSchema.index({ createdBy: 1, book: 1, readingDate: 1 }, { unique: true });

export default mongoose.model("DailyReport", DailyReportSchema);