import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";

import { sequelize, models } from "../config/database.js";

import RoleMongo from "../models/Role.js";
import PermissionCategoryMongo from "../models/PermissionCategory.js";
import PermissionMongo from "../models/Permissions.js";
import MemberMongo from "../models/Members.js";
import UserMongo from "../models/user.js";
import RolePermissionMongo from "../models/RolePermission.js";
import UserPermissionMongo from "../models/UserPermission.js";
import BookMongo from "../models/Books.js";
import IssueMongo from "../models/Issue.js";
import IssueRequestMongo from "../models/IssueRequest.js";
import ReservationMongo from "../models/Reservation.js";
import DailyReportMongo from "../models/DailyReport.js";
import ReadingChallengeMongo from "../models/ReadingChallenge.js";
import ChallengeParticipationMongo from "../models/ChallengeParticipation.js";
import AchievementMongo from "../models/Achievement.js";
import UserAchievementMongo from "../models/UserAchievement.js";
import ReadingGoalMongo from "../models/ReadingGoal.js";
import RefreshTokenMongo from "../models/RefreshToken.js";
import ClubreqMongo from "../models/Clubreq.js";
import MemberNoteMongo from "../models/MemberNote.js";
import ModeratorMemberMongo from "../models/ModeratorMember.js";
import NotificationMongo from "../models/Notification.js";
import NotificationPreferencesMongo from "../models/NotificationPreferences.js";
import BlogPostMongo from "../models/BlogPost.js";
import ResourceMongo from "../models/Resource.js";
import CommentMongo from "../models/Comments.js";
import StreakRestoreMongo from "../models/StreakRestore.js";
import AuditLogMongo from "../models/AuditLog.js";
import PushSubscriptionMongo from "../models/ushSubscription.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const mongoUri = process.env.MONGO_URI || process.env.Mongo_atlas;
if (!mongoUri) {
  throw new Error("Missing MONGO_URI/Mongo_atlas in backend/.env for migration source.");
}

const idMaps = {
  roles: new Map(),
  permissionCategories: new Map(),
  permissions: new Map(),
  rolePermissions: new Map(),
  userPermissions: new Map(),
  members: new Map(),
  users: new Map(),
  books: new Map(),
  issues: new Map(),
  issueRequests: new Map(),
  reservations: new Map(),
  dailyReports: new Map(),
  challenges: new Map(),
  challengeParticipations: new Map(),
  achievements: new Map(),
  userAchievements: new Map(),
  readingGoals: new Map(),
  refreshTokens: new Map(),
  clubreqs: new Map(),
  memberNotes: new Map(),
  moderatorMembers: new Map(),
  notifications: new Map(),
  notificationPreferences: new Map(),
  blogPosts: new Map(),
  resources: new Map(),
  comments: new Map(),
  commentReplies: new Map(),
  streakRestores: new Map(),
  auditLogs: new Map(),
  pushSubscriptions: new Map(),
};

const normalizeId = (id) => (id ? String(id) : null);
const remap = (map, id) => (id ? map.get(normalizeId(id)) || null : null);

async function copyCollection({
  sourceModel,
  targetModel,
  mapKey,
  transform,
  transaction,
}) {
  const docs = await sourceModel.find({}).lean();
  for (const doc of docs) {
    const payload = await transform(doc);
    const created = await targetModel.create(payload, { transaction });
    idMaps[mapKey].set(normalizeId(doc._id), created.id);
  }
  return docs.length;
}

