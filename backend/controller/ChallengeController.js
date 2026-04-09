import User from "../models/user.js";
import { Op, fn, col } from "sequelize";
import DailyReport from "../models/DailyReport.js";
import ReadingChallenge from "../models/ReadingChallenge.js";
import ChallengeParticipation from "../models/ChallengeParticipation.js";
import ModeratorMember from "../models/ModeratorMember.js";
import Book from "../models/Books.js";
import Role from "../models/Role.js";
import { calcLongestStreak, calcPagesRead } from "../utility/streakUtils.js";

function getChallengeBookId(challenge) {
  return challenge?.book?.id || challenge?.book_id || challenge?.book || null;
}

function roundMetric(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function getChallengeTargetValue(challenge) {
  const explicitTarget = Number(challenge?.rules?.targetTotal || 0);
  if (explicitTarget > 0) return explicitTarget;

  if (challenge?.type === "pages") {
    const bookPages = Number(challenge?.book?.totalPages || challenge?.book_total_pages || 0);
    if (bookPages > 0) return bookPages;
  }

  if (challenge?.type === "streak") {
    const consecutiveDays = Number(challenge?.rules?.requiredConsecutiveDays || 0);
    if (consecutiveDays > 0) return consecutiveDays;
  }

  return 0;
}

function getProgressValue(progress, challenge) {
  if (!progress) return 0;
  switch (challenge?.type) {
    case "pages":
      return progress.pagesRead ?? 0;
    case "minutes":
      return progress.minutesRead ?? 0;
    case "streak":
      return progress.streak ?? 0;
    default:
      return progress.reportsCount ?? 0;
  }
}

function getMetricValueForReport(report, challenge) {
  switch (challenge?.type) {
    case "pages":
      return calcPagesRead(report);
    case "minutes":
      return Number(report.timeSpent || 0);
    case "reports":
      return 1;
    default:
      return 0;
  }
}

function findCompletionAt(reports, challenge, targetValue) {
  if (!targetValue || !Array.isArray(reports) || reports.length === 0) return null;

  const orderedReports = [...reports].sort((a, b) => {
    const dateDiff = new Date(a.readingDate).getTime() - new Date(b.readingDate).getTime();
    if (dateDiff !== 0) return dateDiff;
    return new Date(a.createdAt || a.readingDate).getTime() - new Date(b.createdAt || b.readingDate).getTime();
  });

  if (challenge?.type === "streak") {
    const uniqueDates = [
      ...new Set(orderedReports.map((r) => new Date(r.readingDate).toISOString().slice(0, 10))),
    ].sort();

    let currentStreak = 0;
    let previousDate = null;

    for (const isoDate of uniqueDates) {
      const currentDate = new Date(`${isoDate}T00:00:00.000Z`);
      if (!previousDate) currentStreak = 1;
      else {
        const diffDays = Math.round((currentDate.getTime() - previousDate.getTime()) / 86400000);
        currentStreak = diffDays === 1 ? currentStreak + 1 : 1;
      }

      if (currentStreak >= targetValue) return currentDate;
      previousDate = currentDate;
    }

    return null;
  }

  let runningTotal = 0;
  for (const report of orderedReports) {
    runningTotal += getMetricValueForReport(report, challenge);
    if (runningTotal >= targetValue) return new Date(report.createdAt || report.readingDate);
  }

  return null;
}

async function computeProgress(userId, challenge) {
  const where = {
    createdBy: userId,
    readingDate: { [Op.gte]: challenge.startDate, [Op.lte]: challenge.endDate },
    status: "Approved",
  };

  const challengeBookId = getChallengeBookId(challenge);
  if (challengeBookId) where.book = challengeBookId;

  const reports = await DailyReport.findAll({
    where,
    include: [{ model: Book, as: "bookRef", attributes: ["id", "title", "author", "isbn", "totalPages"], required: false }],
    order: [["readingDate", "DESC"]],
  });

  const pagesRead = reports.reduce((sum, r) => sum + calcPagesRead(r), 0);
  const minutesRead = reports.reduce((sum, r) => sum + Number(r.timeSpent || 0), 0);
  const reportsCount = reports.length;
  const streak = calcLongestStreak(reports.map((r) => r.readingDate));

  const reportDays = new Set(
    reports
      .map((r) => (r.readingDate ? new Date(r.readingDate).toISOString().slice(0, 10) : null))
      .filter(Boolean)
  );

  const uniqueBooks = new Set(
    reports
      .map((r) => String(r.bookRef?.id || r.book || ""))
      .filter(Boolean)
  );

  const averagePagesPerDay = reportDays.size ? roundMetric(pagesRead / reportDays.size) : 0;
  const averageMinutesPerDay = reportDays.size ? roundMetric(minutesRead / reportDays.size) : 0;
  const averagePagesPerReport = reportsCount ? roundMetric(pagesRead / reportsCount) : 0;
  const targetValue = getChallengeTargetValue(challenge);
  const completionAt = findCompletionAt(reports, challenge, targetValue);

  return {
    pagesRead,
    minutesRead,
    reportsCount,
    streak,
    booksCount: uniqueBooks.size,
    activeDays: reportDays.size,
    averagePagesPerDay,
    averageMinutesPerDay,
    averagePagesPerReport,
    lastReportDate: reports[0]?.readingDate || null,
    targetValue,
    completionAt,
  };
}

async function syncChallengeState(challenge) {
  if (!challenge) return challenge;

  const challengeObject = challenge.toJSON ? challenge.toJSON() : { ...challenge };
  const now = new Date();

  const participations = await ChallengeParticipation.findAll({
    where: { challenge_id: challengeObject.id },
    attributes: ["id", "user_id", "joinedAt"],
  });

  const participantProgress = await Promise.all(
    participations.map(async (participation) => ({
      participation,
      progress: await computeProgress(participation.user_id, challengeObject),
    }))
  );

  const finishers = participantProgress
    .filter((entry) => Boolean(entry.progress.completionAt))
    .sort((a, b) => {
      const t = new Date(a.progress.completionAt).getTime() - new Date(b.progress.completionAt).getTime();
      if (t !== 0) return t;
      return new Date(a.participation.joinedAt).getTime() - new Date(b.participation.joinedAt).getTime();
    });

  let shouldComplete = challengeObject.status !== "Completed";
  let completionReason = challengeObject.completionReason || null;
  let completedAt = challengeObject.completedAt || null;
  let winnerId = challengeObject.winner_id || null;

  if (finishers.length > 0) {
    completionReason = "target_reached";
    completedAt = finishers[0].progress.completionAt;
    winnerId = finishers[0].participation.user_id;
  } else if (now > new Date(challengeObject.endDate)) {
    completionReason = "date_ended";
    completedAt = completedAt || challengeObject.endDate;

    const ranked = [...participantProgress].sort((a, b) => {
      const progressDiff = getProgressValue(b.progress, challengeObject) - getProgressValue(a.progress, challengeObject);
      if (progressDiff !== 0) return progressDiff;
      const activeDaysDiff = (b.progress.activeDays || 0) - (a.progress.activeDays || 0);
      if (activeDaysDiff !== 0) return activeDaysDiff;
      return new Date(a.participation.joinedAt).getTime() - new Date(b.participation.joinedAt).getTime();
    });

    winnerId = ranked[0]?.participation?.user_id || winnerId || null;
  } else {
    shouldComplete = false;
  }

  if (!shouldComplete) return challengeObject;

  await ReadingChallenge.update(
    {
      status: "Completed",
      winner_id: winnerId || null,
      completedAt: completedAt || now,
      completionReason,
    },
    { where: { id: challengeObject.id } }
  );

  const updatedChallenge = await ReadingChallenge.findByPk(challengeObject.id, {
    include: [
      { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name", "username", "email", "profile_picture"], required: false },
      { model: Book, as: "book", attributes: ["id", "title", "author", "isbn", "totalPages"], required: false },
      { model: User, as: "winner", attributes: ["id", "first_name", "last_name", "username", "email", "profile_picture"], required: false },
    ],
  });

  return updatedChallenge ? updatedChallenge.toJSON() : challengeObject;
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
  const currentUser = await User.findByPk(userId, {
    attributes: ["id", "first_name", "last_name", "username", "email", "profile_picture", "role_id", "member_id"],
    include: [{ model: Role, as: "role", attributes: ["role", "plural"], required: false }],
  });

  if (!currentUser) return null;

  const { roleName, isSuperAdmin, isModerator } = getRoleFlags(currentUser?.role?.role || currentUser?.role?.plural || "");

  let assignedModeratorId = null;
  if (!isSuperAdmin && !isModerator && currentUser.member_id) {
    const assignment = await ModeratorMember.findOne({
      where: { member_id: currentUser.member_id },
      attributes: ["moderator_id"],
    });
    assignedModeratorId = assignment?.moderator_id ? String(assignment.moderator_id) : null;
  }

  return { currentUser, roleName, isSuperAdmin, isModerator, assignedModeratorId };
}

function buildChallengeAccessFilter(accessContext, extraFilter = {}) {
  if (!accessContext) return { ...extraFilter, id: null };
  if (accessContext.isSuperAdmin) return { ...extraFilter };
  if (accessContext.isModerator) return { ...extraFilter, createdBy: accessContext.currentUser.id };
  if (accessContext.assignedModeratorId) return { ...extraFilter, createdBy: accessContext.assignedModeratorId };
  return { ...extraFilter, id: null };
}

async function getParticipantCounts(challengeIds = []) {
  if (!challengeIds.length) return {};

  const rows = await ChallengeParticipation.findAll({
    where: { challenge_id: { [Op.in]: challengeIds } },
    attributes: ["challenge_id", [fn("COUNT", col("id")), "count"]],
    group: ["challenge_id"],
    raw: true,
  });

  return rows.reduce((acc, row) => {
    acc[String(row.challenge_id)] = Number(row.count || 0);
    return acc;
  }, {});
}

function withParticipantCount(challenge, participantCounts = {}) {
  const c = challenge?.toJSON ? challenge.toJSON() : challenge;
  return {
    ...c,
    participantCount: participantCounts[String(c.id)] || 0,
  };
}

// POST /challenges
export const createChallenge = async (req, res, next) => {
  try {
    const accessContext = await getChallengeAccessContext(req.user.id);
    const { currentUser, isSuperAdmin, isModerator } = accessContext || {};

    if (!isSuperAdmin && !isModerator) return res.status(403).json({ message: "Access denied" });

    const { title, type, startDate, endDate, description, rules, status, bookId } = req.body;
    if (!title || !type || !startDate || !endDate) {
      return res.status(400).json({ message: "title, type, startDate, and endDate are required" });
    }
    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ message: "startDate must be before endDate" });
    }

    let selectedBook = null;
    if (bookId) {
      if (!Number.isInteger(Number(bookId))) {
        return res.status(400).json({ message: "Invalid bookId" });
      }
      selectedBook = await Book.findByPk(Number(bookId), {
        attributes: ["id", "title", "author", "isbn", "totalPages"],
      });
      if (!selectedBook) return res.status(404).json({ message: "Selected book not found" });
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
      status: status || "Active",
      book_id: selectedBook?.id || null,
      createdBy: currentUser.id,
    });

    const createdChallenge = await ReadingChallenge.findByPk(challenge.id, {
      include: [
        { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name", "username", "email", "profile_picture"], required: false },
        { model: Book, as: "book", attributes: ["id", "title", "author", "isbn", "totalPages"], required: false },
        { model: User, as: "winner", attributes: ["id", "first_name", "last_name", "username", "email", "profile_picture"], required: false },
      ],
    });

    return res.status(201).json({ data: { ...(createdChallenge?.toJSON?.() || challenge.toJSON()), participantCount: 0 } });
  } catch (err) {
    return next(err);
  }
};

