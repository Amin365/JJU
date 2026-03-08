import DailyReport from "../models/DailyReport.js";
import UserAchievement from "../models/UserAchievement.js";

export const ACHIEVEMENTS = [
  { code: "first_report", title: "First Steps", description: "Submit your first reading report", icon: "📖", unlockRules: { type: "first_report", threshold: 1 } },
  { code: "streak_7", title: "Week Warrior", description: "Maintain a 7-day reading streak", icon: "🔥", unlockRules: { type: "streak", threshold: 7 } },
  { code: "streak_30", title: "Monthly Master", description: "Maintain a 30-day reading streak", icon: "⚡", unlockRules: { type: "streak", threshold: 30 } },
  { code: "reports_10", title: "Dedicated Reader", description: "Submit 10 reading reports", icon: "📚", unlockRules: { type: "reports_count", threshold: 10 } },
  { code: "reports_50", title: "Bookworm", description: "Submit 50 reading reports", icon: "🦋", unlockRules: { type: "reports_count", threshold: 50 } },
  { code: "pages_1000", title: "Page Turner", description: "Read 1000 pages total", icon: "📜", unlockRules: { type: "pages_count", threshold: 1000 } },
];

function calcLongestStreak(dates) {
  if (!dates.length) return 0;
  const sorted = [...new Set(dates.map((d) => new Date(d).toISOString().slice(0, 10)))].sort();
  let max = 1, cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = (curr - prev) / (1000 * 60 * 60 * 24);
    cur = diff === 1 ? cur + 1 : 1;
    if (cur > max) max = cur;
  }
  return max;
}

// GET /achievements
export const getAchievements = (req, res) => {
  return res.status(200).json({ data: ACHIEVEMENTS });
};

// GET /users/me/achievements
export const getMyAchievements = async (req, res, next) => {
  try {
    const unlocked = await UserAchievement.find({ user: req.user._id }).lean();
    const unlockedMap = new Map(unlocked.map((u) => [u.achievementCode, u.unlockedAt]));

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
  const reports = await DailyReport.find({ createdBy: userId }).lean();
  const totalReports = reports.length;
  const pagesTotal = reports.reduce((sum, r) => sum + Math.max(0, (r.pagesTo || 0) - (r.pagesFrom || 0)), 0);
  const longestStreak = calcLongestStreak(reports.map((r) => r.readingDate));

  const alreadyUnlocked = await UserAchievement.find({ user: userId }).lean();
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
      try {
        await UserAchievement.create({ user: userId, achievementCode: achievement.code });
        newlyUnlocked.push(achievement.code);
      } catch (e) {
        // ignore duplicate key errors
        if (e.code !== 11000) throw e;
      }
    }
  }

  return newlyUnlocked;
};
