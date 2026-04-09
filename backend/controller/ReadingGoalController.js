import DailyReport from "../models/DailyReport.js";
import { Op } from "sequelize";
import Notification from "../models/Notification.js";
import ReadingGoal from "../models/ReadingGoal.js";
import User from "../models/user.js";
import { checkUserPreference, isInQuietHours } from "./NotificationPreferencesController.js";
import { sendMail } from "./EmailController.js";
import { calcPagesRead } from "../utility/streakUtils.js";
import { goalCompletedTemplate } from "../utility/emailTemplates.js";
import { sendPushToUser } from "../utility/push.js";

const GOAL_STATUS = {
  ACTIVE: "Active",
  COMPLETED: "Completed",
  EXPIRED: "Expired",
};

const GOAL_TYPE_LABELS = {
  pages_per_day: "Pages / Day",
  minutes_per_day: "Minutes / Day",
  reports_per_week: "Reports / Week",
};

const isValidId = (id) => Number.isInteger(Number(id)) && Number(id) > 0;

function startOfUtcDay(value) {
  const date = new Date(value);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)
  );
}

function endOfUtcDay(value) {
  const date = new Date(value);
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999)
  );
}

function diffDaysInclusive(start, end) {
  const startDay = startOfUtcDay(start);
  const endDay = startOfUtcDay(end);
  return Math.max(1, Math.floor((endDay - startDay) / (1000 * 60 * 60 * 24)) + 1);
}

function getGoalRange(goal, now = new Date()) {
  const goalStart = goal?.startDate ? startOfUtcDay(goal.startDate) : startOfUtcDay(now);
  const goalEnd = goal?.endDate ? endOfUtcDay(goal.endDate) : null;
  const effectiveEnd = goalEnd && goalEnd < now ? goalEnd : now;

  return {
    goalStart,
    goalEnd,
    effectiveEnd,
    hasEnded: Boolean(goalEnd && now > goalEnd),
  };
}

function getGoalCompletionState(goal, progress, now = new Date()) {
  if (goal?.status === GOAL_STATUS.COMPLETED && goal?.completedAt) {
    return {
      status: GOAL_STATUS.COMPLETED,
      completedAt: goal.completedAt,
    };
  }

  const currentValue = Number(progress?.currentValue || 0);
  const targetValue = Number(goal?.targetValue || 0);
  const { hasEnded } = getGoalRange(goal, now);

  if (targetValue > 0 && currentValue >= targetValue) {
    return {
      status: GOAL_STATUS.COMPLETED,
      completedAt: goal?.completedAt || now,
    };
  }

  if (hasEnded) {
    return {
      status: GOAL_STATUS.EXPIRED,
      completedAt: null,
    };
  }

  return {
    status: GOAL_STATUS.ACTIVE,
    completedAt: null,
  };
}

function getGoalLabel(goal) {
  return GOAL_TYPE_LABELS[goal?.goalType] || goal?.goalType || "Reading Goal";
}

async function computeGoalProgress(goal) {
  const now = new Date();
  const { goalType, targetValue } = goal;
  const { goalStart, effectiveEnd } = getGoalRange(goal, now);

  if (effectiveEnd < goalStart) {
    return { currentValue: 0, percentage: 0 };
  }

  if (goalType === "pages_per_day" || goalType === "minutes_per_day") {
    const lookbackDate = startOfUtcDay(now);
    lookbackDate.setUTCDate(lookbackDate.getUTCDate() - 6);
    const rangeStart = goalStart > lookbackDate ? goalStart : lookbackDate;

    const reports = await DailyReport.findAll({
      where: {
        created_by: goal.user_id,
        readingDate: { [Op.gte]: rangeStart, [Op.lte]: effectiveEnd },
      },
    });

    let total = 0;
    if (goalType === "pages_per_day") {
      total = reports.reduce((sum, r) => sum + calcPagesRead(r), 0);
    } else {
      total = reports.reduce((sum, r) => sum + Number(r.timeSpent || 0), 0);
    }

    const average = total / diffDaysInclusive(rangeStart, effectiveEnd);
    const percentage =
      Number(targetValue) > 0
        ? Math.min(100, Math.round((average / Number(targetValue)) * 100))
        : 0;

    return { currentValue: Math.round(average), percentage };
  }

  if (goalType === "reports_per_week") {
    const dayOfWeek = now.getUTCDay();
    const startOfWeek = startOfUtcDay(now);
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - dayOfWeek);
    const rangeStart = goalStart > startOfWeek ? goalStart : startOfWeek;

    const count = await DailyReport.count({
      where: {
        created_by: goal.user_id,
        readingDate: { [Op.gte]: rangeStart, [Op.lte]: effectiveEnd },
      },
    });

    const percentage =
      Number(targetValue) > 0
        ? Math.min(100, Math.round((count / Number(targetValue)) * 100))
        : 0;

    return { currentValue: count, percentage };
  }

  return { currentValue: 0, percentage: 0 };
}

