import DailyReport from "../models/DailyReport.js";
import UserAchievement from "../models/UserAchievement.js";
import { calcLongestStreak, calcPagesRead } from "../utility/streakUtils.js";

export const ACHIEVEMENTS = [
  {
    code: "first_report",
    title: "First Steps",
    description: "Submit your first reading report",
    icon: "📖",
    unlockRules: { type: "first_report", threshold: 1 },
  },
  {
    code: "streak_7",
    title: "Week Warrior",
    description: "Maintain a 7-day reading streak",
    icon: "🔥",
    unlockRules: { type: "streak", threshold: 7 },
  },
  {
    code: "streak_30",
    title: "Monthly Master",
    description: "Maintain a 30-day reading streak",
    icon: "⚡",
    unlockRules: { type: "streak", threshold: 30 },
  },
  {
    code: "reports_10",
    title: "Dedicated Reader",
    description: "Submit 10 reading reports",
    icon: "📚",
    unlockRules: { type: "reports_count", threshold: 10 },
  },
  {
    code: "reports_50",
    title: "Bookworm",
    description: "Submit 50 reading reports",
    icon: "🦋",
    unlockRules: { type: "reports_count", threshold: 50 },
  },
  {
    code: "pages_1000",
    title: "Page Turner",
    description: "Read 1000 pages total",
    icon: "📜",
    unlockRules: { type: "pages_count", threshold: 1000 },
  },
];

// GET /achievements
export const getAchievements = (req, res) => {
  return res.status(200).json({ data: ACHIEVEMENTS });
};

// GET /users/me/achievements
export const getMyAchievements = async (req, res, next) => {
  try {
    const unlocked = await UserAchievement.findAll({
      where: { user_id: req.user.id },
      attributes: ["achievementCode", "unlockedAt"],
      raw: true,
    });

    const unlockedMap = new Map(
      unlocked.map((u) => [u.achievementCode, u.unlockedAt])
    );

    const result = ACHIEVEMENTS.map((a) => ({
      ...a,
      unlocked: unlockedMap.has(a.code),
      unlockedAt: unlockedMap.get(a.code) || null,
    }));

    return res.status(200).json({ data: result });
  } catch (err) {
    return next(err);
  }
};

// Helper: check and unlock achievements for a user
export const checkAndUnlockAchievements = async (userId) => {
  const reports = await DailyReport.findAll({
    where: { created_by: userId },
    attributes: ["id", "readingDate", "pagesFrom", "pagesTo", "timeSpent"],
    raw: true,
  });

  const totalReports = reports.length;
  const pagesTotal = reports.reduce((sum, r) => sum + calcPagesRead(r), 0);
  const longestStreak = calcLongestStreak(reports.map((r) => r.readingDate));

  const alreadyUnlocked = await UserAchievement.findAll({
    where: { user_id: userId },
    attributes: ["achievementCode"],
    raw: true,
  });

  const unlockedCodes = new Set(alreadyUnlocked.map((u) => u.achievementCode));
  const newlyUnlocked = [];

  for (const achievement of ACHIEVEMENTS) {
    if (unlockedCodes.has(achievement.code)) continue;

    const { type, threshold } = achievement.unlockRules;
    let met = false;

    if (type === "first_report") met = totalReports >= threshold;
    else if (type === "streak") met = longestStreak >= threshold;
    else if (type === "reports_count") met = totalReports >= threshold;
    else if (type === "pages_count") met = pagesTotal >= threshold;

    if (met) {
      const [row, created] = await UserAchievement.findOrCreate({
        where: {
          user_id: userId,
          achievementCode: achievement.code,
        },
        defaults: {
          user_id: userId,
          achievementCode: achievement.code,
          unlockedAt: new Date(),
        },
      });

      if (created) {
        newlyUnlocked.push(row.achievementCode);
      }
    }
  }

  return newlyUnlocked;
};

export default {
  getAchievements,
  getMyAchievements,
  checkAndUnlockAchievements,
};