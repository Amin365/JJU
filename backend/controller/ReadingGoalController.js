import DailyReport from "../models/DailyReport.js";
import ReadingGoal from "../models/ReadingGoal.js";
import { calcPagesRead } from "../utility/streakUtils.js";

async function computeGoalProgress(goal) {
  const now = new Date();
  const { goalType, targetValue } = goal;

  if (goalType === "pages_per_day" || goalType === "minutes_per_day") {
    const lookbackDate = new Date(now);
    lookbackDate.setDate(lookbackDate.getDate() - 7);

    const reports = await DailyReport.find({
      createdBy: goal.user,
      readingDate: { $gte: lookbackDate, $lte: now },
    }).lean();

    let total = 0;
    if (goalType === "pages_per_day") {
      total = reports.reduce((sum, r) => sum + calcPagesRead(r), 0);
    } else {
      total = reports.reduce((sum, r) => sum + (r.timeSpent || 0), 0);
    }

    const average = total / 7;
    const percentage = Math.min(100, Math.round((average / targetValue) * 100));
    return { currentValue: Math.round(average), percentage };
  }

  if (goalType === "reports_per_week") {
    const dayOfWeek = now.getUTCDay();
    const startOfWeek = new Date(now);
    startOfWeek.setUTCDate(now.getUTCDate() - dayOfWeek);
    startOfWeek.setUTCHours(0, 0, 0, 0);

    const count = await DailyReport.countDocuments({
      createdBy: goal.user,
      readingDate: { $gte: startOfWeek, $lte: now },
    });

    const percentage = Math.min(100, Math.round((count / targetValue) * 100));
    return { currentValue: count, percentage };
  }

  return { currentValue: 0, percentage: 0 };
}

// GET /users/me/goals
export const getMyGoals = async (req, res, next) => {
  try {
    const goals = await ReadingGoal.find({ user: req.user._id }).lean();
    const goalsWithProgress = await Promise.all(
      goals.map(async (goal) => {
        const progress = await computeGoalProgress(goal);
        return { ...goal, ...progress };
      })
    );
    return res.status(200).json({ data: goalsWithProgress });
  } catch (err) {
    return next(err);
  }
};

// POST /users/me/goals
export const createGoal = async (req, res, next) => {
  try {
    const { goalType, targetValue, startDate, endDate } = req.body;
    const validTypes = ["pages_per_day", "minutes_per_day", "reports_per_week"];
    if (!goalType || !validTypes.includes(goalType)) {
      return res.status(400).json({ message: `goalType must be one of: ${validTypes.join(", ")}` });
    }
    if (!targetValue || Number(targetValue) < 1) {
      return res.status(400).json({ message: "targetValue must be at least 1" });
    }
    if (!startDate) {
      return res.status(400).json({ message: "startDate is required" });
    }

    const goal = await ReadingGoal.create({
      user: req.user._id,
      goalType,
      targetValue: Number(targetValue),
      startDate,
      endDate: endDate || null,
    });

    return res.status(201).json({ data: goal });
  } catch (err) {
    return next(err);
  }
};

// PATCH /users/me/goals/:id
export const updateGoal = async (req, res, next) => {
  try {
    const { targetValue, endDate } = req.body;
    const update = {};
    if (targetValue !== undefined) {
      const val = Number(targetValue);
      if (val < 1) return res.status(400).json({ message: "targetValue must be at least 1" });
      update.targetValue = val;
    }
    if (endDate !== undefined) update.endDate = endDate;

    const goal = await ReadingGoal.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      update,
      { new: true }
    ).lean();

    if (!goal) return res.status(404).json({ message: "Goal not found" });
    return res.status(200).json({ data: goal });
  } catch (err) {
    return next(err);
  }
};

// DELETE /users/me/goals/:id
export const deleteGoal = async (req, res, next) => {
  try {
    const goal = await ReadingGoal.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!goal) return res.status(404).json({ message: "Goal not found" });
    return res.status(200).json({ message: "Goal deleted" });
  } catch (err) {
    return next(err);
  }
};