async function sendGoalCompletionNotifications(goal, user, progress) {
  const goalLabel = getGoalLabel(goal);
  const currentValue = Number(progress?.currentValue || 0);
  const targetValue = Number(goal?.targetValue || 0);
  const recipientName =
    `${user?.first_name || ""} ${user?.last_name || ""}`.trim() ||
    user?.username ||
    "Reader";

  await Notification.create({
    user_id: user.id,
    title: `Goal completed: ${goalLabel}`,
    message: `Congratulations ${recipientName}! You reached ${currentValue}/${targetValue} on your ${goalLabel.toLowerCase()} goal.`,
    type: "success",
    category: "goal",
    meta: {
      goal: goal.id,
      kind: "goal-completed",
      goalType: goal.goalType,
      targetValue,
      currentValue,
    },
  });

  try {
    const canSendPush = await checkUserPreference(user.id, "pushOnGoalProgress");
    const inQuietHours = await isInQuietHours(user.id);

    if (canSendPush && !inQuietHours) {
      await sendPushToUser(user.id, {
        title: "🎯 Goal completed!",
        body: `You reached ${currentValue}/${targetValue} on your ${goalLabel.toLowerCase()} goal.`,
        data: { url: "/dashboard/goals", goalId: String(goal.id) },
      });
    }
  } catch (pushError) {
    console.error(`Goal push notification failed for user ${user.id}:`, pushError.message);
  }

  try {
    const canSendEmail = await checkUserPreference(user.id, "emailOnGoalProgress");
    if (canSendEmail && user?.email) {
      const emailContent = goalCompletedTemplate({
        firstName: user.first_name,
        lastName: user.last_name,
        goalLabel,
        currentValue,
        targetValue,
      });

      await sendMail({
        to: user.email,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
      });
    }
  } catch (emailError) {
    console.error(`Goal completion email failed for user ${user.id}:`, emailError.message);
  }
}

export async function syncGoalStatesForUser(userId, options = {}) {
  if (!userId) return [];

  const now = options.now || new Date();
  const sendNotifications = options.sendNotifications !== false;

  const goals = await ReadingGoal.findAll({
    where: { user_id: Number(userId) },
  });

  if (!goals.length) return [];

  const user = sendNotifications
    ? await User.findByPk(Number(userId), {
        attributes: ["id", "first_name", "last_name", "username", "email"],
      })
    : null;

  const results = [];

  for (const goal of goals) {
    const progress = await computeGoalProgress(goal);
    const completionState = getGoalCompletionState(goal, progress, now);

    const updates = {};
    if ((goal.status || GOAL_STATUS.ACTIVE) !== completionState.status) {
      updates.status = completionState.status;
    }

    if (completionState.status === GOAL_STATUS.COMPLETED) {
      if (!goal.completedAt && completionState.completedAt) {
        updates.completedAt = completionState.completedAt;
      }
    } else if (goal.completedAt) {
      updates.completedAt = null;
    }

    let completionNotifiedAt = goal.completionNotifiedAt || null;
    const shouldNotify =
      sendNotifications &&
      completionState.status === GOAL_STATUS.COMPLETED &&
      !goal.completionNotifiedAt &&
      Boolean(user);

    if (shouldNotify) {
      try {
        await sendGoalCompletionNotifications({ ...goal.toJSON(), ...updates }, user, progress);
        completionNotifiedAt = now;
        updates.completionNotifiedAt = now;
      } catch (notificationError) {
        console.error(
          `Goal completion notification failed for goal ${goal.id}:`,
          notificationError.message
        );
      }
    }

    if (Object.keys(updates).length > 0) {
      await goal.update(updates);
    }

    results.push({
      ...(goal.toJSON ? goal.toJSON() : goal),
      ...progress,
      status: updates.status || goal.status || GOAL_STATUS.ACTIVE,
      completedAt: Object.prototype.hasOwnProperty.call(updates, "completedAt")
        ? updates.completedAt
        : goal.completedAt || null,
      completionNotifiedAt,
    });
  }

  return results;
}