// GET /challenges
export const getChallenges = async (req, res, next) => {
  try {
    const accessContext = await getChallengeAccessContext(req.user.id);
    const { status, page = 1, limit = 20 } = req.query;
    const where = buildChallengeAccessFilter(accessContext);
    if (status) where.status = status;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const perPage = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * perPage;

    const { rows, count: total } = await ReadingChallenge.findAndCountAll({
      where,
      include: [
        { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name", "username", "email", "profile_picture"], required: false },
        { model: Book, as: "book", attributes: ["id", "title", "author", "isbn", "totalPages"], required: false },
        { model: User, as: "winner", attributes: ["id", "first_name", "last_name", "username", "email", "profile_picture"], required: false },
      ],
      order: [["startDate", "DESC"]],
      offset,
      limit: perPage,
    });

    const syncedItems = await Promise.all(rows.map((item) => syncChallengeState(item)));
    const challengeIds = syncedItems.map((item) => item.id);

    const [participantCounts, joinedRows] = await Promise.all([
      getParticipantCounts(challengeIds),
      challengeIds.length
        ? ChallengeParticipation.findAll({
            where: { challenge_id: { [Op.in]: challengeIds }, user_id: req.user.id },
            attributes: ["challenge_id"],
            raw: true,
          })
        : [],
    ]);

    const joinedChallengeIds = new Set(joinedRows.map((row) => String(row.challenge_id)));
    const data = syncedItems.map((item) => ({
      ...withParticipantCount(item, participantCounts),
      targetValue: getChallengeTargetValue(item),
      isJoined: joinedChallengeIds.has(String(item.id)),
    }));

    return res.status(200).json({
      data,
      total,
      page: pageNum,
      limit: perPage,
      totalPages: Math.ceil(total / perPage),
    });
  } catch (err) {
    return next(err);
  }
};

// GET /challenges/:id
export const getChallengeById = async (req, res, next) => {
  try {
    const accessContext = await getChallengeAccessContext(req.user.id);
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid challenge id" });

    const challenge = await ReadingChallenge.findOne({
      where: buildChallengeAccessFilter(accessContext, { id }),
      include: [
        { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name", "username", "email", "profile_picture"], required: false },
        { model: Book, as: "book", attributes: ["id", "title", "author", "isbn", "totalPages"], required: false },
        { model: User, as: "winner", attributes: ["id", "first_name", "last_name", "username", "email", "profile_picture"], required: false },
      ],
    });

    if (!challenge) return res.status(404).json({ message: "Challenge not found" });

    const syncedChallenge = await syncChallengeState(challenge);

    const [participantCounts, participation] = await Promise.all([
      getParticipantCounts([syncedChallenge.id]),
      ChallengeParticipation.findOne({
        where: { challenge_id: syncedChallenge.id, user_id: req.user.id },
        attributes: ["id"],
      }),
    ]);

    return res.status(200).json({
      data: {
        ...withParticipantCount(syncedChallenge, participantCounts),
        targetValue: getChallengeTargetValue(syncedChallenge),
        isJoined: Boolean(participation),
      },
    });
  } catch (err) {
    return next(err);
  }
};

// POST /challenges/:id/join
export const joinChallenge = async (req, res, next) => {
  try {
    const accessContext = await getChallengeAccessContext(req.user.id);
    if (!accessContext) return res.status(401).json({ message: "Unauthorized" });
    if (accessContext.isModerator || accessContext.isSuperAdmin) {
      return res.status(403).json({ message: "Only members can join challenges" });
    }

    const challenge = await ReadingChallenge.findOne({
      where: buildChallengeAccessFilter(accessContext, { id: Number(req.params.id) }),
    });

    if (!challenge) return res.status(404).json({ message: "Challenge not found" });
    if (challenge.status !== "Active") return res.status(400).json({ message: "Challenge is not active" });

    const existing = await ChallengeParticipation.findOne({
      where: { challenge_id: challenge.id, user_id: req.user.id },
    });
    if (existing) return res.status(409).json({ message: "Already participating in this challenge" });

    const participation = await ChallengeParticipation.create({
      challenge_id: challenge.id,
      user_id: req.user.id,
    });

    return res.status(201).json({ data: participation });
  } catch (err) {
    return next(err);
  }
};

// GET /challenges/:id/leaderboard
export const getChallengeLeaderboard = async (req, res, next) => {
  try {
    const accessContext = await getChallengeAccessContext(req.user.id);

    const challenge = await ReadingChallenge.findOne({
      where: buildChallengeAccessFilter(accessContext, { id: Number(req.params.id) }),
    });
    if (!challenge) return res.status(404).json({ message: "Challenge not found" });

    const syncedChallenge = await syncChallengeState(challenge);

    const participations = await ChallengeParticipation.findAll({
      where: { challenge_id: syncedChallenge.id },
      include: [{ model: User, as: "user", attributes: ["id", "first_name", "last_name", "username", "profile_picture"] }],
    });

    const entries = await Promise.all(
      participations.map(async (p) => {
        const progress = await computeProgress(p.user_id, syncedChallenge);
        return {
          user: p.user,
          joinedAt: p.joinedAt,
          status: p.status,
          ...progress,
        };
      })
    );

    const sortField =
      syncedChallenge.type === "pages"
        ? "pagesRead"
        : syncedChallenge.type === "minutes"
        ? "minutesRead"
        : syncedChallenge.type === "streak"
        ? "streak"
        : "reportsCount";

    entries.sort((a, b) => Number(b[sortField] || 0) - Number(a[sortField] || 0));

    return res.status(200).json({ data: entries });
  } catch (err) {
    return next(err);
  }
};

// PATCH /challenges/:id/status
export const updateChallengeStatus = async (req, res, next) => {
  try {
    const accessContext = await getChallengeAccessContext(req.user.id);
    const { isSuperAdmin, isModerator } = accessContext || {};

    if (!isSuperAdmin && !isModerator) return res.status(403).json({ message: "Access denied" });

    const { status } = req.body;
    const validStatuses = ["Draft", "Active", "Completed"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${validStatuses.join(", ")}` });
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid challenge id" });

    const where = buildChallengeAccessFilter(accessContext, { id });

    const challenge = await ReadingChallenge.findOne({ where });
    if (!challenge) return res.status(404).json({ message: "Challenge not found" });

    await challenge.update({ status });

    const reloaded = await ReadingChallenge.findByPk(challenge.id, {
      include: [
        { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name", "username", "email", "profile_picture"], required: false },
        { model: Book, as: "book", attributes: ["id", "title", "author", "isbn", "totalPages"], required: false },
        { model: User, as: "winner", attributes: ["id", "first_name", "last_name", "username", "email", "profile_picture"], required: false },
      ],
    });

    const participantCounts = await getParticipantCounts([challenge.id]);

    return res.status(200).json({
      data: {
        ...withParticipantCount(reloaded || challenge, participantCounts),
        targetValue: getChallengeTargetValue(reloaded || challenge),
      },
    });
  } catch (err) {
    return next(err);
  }
};

// GET /challenges/:id/my-progress
export const getMyProgress = async (req, res, next) => {
  try {
    const accessContext = await getChallengeAccessContext(req.user.id);

    const challenge = await ReadingChallenge.findOne({
      where: buildChallengeAccessFilter(accessContext, { id: Number(req.params.id) }),
    });

    if (!challenge) return res.status(404).json({ message: "Challenge not found" });

    const syncedChallenge = await syncChallengeState(challenge);

    const participation = await ChallengeParticipation.findOne({
      where: { challenge_id: syncedChallenge.id, user_id: req.user.id },
    });

    if (!participation) {
      return res.status(404).json({ message: "You are not participating in this challenge" });
    }

    const progress = await computeProgress(req.user.id, syncedChallenge);

    return res.status(200).json({
      data: {
        ...(participation.toJSON ? participation.toJSON() : participation),
        ...progress,
      },
    });
  } catch (err) {
    return next(err);
  }
};

export default {
  createChallenge,
  getChallenges,
  getChallengeById,
  joinChallenge,
  getChallengeLeaderboard,
  updateChallengeStatus,
  getMyProgress,
};