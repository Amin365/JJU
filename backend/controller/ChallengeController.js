import User from "../models/user.js";
import DailyReport from "../models/DailyReport.js";
import ReadingChallenge from "../models/ReadingChallenge.js";
import ChallengeParticipation from "../models/ChallengeParticipation.js";
import { calcLongestStreak, calcPagesRead } from "../utility/streakUtils.js";


async function computeProgress(userId, challenge) {
  const reports = await DailyReport.find({
    createdBy: userId,
    readingDate: { $gte: challenge.startDate, $lte: challenge.endDate },
    status: "Approved",
  }).lean();

  const pagesRead = reports.reduce((sum, r) => sum + calcPagesRead(r), 0);
  const minutesRead = reports.reduce((sum, r) => sum + (r.timeSpent || 0), 0);
  const reportsCount = reports.length;
  const streak = calcLongestStreak(reports.map((r) => r.readingDate));

  return { pagesRead, minutesRead, reportsCount, streak };
}

// POST /challenges - admin/moderator only
export const createChallenge = async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.user._id).populate("role", "role plural").lean();
    const roleName = (currentUser?.role?.role || currentUser?.role?.plural || "").toLowerCase();
    const isSuperAdmin = /super\s*admin/i.test(roleName);
    const isModerator = /moderator/i.test(roleName);
    if (!isSuperAdmin && !isModerator) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { title, type, startDate, endDate, description, rules, status } = req.body;
    if (!title || !type || !startDate || !endDate) {
      return res.status(400).json({ message: "title, type, startDate, and endDate are required" });
    }

    const challenge = await ReadingChallenge.create({
      title,
      type,
      startDate,
      endDate,
      description,
      rules,
      status: status || "Draft",
      createdBy: req.user._id,
    });

    return res.status(201).json({ data: challenge });
  } catch (err) {
    return next(err);
  }
};

// GET /challenges
export const getChallenges = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * perPage;

    const [items, total] = await Promise.all([
      ReadingChallenge.find(filter)
        .populate("createdBy", "first_name last_name email")
        .sort({ startDate: -1 })
        .skip(skip)
        .limit(perPage)
        .lean(),
      ReadingChallenge.countDocuments(filter),
    ]);

    return res.status(200).json({ data: items, total, page: pageNum, limit: perPage, totalPages: Math.ceil(total / perPage) });
  } catch (err) {
    return next(err);
  }
};

// GET /challenges/:id
export const getChallengeById = async (req, res, next) => {
  try {
    const challenge = await ReadingChallenge.findById(req.params.id)
      .populate("createdBy", "first_name last_name email")
      .lean();
    if (!challenge) return res.status(404).json({ message: "Challenge not found" });
    return res.status(200).json({ data: challenge });
  } catch (err) {
    return next(err);
  }
};

// POST /challenges/:id/join
export const joinChallenge = async (req, res, next) => {
  try {
    const challenge = await ReadingChallenge.findById(req.params.id).lean();
    if (!challenge) return res.status(404).json({ message: "Challenge not found" });
    if (challenge.status !== "Active") {
      return res.status(400).json({ message: "Challenge is not active" });
    }

    const existing = await ChallengeParticipation.findOne({ challenge: challenge._id, user: req.user._id });
    if (existing) {
      return res.status(409).json({ message: "Already participating in this challenge" });
    }

    const participation = await ChallengeParticipation.create({
      challenge: challenge._id,
      user: req.user._id,
    });

    return res.status(201).json({ data: participation });
  } catch (err) {
    return next(err);
  }
};

// GET /challenges/:id/leaderboard
export const getChallengeLeaderboard = async (req, res, next) => {
  try {
    const challenge = await ReadingChallenge.findById(req.params.id).lean();
    if (!challenge) return res.status(404).json({ message: "Challenge not found" });

    const participations = await ChallengeParticipation.find({ challenge: challenge._id })
      .populate("user", "first_name last_name username profile_picture")
      .lean();

    const entries = await Promise.all(
      participations.map(async (p) => {
        const progress = await computeProgress(p.user._id, challenge);
        return {
          user: p.user,
          joinedAt: p.joinedAt,
          status: p.status,
          ...progress,
        };
      })
    );

    const sortField =
      challenge.type === "pages" ? "pagesRead" :
      challenge.type === "minutes" ? "minutesRead" :
      challenge.type === "streak" ? "streak" : "reportsCount";

    entries.sort((a, b) => b[sortField] - a[sortField]);

    return res.status(200).json({ data: entries });
  } catch (err) {
    return next(err);
  }
};

// PATCH /challenges/:id/status - admin/moderator only
export const updateChallengeStatus = async (req, res, next) => {
  try {
    const currentUser = await User.findById(req.user._id).populate("role", "role plural").lean();
    const roleName = (currentUser?.role?.role || currentUser?.role?.plural || "").toLowerCase();
    const isSuperAdmin = /super\s*admin/i.test(roleName);
    const isModerator = /moderator/i.test(roleName);
    if (!isSuperAdmin && !isModerator) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { status } = req.body;
    const validStatuses = ["Draft", "Active", "Completed"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${validStatuses.join(", ")}` });
    }

    const challenge = await ReadingChallenge.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate("createdBy", "first_name last_name email");

    if (!challenge) return res.status(404).json({ message: "Challenge not found" });
    return res.status(200).json({ data: challenge });
  } catch (err) {
    return next(err);
  }
};

// GET /challenges/:id/my-progress
export const getMyProgress = async (req, res, next) => {
  try {
    const challenge = await ReadingChallenge.findById(req.params.id).lean();
    if (!challenge) return res.status(404).json({ message: "Challenge not found" });

    const participation = await ChallengeParticipation.findOne({
      challenge: challenge._id,
      user: req.user._id,
    }).lean();

    if (!participation) {
      return res.status(404).json({ message: "You are not participating in this challenge" });
    }

    const progress = await computeProgress(req.user._id, challenge);
    return res.status(200).json({ data: { ...participation, ...progress } });
  } catch (err) {
    return next(err);
  }
};