// GET /users/me/goals
export const getMyGoals = async (req, res, next) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const goalsWithProgress = await syncGoalStatesForUser(userId, {
      sendNotifications: true,
    });

    return res.status(200).json({ data: goalsWithProgress });
  } catch (err) {
    return next(err);
  }
};

// POST /users/me/goals
export const createGoal = async (req, res, next) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const { goalType, targetValue, startDate, endDate } = req.body;
    const validTypes = ["pages_per_day", "minutes_per_day", "reports_per_week"];

    if (!goalType || !validTypes.includes(goalType)) {
      return res.status(400).json({
        message: `goalType must be one of: ${validTypes.join(", ")}`,
      });
    }

    if (!targetValue || Number(targetValue) < 1) {
      return res.status(400).json({ message: "targetValue must be at least 1" });
    }

    if (!startDate) {
      return res.status(400).json({ message: "startDate is required" });
    }

    const goal = await ReadingGoal.create({
      user_id: Number(userId),
      goalType,
      targetValue: Number(targetValue),
      startDate,
      endDate: endDate || null,
      status: GOAL_STATUS.ACTIVE,
      completedAt: null,
      completionNotifiedAt: null,
    });

    return res.status(201).json({ data: goal });
  } catch (err) {
    return next(err);
  }
};

// PATCH /users/me/goals/:id
export const updateGoal = async (req, res, next) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid goal id" });

    const { targetValue, endDate } = req.body;
    const update = {};

    if (targetValue !== undefined) {
      const val = Number(targetValue);
      if (val < 1) return res.status(400).json({ message: "targetValue must be at least 1" });
      update.targetValue = val;
    }

    if (endDate !== undefined) update.endDate = endDate;

    if (Object.keys(update).length > 0) {
      update.status = GOAL_STATUS.ACTIVE;
      update.completedAt = null;
      update.completionNotifiedAt = null;
    }

    const goal = await ReadingGoal.findOne({
      where: { id: Number(id), user_id: Number(userId) },
    });

    if (!goal) return res.status(404).json({ message: "Goal not found" });

    if (Object.keys(update).length > 0) {
      await goal.update(update);
    }

    const goalsWithProgress = await syncGoalStatesForUser(userId, {
      sendNotifications: false,
    });

    const goalWithProgress = goalsWithProgress.find(
      (item) => String(item.id) === String(goal.id)
    );

    return res.status(200).json({ data: goalWithProgress || goal });
  } catch (err) {
    return next(err);
  }
};

// DELETE /users/me/goals/:id
export const deleteGoal = async (req, res, next) => {
  try {
    const userId = req.user?.id ?? req.user?._id;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    if (!isValidId(id)) return res.status(400).json({ message: "Invalid goal id" });

    const goal = await ReadingGoal.findOne({
      where: { id: Number(id), user_id: Number(userId) },
    });

    if (!goal) return res.status(404).json({ message: "Goal not found" });

    await goal.destroy();
    return res.status(200).json({ message: "Goal deleted" });
  } catch (err) {
    return next(err);
  }
};

export default {
  getMyGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  syncGoalStatesForUser,
};