async function migrate() {
  console.log("➡️  Connecting to MongoDB and MySQL...");
  await mongoose.connect(mongoUri);
  await sequelize.authenticate();
  console.log("✅ Connections established.");

  const tx = await sequelize.transaction();
  try {
    console.log("➡️  Syncing Sequelize schema...");
    await sequelize.sync({ alter: false, transaction: tx });

    console.log("➡️  Migrating core access-control entities...");
    await copyCollection({
      sourceModel: RoleMongo,
      targetModel: models.Role,
      mapKey: "roles",
      transaction: tx,
      transform: async (doc) => ({
        legacyObjectId: normalizeId(doc._id),
        role: doc.role,
        plural: doc.plural || "",
        color: doc.color || "#00000000",
        system: Boolean(doc.system),
      }),
    });
    await copyCollection({
      sourceModel: PermissionCategoryMongo,
      targetModel: models.PermissionCategory,
      mapKey: "permissionCategories",
      transaction: tx,
      transform: async (doc) => ({
        legacyObjectId: normalizeId(doc._id),
        name: doc.name,
        system: Boolean(doc.system),
      }),
    });
    await copyCollection({
      sourceModel: PermissionMongo,
      targetModel: models.Permission,
      mapKey: "permissions",
      transaction: tx,
      transform: async (doc) => ({
        legacyObjectId: normalizeId(doc._id),
        permission: doc.permission,
        groupedUnder: doc.grouped_under || null,
        subgroupString: doc.subgroup_string || null,
        system: Boolean(doc.system),
        categoryId: remap(idMaps.permissionCategories, doc.category),
      }),
    });

    console.log("➡️  Migrating members/users...");
    await copyCollection({
      sourceModel: MemberMongo,
      targetModel: models.Member,
      mapKey: "members",
      transaction: tx,
      transform: async (doc) => ({
        legacyObjectId: normalizeId(doc._id),
        firstName: doc.first_name,
        middleName: doc.middle_name || "",
        lastName: doc.last_name,
        code: doc.code,
        phone: doc.phone || "",
        email: doc.email || null,
        gender: doc.gender || "Male",
        region: doc.region || "",
        city: doc.city || "",
        status: doc.status || "Active",
        joinDate: doc.join_date || doc.createdAt || new Date(),
        profilePicture: doc.Profile_picture || "",
        isArchived: Boolean(doc.isArchived),
        department: doc.department || "",
        studentId: doc.student_id || "",
        studyYear: doc.study_year || "",
        roleId: remap(idMaps.roles, doc.role),
        createdAt: doc.createdAt || new Date(),
        updatedAt: doc.updatedAt || new Date(),
      }),
    });
    await copyCollection({
      sourceModel: UserMongo,
      targetModel: models.User,
      mapKey: "users",
      transaction: tx,
      transform: async (doc) => ({
        legacyObjectId: normalizeId(doc._id),
        firstName: doc.first_name,
        middleName: doc.middle_name || null,
        lastName: doc.last_name,
        username: doc.username,
        email: doc.email,
        password: doc.password,
        memberIdCode: doc.member_id || null,
        status: doc.status || "Active",
        bio: doc.Bio || null,
        profilePicture: doc.profile_picture || "",
        roleId: remap(idMaps.roles, doc.role),
        memberRefId: remap(idMaps.members, doc.member),
        addedById: null,
        updatedById: null,
        resetPasswordCode: doc.resetPasswordCode || null,
        resetPasswordExpires: doc.resetPasswordExpires || null,
        mustChangePassword: Boolean(doc.mustChangePassword),
        inviteToken: doc.inviteToken || null,
        inviteTokenExpires: doc.inviteTokenExpires || null,
        invitedById: null,
        invitedAt: doc.invitedAt || null,
        lastPasswordChange: doc.lastPasswordChange || null,
        passwordChangedCount: doc.passwordChangedCount || 0,
        createdAt: doc.createdAt || new Date(),
        updatedAt: doc.updatedAt || new Date(),
      }),
    });
    const users = await UserMongo.find({}).lean();
    for (const u of users) {
      await models.User.update(
        {
          addedById: remap(idMaps.users, u.added_by),
          updatedById: remap(idMaps.users, u.updated_by),
          invitedById: remap(idMaps.users, u.invitedBy),
        },
        { where: { id: remap(idMaps.users, u._id) }, transaction: tx }
      );
    }

    console.log("➡️  Migrating role/user permissions...");
    await copyCollection({
      sourceModel: RolePermissionMongo,
      targetModel: models.RolePermission,
      mapKey: "rolePermissions",
      transaction: tx,
      transform: async (doc) => ({
        legacyObjectId: normalizeId(doc._id),
        roleId: remap(idMaps.roles, doc.role),
        permissionId: remap(idMaps.permissions, doc.permission),
        system: Boolean(doc.system),
        addedById: remap(idMaps.users, doc.added_by),
      }),
    });
    await copyCollection({
      sourceModel: UserPermissionMongo,
      targetModel: models.UserPermission,
      mapKey: "userPermissions",
      transaction: tx,
      transform: async (doc) => ({
        legacyObjectId: normalizeId(doc._id),
        userId: remap(idMaps.users, doc.user),
        permissionId: remap(idMaps.permissions, doc.permission),
      }),
    });

    console.log("➡️  Migrating operational entities...");
    await copyCollection({
      sourceModel: BookMongo,
      targetModel: models.Book,
      mapKey: "books",
      transaction: tx,
      transform: async (doc) => ({
        legacyObjectId: normalizeId(doc._id),
        title: doc.title,
        author: doc.author || "",
        isbn: doc.isbn,
        bookType: doc.BookType || null,
        status: doc.status || "available",
        bookPicture: doc.book_picture || "",
        totalPages: doc.totalPages || 0,
        totalCopies: doc.totalCopies || 1,
        availableCopies: doc.availableCopies || 1,
        createdAt: doc.createdAt || new Date(),
        updatedAt: doc.updatedAt || new Date(),
      }),
    });
    await copyCollection({
      sourceModel: IssueMongo,
      targetModel: models.Issue,
      mapKey: "issues",
      transaction: tx,
      transform: async (doc) => ({
        legacyObjectId: normalizeId(doc._id),
        bookId: remap(idMaps.books, doc.book),
        memberId: remap(idMaps.members, doc.member),
        issueDate: doc.issueDate,
        returnDate: doc.returnDate,
        status: doc.status || "Issued",
        returnedAt: doc.returnedAt || null,
        createdAt: doc.createdAt || new Date(),
        updatedAt: doc.updatedAt || new Date(),
      }),
    });
    await copyCollection({
      sourceModel: IssueRequestMongo,
      targetModel: models.IssueRequest,
      mapKey: "issueRequests",
      transaction: tx,
      transform: async (doc) => ({
        legacyObjectId: normalizeId(doc._id),
        bookId: remap(idMaps.books, doc.book),
        memberId: remap(idMaps.members, doc.member),
        requestedById: remap(idMaps.users, doc.requestedBy),
        status: doc.status || "Requested",
        requestedDays: doc.requestedDays || 7,
        note: doc.note || null,
        reviewNote: doc.reviewNote || null,
        reviewedById: remap(idMaps.users, doc.reviewedBy),
        reviewedAt: doc.reviewedAt || null,
        issueId: remap(idMaps.issues, doc.issueId),
        createdAt: doc.createdAt || new Date(),
        updatedAt: doc.updatedAt || new Date(),
      }),
    });
    await copyCollection({
      sourceModel: ReservationMongo,
      targetModel: models.Reservation,
      mapKey: "reservations",
      transaction: tx,
      transform: async (doc) => ({
        legacyObjectId: normalizeId(doc._id),
        bookId: remap(idMaps.books, doc.book),
        memberId: remap(idMaps.members, doc.member),
        createdById: remap(idMaps.users, doc.createdBy),
        status: doc.status || "Active",
        notifiedAt: doc.notifiedAt || null,
        createdAt: doc.createdAt || new Date(),
        updatedAt: doc.updatedAt || new Date(),
      }),
    });
    await copyCollection({
      sourceModel: DailyReportMongo,
      targetModel: models.DailyReport,
      mapKey: "dailyReports",
      transaction: tx,
      transform: async (doc) => ({
        legacyObjectId: normalizeId(doc._id),
        createdById: remap(idMaps.users, doc.createdBy),
        bookId: remap(idMaps.books, doc.book),
        readingDate: doc.readingDate,
        pagesFrom: doc.pagesFrom,
        pagesTo: doc.pagesTo,
        timeSpent: doc.timeSpent,
        summary: doc.summary,
        rating: doc.rating,
        status: doc.status || "Pending",
        createdAt: doc.createdAt || new Date(),
        updatedAt: doc.updatedAt || new Date(),
      }),
    });

    console.log("➡️  Migrating challenge and goals domain...");
    await copyCollection({
      sourceModel: ReadingChallengeMongo,
      targetModel: models.ReadingChallenge,
      mapKey: "challenges",
      transaction: tx,
      transform: async (doc) => ({
        legacyObjectId: normalizeId(doc._id),
        title: doc.title,
        description: doc.description || "",
        bookId: remap(idMaps.books, doc.book),
        winnerId: remap(idMaps.users, doc.winner),
        completedAt: doc.completedAt || null,
        completionReason: doc.completionReason || null,
        type: doc.type,
        startDate: doc.startDate,
        endDate: doc.endDate,
        minPagesPerDay: doc.rules?.minPagesPerDay || 0,
        minMinutesPerDay: doc.rules?.minMinutesPerDay || 0,
        requiredConsecutiveDays: doc.rules?.requiredConsecutiveDays || 0,
        targetTotal: doc.rules?.targetTotal || 0,
        status: doc.status || "Active",
        createdById: remap(idMaps.users, doc.createdBy),
        createdAt: doc.createdAt || new Date(),
        updatedAt: doc.updatedAt || new Date(),
      }),
    });
    await copyCollection({
      sourceModel: ChallengeParticipationMongo,
      targetModel: models.ChallengeParticipation,
      mapKey: "challengeParticipations",
      transaction: tx,
      transform: async (doc) => ({
        legacyObjectId: normalizeId(doc._id),
        challengeId: remap(idMaps.challenges, doc.challenge),
        userId: remap(idMaps.users, doc.user),
        pagesRead: doc.pagesRead || 0,
        minutesRead: doc.minutesRead || 0,
        reportsCount: doc.reportsCount || 0,
        currentStreak: doc.currentStreak || 0,
        longestStreak: doc.longestStreak || 0,
        joinedAt: doc.joinedAt || doc.createdAt || new Date(),
        completedAt: doc.completedAt || null,
        status: doc.status || "Active",
        createdAt: doc.createdAt || new Date(),
        updatedAt: doc.updatedAt || new Date(),
      }),
    });
    await copyCollection({
      sourceModel: AchievementMongo,
      targetModel: models.Achievement,
      mapKey: "achievements",
      transaction: tx,
      transform: async (doc) => ({
        legacyObjectId: normalizeId(doc._id),
        code: doc.code,
        title: doc.title,
        description: doc.description || "",
        icon: doc.icon || "🏆",
        unlockType: doc.unlockRules?.type || null,
        unlockThreshold: doc.unlockRules?.threshold || 1,
        createdAt: doc.createdAt || new Date(),
        updatedAt: doc.updatedAt || new Date(),
      }),
    });
    await copyCollection({
      sourceModel: UserAchievementMongo,
      targetModel: models.UserAchievement,
      mapKey: "userAchievements",
      transaction: tx,
      transform: async (doc) => ({
        legacyObjectId: normalizeId(doc._id),
        userId: remap(idMaps.users, doc.user),
        achievementCode: doc.achievementCode,
        unlockedAt: doc.unlockedAt || doc.createdAt || new Date(),
        createdAt: doc.createdAt || new Date(),
        updatedAt: doc.updatedAt || new Date(),
      }),
    });
    await copyCollection({
      sourceModel: ReadingGoalMongo,
      targetModel: models.ReadingGoal,
      mapKey: "readingGoals",
      transaction: tx,
      transform: async (doc) => ({
        legacyObjectId: normalizeId(doc._id),
        userId: remap(idMaps.users, doc.user),
        goalType: doc.goalType,
        targetValue: doc.targetValue,
        startDate: doc.startDate,
        endDate: doc.endDate || null,
        status: doc.status || "Active",
        completedAt: doc.completedAt || null,
        completionNotifiedAt: doc.completionNotifiedAt || null,
        createdAt: doc.createdAt || new Date(),
        updatedAt: doc.updatedAt || new Date(),
      }),
    });
    await copyCollection({
      sourceModel: RefreshTokenMongo,
      targetModel: models.RefreshToken,
      mapKey: "refreshTokens",
      transaction: tx,
      transform: async (doc) => ({
        legacyObjectId: normalizeId(doc._id),
        tokenHash: doc.tokenHash,
        userId: remap(idMaps.users, doc.user),
        expiresAt: doc.expiresAt,
        revoked: Boolean(doc.revoked),
        replacedByTokenHash: doc.replacedByTokenHash || null,
        ip: doc.ip || null,
        userAgent: doc.userAgent || null,
        createdAt: doc.createdAt || new Date(),
      }),
    });

    console.log("➡️  Migrating moderation/communication/content...");
    await copyCollection({
      sourceModel: ClubreqMongo,
      targetModel: models.Clubreq,
      mapKey: "clubreqs",
      transaction: tx,
      transform: async (doc) => ({
        legacyObjectId: normalizeId(doc._id),
        fullName: doc.FullName,
        email: doc.email,
        phone: doc.phone,
        status: doc.status || "Pending",
        rejectionReason: doc.rejectionReason || "",
        memberId: remap(idMaps.members, doc.memberId),
        reviewedById: remap(idMaps.users, doc.reviewedBy),
        reviewedAt: doc.reviewedAt || null,
        createdAt: doc.createdAt || new Date(),
        updatedAt: doc.updatedAt || new Date(),
      }),
    });
    await copyCollection({
      sourceModel: MemberNoteMongo,
      targetModel: models.MemberNote,
      mapKey: "memberNotes",
      transaction: tx,
      transform: async (doc) => ({
        legacyObjectId: normalizeId(doc._id),
        memberId: remap(idMaps.members, doc.member),
        authorId: remap(idMaps.users, doc.author),
        note: doc.note,
        category: doc.category || "",
        isArchived: Boolean(doc.isArchived),
        createdAt: doc.createdAt || new Date(),
        updatedAt: doc.updatedAt || new Date(),
      }),
    });
    await copyCollection({
      sourceModel: ModeratorMemberMongo,
      targetModel: models.ModeratorMember,
      mapKey: "moderatorMembers",
      transaction: tx,
      transform: async (doc) => ({
        legacyObjectId: normalizeId(doc._id),
        moderatorId: remap(idMaps.users, doc.moderator),
        memberId: remap(idMaps.members, doc.member),
        createdAt: doc.createdAt || new Date(),
        updatedAt: doc.updatedAt || new Date(),
      }),
    });
    await copyCollection({
      sourceModel: NotificationMongo,
      targetModel: models.Notification,
      mapKey: "notifications",
      transaction: tx,
      transform: async (doc) => ({
        legacyObjectId: normalizeId(doc._id),
        userId: remap(idMaps.users, doc.user),
        title: doc.title,
        message: doc.message,
        type: doc.type || "info",
        category: doc.category || "system",
        read: Boolean(doc.read),
        meta: doc.meta || {},
        expiresAt: doc.expiresAt || null,
        createdAt: doc.createdAt || new Date(),
        updatedAt: doc.updatedAt || new Date(),
      }),
    });
    await copyCollection({
      sourceModel: NotificationPreferencesMongo,
      targetModel: models.NotificationPreference,
      mapKey: "notificationPreferences",
      transaction: tx,
      transform: async (doc) => ({
        legacyObjectId: normalizeId(doc._id),
        userId: remap(idMaps.users, doc.user),
        pushOnOverdue: Boolean(doc.pushOnOverdue),
        pushOnDueTomorrow: Boolean(doc.pushOnDueTomorrow),
        pushOnStreakReminder: Boolean(doc.pushOnStreakReminder),
        pushOnBlogAnnouncement: Boolean(doc.pushOnBlogAnnouncement),
        pushOnJoinRequestUpdate: Boolean(doc.pushOnJoinRequestUpdate),
        pushOnChallengeReminder: Boolean(doc.pushOnChallengeReminder),
        pushOnAchievementUnlock: Boolean(doc.pushOnAchievementUnlock),
        pushOnGoalProgress: Boolean(doc.pushOnGoalProgress),
        pushOnSystemAnnouncement: Boolean(doc.pushOnSystemAnnouncement),
        emailOnOverdue: Boolean(doc.emailOnOverdue),
        emailOnDueTomorrow: Boolean(doc.emailOnDueTomorrow),
        emailOnWeeklyDigest: Boolean(doc.emailOnWeeklyDigest),
        emailOnJoinRequestUpdate: Boolean(doc.emailOnJoinRequestUpdate),
        emailOnGoalProgress: Boolean(doc.emailOnGoalProgress),
        emailOnAnnouncement: Boolean(doc.emailOnAnnouncement),
        quietHoursEnabled: Boolean(doc.quietHoursEnabled),
        quietHoursStart: doc.quietHoursStart || "22:00",
        quietHoursEnd: doc.quietHoursEnd || "08:00",
        createdAt: doc.createdAt || new Date(),
        updatedAt: doc.updatedAt || new Date(),
      }),
    });
    const blogDocs = await BlogPostMongo.find({}).lean();
    for (const doc of blogDocs) {
      const created = await models.BlogPost.create({
        legacyObjectId: normalizeId(doc._id),
        title: doc.title,
        content: doc.content,
        author: doc.author,
        createdById: remap(idMaps.users, doc.created_by),
        authorName: doc.author_name || "",
        authorPicture: doc.author_picture || "",
        relatedBook: doc.relatedBook || "",
        status: doc.status || "Draft",
        likes: doc.likes || 0,
        views: doc.views || 0,
        blogPicture: doc.blog_picture || "",
        isFeatured: Boolean(doc.isFeatured),
        isPinned: Boolean(doc.isPinned),
        isEditorsPick: Boolean(doc.isEditorsPick),
        displayOrder: doc.displayOrder || 0,
        slug: doc.slug || null,
        seoTitle: doc.seoTitle || null,
        seoDescription: doc.seoDescription || null,
        socialImage: doc.socialImage || "",
        canonicalUrl: doc.canonicalUrl || "",
        publishAt: doc.publishAt || null,
        publishedAt: doc.publishedAt || null,
        createdAt: doc.createdAt || new Date(),
        updatedAt: doc.updatedAt || new Date(),
      }, { transaction: tx });
      idMaps.blogPosts.set(normalizeId(doc._id), created.id);
      if (Array.isArray(doc.tags)) {
        for (const tag of doc.tags) {
          await models.BlogPostTag.create({ postId: created.id, tag }, { transaction: tx });
        }
      }
    }
    for (const doc of blogDocs) {
      const postId = remap(idMaps.blogPosts, doc._id);
      if (!postId || !Array.isArray(doc.relatedPosts)) continue;
      for (const related of doc.relatedPosts) {
        const relatedPostId = remap(idMaps.blogPosts, related);
        if (!relatedPostId) continue;
        await models.BlogPostRelation.create({ postId, relatedPostId }, { transaction: tx });
      }
    }

    const resourceDocs = await ResourceMongo.find({}).lean();
    for (const doc of resourceDocs) {
      const created = await models.Resource.create({
        legacyObjectId: normalizeId(doc._id),
        title: doc.title,
        description: doc.description || "",
        content: doc.content || "",
        type: doc.type,
        fileUrl: doc.fileUrl || "",
        fileName: doc.fileName || "",
        fileType: doc.fileType || "",
        fileSize: doc.fileSize || 0,
        eventDate: doc.eventDate || null,
        eventLocation: doc.eventLocation || "",
        coverImage: doc.coverImage || "",
        createdById: remap(idMaps.users, doc.created_by),
        authorName: doc.author_name || "",
        status: doc.status || "Draft",
        isFeatured: Boolean(doc.isFeatured),
        isPinned: Boolean(doc.isPinned),
        displayOrder: doc.displayOrder || 0,
        slug: doc.slug || null,
        seoTitle: doc.seoTitle || "",
        seoDescription: doc.seoDescription || "",
        category: doc.category || "",
        views: doc.views || 0,
        downloads: doc.downloads || 0,
        publishAt: doc.publishAt || null,
        publishedAt: doc.publishedAt || null,
        createdAt: doc.createdAt || new Date(),
        updatedAt: doc.updatedAt || new Date(),
      }, { transaction: tx });
      idMaps.resources.set(normalizeId(doc._id), created.id);
      if (Array.isArray(doc.tags)) {
        for (const tag of doc.tags) {
          await models.ResourceTag.create({ resourceId: created.id, tag }, { transaction: tx });
        }
      }
    }
    for (const doc of resourceDocs) {
      const resourceId = remap(idMaps.resources, doc._id);
      if (!resourceId) continue;
      if (Array.isArray(doc.relatedResources)) {
        for (const rel of doc.relatedResources) {
          const relatedResourceId = remap(idMaps.resources, rel);
          if (!relatedResourceId) continue;
          await models.ResourceRelation.create({ resourceId, relatedResourceId }, { transaction: tx });
        }
      }
      if (Array.isArray(doc.relatedPosts)) {
        for (const post of doc.relatedPosts) {
          const blogPostId = remap(idMaps.blogPosts, post);
          if (!blogPostId) continue;
          await models.ResourcePostRelation.create({ resourceId, blogPostId }, { transaction: tx });
        }
      }
    }

    const comments = await CommentMongo.find({}).lean();
    for (const doc of comments) {
      const created = await models.Comment.create({
        legacyObjectId: normalizeId(doc._id),
        postId: remap(idMaps.blogPosts, doc.postId),
        content: doc.content,
        authorUserId: remap(idMaps.users, doc.author?.userId),
        authorName: doc.author?.name || "Unknown",
        authorAvatar: doc.author?.avatar || "",
        authorRole: doc.author?.role || "Member",
        likes: doc.likes || 0,
        isPinned: Boolean(doc.isPinned),
        isBestInsight: Boolean(doc.isBestInsight),
        status: doc.status || "approved",
        moderatedById: remap(idMaps.users, doc.moderatedBy),
        moderatedAt: doc.moderatedAt || null,
        moderationNote: doc.moderationNote || "",
        createdAt: doc.createdAt || new Date(),
        updatedAt: doc.updatedAt || new Date(),
      }, { transaction: tx });
      idMaps.comments.set(normalizeId(doc._id), created.id);

      if (Array.isArray(doc.likedBy)) {
        for (const likedBy of doc.likedBy) {
          const userId = remap(idMaps.users, likedBy);
          if (!userId) continue;
          await models.CommentLike.create({ commentId: created.id, userId }, { transaction: tx });
        }
      }
      if (Array.isArray(doc.reports)) {
        for (const report of doc.reports) {
          const reportedById = remap(idMaps.users, report.reportedBy);
          if (!reportedById) continue;
          await models.CommentReport.create({
            commentId: created.id,
            reportedById,
            reason: report.reason,
            details: report.details || "",
            createdAt: report.createdAt || new Date(),
            updatedAt: report.updatedAt || new Date(),
          }, { transaction: tx });
        }
      }
      if (Array.isArray(doc.replies)) {
        for (const reply of doc.replies) {
          const replyCreated = await models.CommentReply.create({
            legacyObjectId: normalizeId(reply._id),
            commentId: created.id,
            content: reply.content,
            authorUserId: remap(idMaps.users, reply.author?.userId),
            authorName: reply.author?.name || "Unknown",
            authorAvatar: reply.author?.avatar || "",
            authorRole: reply.author?.role || "Member",
            likes: reply.likes || 0,
            status: reply.status || "approved",
            createdAt: reply.createdAt || new Date(),
            updatedAt: reply.updatedAt || new Date(),
          }, { transaction: tx });
          idMaps.commentReplies.set(normalizeId(reply._id), replyCreated.id);
          if (Array.isArray(reply.reports)) {
            for (const rr of reply.reports) {
              const reportedById = remap(idMaps.users, rr.reportedBy);
              if (!reportedById) continue;
              await models.CommentReplyReport.create({
                replyId: replyCreated.id,
                reportedById,
                reason: rr.reason,
                details: rr.details || "",
                createdAt: rr.createdAt || new Date(),
                updatedAt: rr.updatedAt || new Date(),
              }, { transaction: tx });
            }
          }
        }
      }
    }

    await copyCollection({
      sourceModel: StreakRestoreMongo,
      targetModel: models.StreakRestore,
      mapKey: "streakRestores",
      transaction: tx,
      transform: async (doc) => ({
        legacyObjectId: normalizeId(doc._id),
        userId: remap(idMaps.users, doc.user),
        month: doc.month,
        count: doc.count || 0,
        restoredForDate: doc.restoredForDate || null,
        createdAt: doc.createdAt || new Date(),
        updatedAt: doc.updatedAt || new Date(),
      }),
    });
    await copyCollection({
      sourceModel: AuditLogMongo,
      targetModel: models.AuditLog,
      mapKey: "auditLogs",
      transaction: tx,
      transform: async (doc) => ({
        legacyObjectId: normalizeId(doc._id),
        userId: remap(idMaps.users, doc.user),
        userEmail: doc.userEmail || null,
        userName: doc.userName || null,
        userRole: doc.userRole || null,
        action: doc.action,
        entityType: doc.entityType || null,
        entityId: remap(idMaps.users, doc.entityId) || null,
        entityLabel: doc.entityLabel || null,
        changes: doc.changes || null,
        meta: doc.meta || null,
        ipAddress: doc.ipAddress || null,
        userAgent: doc.userAgent || null,
        createdAt: doc.createdAt || new Date(),
        updatedAt: doc.updatedAt || new Date(),
      }),
    });
    await copyCollection({
      sourceModel: PushSubscriptionMongo,
      targetModel: models.PushSubscription,
      mapKey: "pushSubscriptions",
      transaction: tx,
      transform: async (doc) => ({
        legacyObjectId: normalizeId(doc._id),
        userId: remap(idMaps.users, doc.user),
        endpoint: doc.subscription?.endpoint || "",
        p256dh: doc.subscription?.keys?.p256dh || "",
        auth: doc.subscription?.keys?.auth || "",
        createdAt: doc.createdAt || new Date(),
        updatedAt: doc.updatedAt || new Date(),
      }),
    });

    await tx.commit();
    console.log("✅ MongoDB → MySQL migration completed successfully.");
  } catch (error) {
    await tx.rollback();
    console.error("❌ Migration failed. Transaction rolled back.", error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    await sequelize.close();
  }
}

migrate();
