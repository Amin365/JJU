import User from "../models/user.js";
import DailyReport from "../models/DailyReport.js";
import ReadingChallenge from "../models/ReadingChallenge.js";
import ChallengeParticipation from "../models/ChallengeParticipation.js";
import ModeratorMember from "../models/ModeratorMember.js";
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

function getRoleFlags(roleName = "") {
  const normalizedRole = String(roleName || "").toLowerCase();
  return {
    roleName: normalizedRole,
    isSuperAdmin: /super\s*admin/i.test(normalizedRole),
    isModerator: /moderator/i.test(normalizedRole),
  };
}

async function getChallengeAccessContext(userId) {
  const currentUser = await User.findById(userId)
    .select("_id first_name last_name username email profile_picture role member")
    .populate("role", "role plural")
    .lean();

  if (!currentUser) return null;

  const { roleName, isSuperAdmin, isModerator } = getRoleFlags(
    currentUser?.role?.role || currentUser?.role?.plural || ""
  );

  let assignedModeratorId = null;

  if (!isSuperAdmin && !isModerator && currentUser.member) {
    const assignment = await ModeratorMember.findOne({ member: currentUser.member })
      .select("moderator")
      .lean();

    assignedModeratorId = assignment?.moderator ? String(assignment.moderator) : null;
  }

  return {
    currentUser,
    roleName,
    isSuperAdmin,
    isModerator,
    assignedModeratorId,
  };
}

function buildChallengeAccessFilter(accessContext, extraFilter = {}) {
  if (!accessContext) {
    return { ...extraFilter, _id: null };
  }

  if (accessContext.isSuperAdmin) {
    return { ...extraFilter };
  }

  if (accessContext.isModerator) {
    return { ...extraFilter, createdBy: accessContext.currentUser._id };
  }

  if (accessContext.assignedModeratorId) {
    return { ...extraFilter, createdBy: accessContext.assignedModeratorId };
  }

  return { ...extraFilter, _id: null };
}

async function getParticipantCounts(challengeIds = []) {
  if (!challengeIds.length) return {};

  const rows = await ChallengeParticipation.aggregate([
    { $match: { challenge: { $in: challengeIds } } },
    { $group: { _id: "$challenge", count: { $sum: 1 } } },
  ]);

  return rows.reduce((acc, row) => {
    acc[String(row._id)] = row.count;
    return acc;
  }, {});
}

function withParticipantCount(challenge, participantCounts = {}) {
  return {
    ...challenge,
    participantCount: participantCounts[String(challenge._id)] || 0,
  };
}

// POST /challenges - admin/moderator only
export const createChallenge = async (req, res, next) => {
  try {
    const accessContext = await getChallengeAccessContext(req.user._id);
    const { currentUser, isSuperAdmin, isModerator } = accessContext || {};

    if (!isSuperAdmin && !isModerator) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { title, type, startDate, endDate, description, rules, status } = req.body;
    if (!title || !type || !startDate || !endDate) {
      return res.status(400).json({ message: "title, type, startDate, and endDate are required" });
    }

    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ message: "startDate must be before endDate" });
    }

    const normalizedRules = {
      minPagesPerDay: Number(rules?.minPagesPerDay || 0),
      minMinutesPerDay: Number(rules?.minMinutesPerDay || 0),
      requiredConsecutiveDays: Number(rules?.requiredConsecutiveDays || 0),
      targetTotal: Number(rules?.targetTotal || 0),
    };

    const challenge = await ReadingChallenge.create({
      title,
      type,
      startDate,
      endDate,
      description,
      rules: normalizedRules,
      status: status || "Draft",
      createdBy: currentUser._id,
    });

    const createdChallenge = await ReadingChallenge.findById(challenge._id)
      .populate("createdBy", "first_name last_name username email profile_picture")
      .lean();

    return res.status(201).json({ data: { ...createdChallenge, participantCount: 0 } });
  } catch (err) {
    return next(err);
  }
};

// GET /challenges
export const getChallenges = async (req, res, next) => {
  try {
    const accessContext = await getChallengeAccessContext(req.user._id);
    const { status, page = 1, limit = 20 } = req.query;
    const filter = buildChallengeAccessFilter(accessContext);
    if (status) filter.status = status;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * perPage;

    const [items, total] = await Promise.all([
      ReadingChallenge.find(filter)
        .populate("createdBy", "first_name last_name username email profile_picture")
        .sort({ startDate: -1 })
        .skip(skip)
        .limit(perPage)
        .lean(),
      ReadingChallenge.countDocuments(filter),
    ]);

    const participantCounts = await getParticipantCounts(items.map((item) => item._id));
    const data = items.map((item) => withParticipantCount(item, participantCounts));

    return res.status(200).json({ data, total, page: pageNum, limit: perPage, totalPages: Math.ceil(total / perPage) });
  } catch (err) {
    return next(err);
  }
};

// GET /challenges/:id
export const getChallengeById = async (req, res, next) => {
  try {
    const accessContext = await getChallengeAccessContext(req.user._id);
    const challenge = await ReadingChallenge.findOne(
      buildChallengeAccessFilter(accessContext, { _id: req.params.id })
    )
      .populate("createdBy", "first_name last_name username email profile_picture")
      .lean();
    if (!challenge) return res.status(404).json({ message: "Challenge not found" });

    const participantCounts = await getParticipantCounts([challenge._id]);

    return res.status(200).json({ data: withParticipantCount(challenge, participantCounts) });
  } catch (err) {
    return next(err);
  }
};

// POST /challenges/:id/join
export const joinChallenge = async (req, res, next) => {
  try {
    const accessContext = await getChallengeAccessContext(req.user._id);

    if (!accessContext) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (accessContext.isModerator || accessContext.isSuperAdmin) {
      return res.status(403).json({ message: "Only members can join challenges" });
    }

    const challenge = await ReadingChallenge.findOne(
      buildChallengeAccessFilter(accessContext, { _id: req.params.id })
    ).lean();

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
    const accessContext = await getChallengeAccessContext(req.user._id);
    const challenge = await ReadingChallenge.findOne(
      buildChallengeAccessFilter(accessContext, { _id: req.params.id })
    ).lean();
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
    const accessContext = await getChallengeAccessContext(req.user._id);
    const { isSuperAdmin, isModerator } = accessContext || {};

    if (!isSuperAdmin && !isModerator) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { status } = req.body;
    const validStatuses = ["Draft", "Active", "Completed"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${validStatuses.join(", ")}` });
    }

    const challenge = await ReadingChallenge.findOneAndUpdate(
      buildChallengeAccessFilter(accessContext, { _id: req.params.id }),
      { status },
      { new: true }
    ).populate("createdBy", "first_name last_name username email profile_picture");

    if (!challenge) return res.status(404).json({ message: "Challenge not found" });

    const participantCounts = await getParticipantCounts([challenge._id]);
    return res.status(200).json({ data: withParticipantCount(challenge.toObject(), participantCounts) });
  } catch (err) {
    return next(err);
  }
};

// GET /challenges/:id/my-progress
export const getMyProgress = async (req, res, next) => {
  try {
    const accessContext = await getChallengeAccessContext(req.user._id);
    const challenge = await ReadingChallenge.findOne(
      buildChallengeAccessFilter(accessContext, { _id: req.params.id })
    ).lean();
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
