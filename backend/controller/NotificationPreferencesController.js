import NotificationPreferences from "../models/NotificationPreferences.js";
import User from "../models/user.js";
import mongoose from "mongoose";

// Default preferences structure
const defaultPreferences = {
  pushOnOverdue: true,
  pushOnDueTomorrow: true,
  pushOnStreakReminder: true,
  pushOnBlogAnnouncement: true,
  pushOnJoinRequestUpdate: true,
  pushOnChallengeReminder: true,
  pushOnAchievementUnlock: true,
  pushOnGoalProgress: true,
  pushOnSystemAnnouncement: true,
  emailOnOverdue: true,
  emailOnDueTomorrow: false,
  emailOnWeeklyDigest: true,
  emailOnJoinRequestUpdate: true,
  emailOnAnnouncement: true,
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
};

// Get user's notification preferences
export const getMyPreferences = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    let prefs = await NotificationPreferences.findOne({ user: userId }).lean().exec();

    // If no preferences exist, return defaults
    if (!prefs) {
      prefs = { user: userId, ...defaultPreferences };
    }

    return res.json({ data: prefs });
  } catch (err) {
    return next(err);
  }
};

// Update user's notification preferences
export const updateMyPreferences = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const allowedFields = [
      "pushOnOverdue",
      "pushOnDueTomorrow",
      "pushOnStreakReminder",
      "pushOnBlogAnnouncement",
      "pushOnJoinRequestUpdate",
      "pushOnChallengeReminder",
      "pushOnAchievementUnlock",
      "pushOnGoalProgress",
      "pushOnSystemAnnouncement",
      "emailOnOverdue",
      "emailOnDueTomorrow",
      "emailOnWeeklyDigest",
      "emailOnJoinRequestUpdate",
      "emailOnAnnouncement",
      "quietHoursEnabled",
      "quietHoursStart",
      "quietHoursEnd",
    ];

    // Filter input to only allowed fields
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const prefs = await NotificationPreferences.findOneAndUpdate(
      { user: userId },
      { $set: updates },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean().exec();

    return res.json({ data: prefs, message: "Preferences updated successfully" });
  } catch (err) {
    return next(err);
  }
};

// Reset preferences to defaults
export const resetMyPreferences = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const prefs = await NotificationPreferences.findOneAndUpdate(
      { user: userId },
      { $set: defaultPreferences },
      { new: true, upsert: true }
    ).lean().exec();

    return res.json({ data: prefs, message: "Preferences reset to defaults" });
  } catch (err) {
    return next(err);
  }
};

// Check if user has specific preference enabled (helper for other modules)
export async function checkUserPreference(userId, preferenceKey) {
  if (!userId) return defaultPreferences[preferenceKey] ?? true;

  const prefs = await NotificationPreferences.findOne({ user: userId }).lean().exec();
  if (!prefs) return defaultPreferences[preferenceKey] ?? true;

  return prefs[preferenceKey] ?? defaultPreferences[preferenceKey] ?? true;
}

// Check if current time is within quiet hours for user
export async function isInQuietHours(userId) {
  if (!userId) return false;

  const prefs = await NotificationPreferences.findOne({ user: userId }).lean().exec();
  if (!prefs || !prefs.quietHoursEnabled) return false;

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  const [startHour, startMinute] = prefs.quietHoursStart.split(":").map(Number);
  const [endHour, endMinute] = prefs.quietHoursEnd.split(":").map(Number);
  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;

  // Handle overnight quiet hours (e.g., 22:00 - 08:00)
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime < endTime;
  }

  return currentTime >= startTime && currentTime < endTime;
}

export default {
  getMyPreferences,
  updateMyPreferences,
  resetMyPreferences,
  checkUserPreference,
  isInQuietHours,
};
