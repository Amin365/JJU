import bcrypt from "bcryptjs";
import { DataTypes } from "sequelize";

export default function initSchema(sequelize) {
  const commonId = {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    legacyObjectId: { type: DataTypes.STRING(24), allowNull: true, unique: true, field: "legacy_object_id" },
  };

  const Role = sequelize.define(
    "Role",
    {
      ...commonId,
      role: { type: DataTypes.STRING, allowNull: false, unique: true },
      plural: { type: DataTypes.STRING, defaultValue: "" },
      color: { type: DataTypes.STRING(10), defaultValue: "#00000000" },
      system: { type: DataTypes.BOOLEAN, defaultValue: false },
    },
    { tableName: "roles", timestamps: false, underscored: true }
  );

  const PermissionCategory = sequelize.define(
    "PermissionCategory",
    {
      ...commonId,
      name: { type: DataTypes.STRING, allowNull: false, unique: true },
      system: { type: DataTypes.BOOLEAN, defaultValue: false },
    },
    { tableName: "permission_categories", timestamps: false, underscored: true }
  );

  const Permission = sequelize.define(
    "Permission",
    {
      ...commonId,
      permission: { type: DataTypes.STRING, allowNull: false, unique: true },
      groupedUnder: { type: DataTypes.STRING, allowNull: true, field: "grouped_under" },
      subgroupString: { type: DataTypes.STRING, allowNull: true, field: "subgroup_string" },
      system: { type: DataTypes.BOOLEAN, defaultValue: false },
      categoryId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: "category_id" },
    },
    { tableName: "permissions", timestamps: false, underscored: true }
  );

  const Member = sequelize.define(
    "Member",
    {
      ...commonId,
      firstName: { type: DataTypes.STRING, allowNull: false, field: "first_name" },
      middleName: { type: DataTypes.STRING, defaultValue: "", field: "middle_name" },
      lastName: { type: DataTypes.STRING, allowNull: false, field: "last_name" },
      code: { type: DataTypes.STRING, allowNull: false, unique: true },
      phone: { type: DataTypes.STRING, defaultValue: "" },
      email: { type: DataTypes.STRING, allowNull: true, unique: true },
      gender: { type: DataTypes.ENUM("Male", "Female"), defaultValue: "Male" },
      region: { type: DataTypes.STRING, defaultValue: "" },
      city: { type: DataTypes.STRING, defaultValue: "" },
      status: { type: DataTypes.ENUM("Active", "Inactive", "pending"), defaultValue: "Active" },
      joinDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: "join_date" },
      profilePicture: { type: DataTypes.STRING, defaultValue: "", field: "profile_picture" },
      isArchived: { type: DataTypes.BOOLEAN, defaultValue: false, field: "is_archived" },
      department: { type: DataTypes.STRING, defaultValue: "" },
      studentId: { type: DataTypes.STRING, defaultValue: "", field: "student_id" },
      studyYear: { type: DataTypes.ENUM("", "1", "2", "3", "4", "5"), defaultValue: "", field: "study_year" },
      roleId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: "role_id" },
    },
    {
      tableName: "members",
      timestamps: true,
      underscored: true,
      hooks: {
        beforeValidate(instance) {
          if (!instance.code) {
            const t = Date.now().toString();
            const rnd = Math.random().toString(36).slice(2, 4).toUpperCase();
            instance.code = `MBR${t.slice(-6)}${rnd}`;
          }
          if (typeof instance.email === "string") instance.email = instance.email.trim().toLowerCase();
        },
      },
    }
  );

  const User = sequelize.define(
    "User",
    {
      ...commonId,
      firstName: { type: DataTypes.STRING, allowNull: false, field: "first_name" },
      middleName: { type: DataTypes.STRING, allowNull: true, field: "middle_name" },
      lastName: { type: DataTypes.STRING, allowNull: false, field: "last_name" },
      username: { type: DataTypes.STRING, allowNull: false, unique: true },
      email: { type: DataTypes.STRING, allowNull: false, unique: true },
      password: { type: DataTypes.STRING, allowNull: false },
      memberIdCode: { type: DataTypes.STRING, allowNull: true, unique: true, field: "member_id" },
      status: { type: DataTypes.ENUM("Active", "Inactive", "pending"), defaultValue: "Active" },
      bio: { type: DataTypes.TEXT, allowNull: true, field: "bio" },
      profilePicture: { type: DataTypes.STRING, defaultValue: "", field: "profile_picture" },
      roleId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: "role_id" },
      memberRefId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true, field: "member_ref_id" },
      addedById: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: "added_by_id" },
      updatedById: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: "updated_by_id" },
      resetPasswordCode: { type: DataTypes.STRING, allowNull: true, field: "reset_password_code" },
      resetPasswordExpires: { type: DataTypes.DATE, allowNull: true, field: "reset_password_expires" },
      mustChangePassword: { type: DataTypes.BOOLEAN, defaultValue: false, field: "must_change_password" },
      inviteToken: { type: DataTypes.STRING, allowNull: true, field: "invite_token" },
      inviteTokenExpires: { type: DataTypes.DATE, allowNull: true, field: "invite_token_expires" },
      invitedById: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: "invited_by_id" },
      invitedAt: { type: DataTypes.DATE, allowNull: true, field: "invited_at" },
      lastPasswordChange: { type: DataTypes.DATE, allowNull: true, field: "last_password_change" },
      passwordChangedCount: { type: DataTypes.INTEGER, defaultValue: 0, field: "password_changed_count" },
    },
    {
      tableName: "users",
      timestamps: true,
      underscored: true,
      defaultScope: { attributes: { exclude: ["password"] } },
      scopes: { withPassword: {} },
      hooks: {
        async beforeSave(instance) {
          if (instance.changed("password") && instance.password && !instance.password.startsWith("$2")) {
            const salt = await bcrypt.genSalt(10);
            instance.password = await bcrypt.hash(instance.password, salt);
          }
          if (instance.changed("password")) {
            instance.lastPasswordChange = new Date();
            if (!instance.isNewRecord) {
              instance.passwordChangedCount = (instance.passwordChangedCount || 0) + 1;
            }
          }
        },
      },
    }
  );
  User.prototype.matchPassword = async function matchPassword(enteredPassword) {
    return bcrypt.compare(enteredPassword, this.password);
  };

  const RolePermission = sequelize.define(
    "RolePermission",
    {
      ...commonId,
      roleId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "role_id" },
      permissionId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "permission_id" },
      system: { type: DataTypes.BOOLEAN, defaultValue: false },
      addedById: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: "added_by_id" },
    },
    { tableName: "role_permissions", timestamps: false, underscored: true, indexes: [{ unique: true, fields: ["role_id", "permission_id"] }] }
  );

  const UserPermission = sequelize.define(
    "UserPermission",
    {
      ...commonId,
      userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "user_id" },
      permissionId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "permission_id" },
    },
    { tableName: "user_permissions", timestamps: false, underscored: true, indexes: [{ unique: true, fields: ["user_id", "permission_id"] }] }
  );

  const Book = sequelize.define("Book", {
    ...commonId,
    title: { type: DataTypes.STRING, allowNull: false },
    author: { type: DataTypes.STRING, defaultValue: "" },
    isbn: { type: DataTypes.STRING, allowNull: false, unique: true },
    bookType: { type: DataTypes.STRING, allowNull: true, field: "book_type" },
    status: { type: DataTypes.ENUM("available", "borrowed", "lost", "damaged", "archived"), defaultValue: "available" },
    bookPicture: { type: DataTypes.STRING, defaultValue: "", field: "book_picture" },
    totalPages: { type: DataTypes.INTEGER, defaultValue: 0, field: "total_pages" },
    totalCopies: { type: DataTypes.INTEGER, defaultValue: 1, field: "total_copies" },
    availableCopies: { type: DataTypes.INTEGER, defaultValue: 1, field: "available_copies" },
  }, { tableName: "books", timestamps: true, underscored: true });

  const Issue = sequelize.define("Issue", {
    ...commonId,
    bookId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "book_id" },
    memberId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "member_id" },
    issueDate: { type: DataTypes.DATE, allowNull: false, field: "issue_date" },
    returnDate: { type: DataTypes.DATE, allowNull: false, field: "return_date" },
    status: { type: DataTypes.ENUM("Issued", "Returned", "Overdue"), defaultValue: "Issued" },
    returnedAt: { type: DataTypes.DATE, allowNull: true, field: "returned_at" },
  }, { tableName: "issues", timestamps: true, underscored: true });

  const IssueRequest = sequelize.define("IssueRequest", {
    ...commonId,
    bookId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "book_id" },
    memberId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "member_id" },
    requestedById: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: "requested_by_id" },
    status: { type: DataTypes.ENUM("Requested", "Approved", "Rejected", "Issued", "Cancelled"), defaultValue: "Requested" },
    requestedDays: { type: DataTypes.INTEGER, defaultValue: 7, field: "requested_days" },
    note: { type: DataTypes.TEXT, allowNull: true },
    reviewNote: { type: DataTypes.TEXT, allowNull: true, field: "review_note" },
    reviewedById: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: "reviewed_by_id" },
    reviewedAt: { type: DataTypes.DATE, allowNull: true, field: "reviewed_at" },
    issueId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: "issue_id" },
  }, { tableName: "issue_requests", timestamps: true, underscored: true });

  const Reservation = sequelize.define("Reservation", {
    ...commonId,
    bookId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "book_id" },
    memberId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "member_id" },
    createdById: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: "created_by_id" },
    status: { type: DataTypes.ENUM("Active", "Fulfilled", "Cancelled", "Expired"), defaultValue: "Active" },
    notifiedAt: { type: DataTypes.DATE, allowNull: true, field: "notified_at" },
  }, { tableName: "reservations", timestamps: true, underscored: true });

  const DailyReport = sequelize.define("DailyReport", {
    ...commonId,
    createdById: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "created_by_id" },
    bookId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "book_id" },
    readingDate: { type: DataTypes.DATEONLY, allowNull: false, field: "reading_date" },
    pagesFrom: { type: DataTypes.INTEGER, allowNull: false, field: "pages_from" },
    pagesTo: { type: DataTypes.INTEGER, allowNull: false, field: "pages_to" },
    timeSpent: { type: DataTypes.INTEGER, allowNull: false, field: "time_spent" },
    summary: { type: DataTypes.TEXT, allowNull: false },
    rating: { type: DataTypes.INTEGER, allowNull: false },
    status: { type: DataTypes.ENUM("Pending", "Approved", "Needs Improvement"), defaultValue: "Pending" },
  }, { tableName: "daily_reports", timestamps: true, underscored: true, indexes: [{ unique: true, fields: ["created_by_id", "book_id", "reading_date"] }] });

  const ReadingChallenge = sequelize.define("ReadingChallenge", {
    ...commonId,
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, defaultValue: "" },
    bookId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: "book_id" },
    winnerId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: "winner_id" },
    completedAt: { type: DataTypes.DATE, allowNull: true, field: "completed_at" },
    completionReason: { type: DataTypes.ENUM("target_reached", "date_ended"), allowNull: true, field: "completion_reason" },
    type: { type: DataTypes.ENUM("streak", "pages", "minutes", "reports"), allowNull: false },
    startDate: { type: DataTypes.DATE, allowNull: false, field: "start_date" },
    endDate: { type: DataTypes.DATE, allowNull: false, field: "end_date" },
    minPagesPerDay: { type: DataTypes.INTEGER, defaultValue: 0, field: "min_pages_per_day" },
    minMinutesPerDay: { type: DataTypes.INTEGER, defaultValue: 0, field: "min_minutes_per_day" },
    requiredConsecutiveDays: { type: DataTypes.INTEGER, defaultValue: 0, field: "required_consecutive_days" },
    targetTotal: { type: DataTypes.INTEGER, defaultValue: 0, field: "target_total" },
    status: { type: DataTypes.ENUM("Draft", "Active", "Completed"), defaultValue: "Active" },
    createdById: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "created_by_id" },
  }, { tableName: "reading_challenges", timestamps: true, underscored: true });

  const ChallengeParticipation = sequelize.define("ChallengeParticipation", {
    ...commonId,
    challengeId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "challenge_id" },
    userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "user_id" },
    pagesRead: { type: DataTypes.INTEGER, defaultValue: 0, field: "pages_read" },
    minutesRead: { type: DataTypes.INTEGER, defaultValue: 0, field: "minutes_read" },
    reportsCount: { type: DataTypes.INTEGER, defaultValue: 0, field: "reports_count" },
    currentStreak: { type: DataTypes.INTEGER, defaultValue: 0, field: "current_streak" },
    longestStreak: { type: DataTypes.INTEGER, defaultValue: 0, field: "longest_streak" },
    joinedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: "joined_at" },
    completedAt: { type: DataTypes.DATE, allowNull: true, field: "completed_at" },
    status: { type: DataTypes.ENUM("Active", "Completed", "Dropped"), defaultValue: "Active" },
  }, { tableName: "challenge_participations", timestamps: true, underscored: true, indexes: [{ unique: true, fields: ["challenge_id", "user_id"] }] });

  const Achievement = sequelize.define("Achievement", {
    ...commonId,
    code: { type: DataTypes.STRING, allowNull: false, unique: true },
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, defaultValue: "" },
    icon: { type: DataTypes.STRING, defaultValue: "🏆" },
    unlockType: { type: DataTypes.ENUM("first_report", "streak", "reports_count", "pages_count"), allowNull: true, field: "unlock_type" },
    unlockThreshold: { type: DataTypes.INTEGER, defaultValue: 1, field: "unlock_threshold" },
  }, { tableName: "achievements", timestamps: true, underscored: true });

  const UserAchievement = sequelize.define("UserAchievement", {
    ...commonId,
    userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "user_id" },
    achievementCode: { type: DataTypes.STRING, allowNull: false, field: "achievement_code" },
    unlockedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW, field: "unlocked_at" },
  }, { tableName: "user_achievements", timestamps: true, underscored: true, indexes: [{ unique: true, fields: ["user_id", "achievement_code"] }] });

  const ReadingGoal = sequelize.define("ReadingGoal", {
    ...commonId,
    userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "user_id" },
    goalType: { type: DataTypes.ENUM("pages_per_day", "minutes_per_day", "reports_per_week"), allowNull: false, field: "goal_type" },
    targetValue: { type: DataTypes.INTEGER, allowNull: false, field: "target_value" },
    startDate: { type: DataTypes.DATE, allowNull: false, field: "start_date" },
    endDate: { type: DataTypes.DATE, allowNull: true, field: "end_date" },
    status: { type: DataTypes.ENUM("Active", "Completed", "Expired"), defaultValue: "Active" },
    completedAt: { type: DataTypes.DATE, allowNull: true, field: "completed_at" },
    completionNotifiedAt: { type: DataTypes.DATE, allowNull: true, field: "completion_notified_at" },
  }, { tableName: "reading_goals", timestamps: true, underscored: true });

  const RefreshToken = sequelize.define("RefreshToken", {
    ...commonId,
    tokenHash: { type: DataTypes.STRING, allowNull: false, unique: true, field: "token_hash" },
    userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "user_id" },
    expiresAt: { type: DataTypes.DATE, allowNull: false, field: "expires_at" },
    revoked: { type: DataTypes.BOOLEAN, defaultValue: false },
    replacedByTokenHash: { type: DataTypes.STRING, allowNull: true, field: "replaced_by_token_hash" },
    ip: { type: DataTypes.STRING, allowNull: true },
    userAgent: { type: DataTypes.STRING, allowNull: true, field: "user_agent" },
  }, { tableName: "refresh_tokens", timestamps: true, createdAt: "created_at", updatedAt: false, underscored: true });

  const Clubreq = sequelize.define("Clubreq", {
    ...commonId,
    fullName: { type: DataTypes.STRING, allowNull: false, field: "full_name" },
    email: { type: DataTypes.STRING, allowNull: false },
    phone: { type: DataTypes.STRING, allowNull: false },
    status: { type: DataTypes.ENUM("Pending", "Approved", "Rejected"), defaultValue: "Pending" },
    rejectionReason: { type: DataTypes.TEXT, defaultValue: "", field: "rejection_reason" },
    memberId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: "member_id" },
    reviewedById: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: "reviewed_by_id" },
    reviewedAt: { type: DataTypes.DATE, allowNull: true, field: "reviewed_at" },
  }, { tableName: "club_requests", timestamps: true, underscored: true });

  const MemberNote = sequelize.define("MemberNote", {
    ...commonId,
    memberId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "member_id" },
    authorId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "author_id" },
    note: { type: DataTypes.TEXT, allowNull: false },
    category: { type: DataTypes.STRING, defaultValue: "" },
    isArchived: { type: DataTypes.BOOLEAN, defaultValue: false, field: "is_archived" },
  }, { tableName: "member_notes", timestamps: true, underscored: true });

  const ModeratorMember = sequelize.define("ModeratorMember", {
    ...commonId,
    moderatorId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "moderator_id" },
    memberId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true, field: "member_id" },
  }, { tableName: "moderator_members", timestamps: true, underscored: true });

  const Notification = sequelize.define("Notification", {
    ...commonId,
    userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "user_id" },
    title: { type: DataTypes.STRING, allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    type: { type: DataTypes.ENUM("info", "success", "warning", "error", "approval", "reminder", "announcement"), defaultValue: "info" },
    category: { type: DataTypes.ENUM("system", "issue", "report", "challenge", "achievement", "goal", "blog", "join", "announcement", "other"), defaultValue: "system" },
    read: { type: DataTypes.BOOLEAN, defaultValue: false },
    meta: { type: DataTypes.JSON, defaultValue: {} },
    expiresAt: { type: DataTypes.DATE, allowNull: true, field: "expires_at" },
  }, { tableName: "notifications", timestamps: true, underscored: true });

  const NotificationPreference = sequelize.define("NotificationPreference", {
    ...commonId,
    userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, unique: true, field: "user_id" },
    pushOnOverdue: { type: DataTypes.BOOLEAN, defaultValue: true, field: "push_on_overdue" },
    pushOnDueTomorrow: { type: DataTypes.BOOLEAN, defaultValue: true, field: "push_on_due_tomorrow" },
    pushOnStreakReminder: { type: DataTypes.BOOLEAN, defaultValue: true, field: "push_on_streak_reminder" },
    pushOnBlogAnnouncement: { type: DataTypes.BOOLEAN, defaultValue: true, field: "push_on_blog_announcement" },
    pushOnJoinRequestUpdate: { type: DataTypes.BOOLEAN, defaultValue: true, field: "push_on_join_request_update" },
    pushOnChallengeReminder: { type: DataTypes.BOOLEAN, defaultValue: true, field: "push_on_challenge_reminder" },
    pushOnAchievementUnlock: { type: DataTypes.BOOLEAN, defaultValue: true, field: "push_on_achievement_unlock" },
    pushOnGoalProgress: { type: DataTypes.BOOLEAN, defaultValue: true, field: "push_on_goal_progress" },
    pushOnSystemAnnouncement: { type: DataTypes.BOOLEAN, defaultValue: true, field: "push_on_system_announcement" },
    emailOnOverdue: { type: DataTypes.BOOLEAN, defaultValue: true, field: "email_on_overdue" },
    emailOnDueTomorrow: { type: DataTypes.BOOLEAN, defaultValue: false, field: "email_on_due_tomorrow" },
    emailOnWeeklyDigest: { type: DataTypes.BOOLEAN, defaultValue: true, field: "email_on_weekly_digest" },
    emailOnJoinRequestUpdate: { type: DataTypes.BOOLEAN, defaultValue: true, field: "email_on_join_request_update" },
    emailOnGoalProgress: { type: DataTypes.BOOLEAN, defaultValue: true, field: "email_on_goal_progress" },
    emailOnAnnouncement: { type: DataTypes.BOOLEAN, defaultValue: true, field: "email_on_announcement" },
    quietHoursEnabled: { type: DataTypes.BOOLEAN, defaultValue: false, field: "quiet_hours_enabled" },
    quietHoursStart: { type: DataTypes.STRING, defaultValue: "22:00", field: "quiet_hours_start" },
    quietHoursEnd: { type: DataTypes.STRING, defaultValue: "08:00", field: "quiet_hours_end" },
  }, { tableName: "notification_preferences", timestamps: true, underscored: true });

  const BlogPost = sequelize.define("BlogPost", {
    ...commonId,
    title: { type: DataTypes.STRING, allowNull: false },
    content: { type: DataTypes.TEXT("long"), allowNull: false },
    author: { type: DataTypes.STRING, allowNull: false },
    createdById: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: "created_by_id" },
    authorName: { type: DataTypes.STRING, defaultValue: "", field: "author_name" },
    authorPicture: { type: DataTypes.STRING, defaultValue: "", field: "author_picture" },
    relatedBook: { type: DataTypes.STRING, defaultValue: "", field: "related_book" },
    status: { type: DataTypes.ENUM("Draft", "Published", "Scheduled"), defaultValue: "Draft" },
    likes: { type: DataTypes.INTEGER, defaultValue: 0 },
    views: { type: DataTypes.INTEGER, defaultValue: 0 },
    blogPicture: { type: DataTypes.STRING, defaultValue: "", field: "blog_picture" },
    isFeatured: { type: DataTypes.BOOLEAN, defaultValue: false, field: "is_featured" },
    isPinned: { type: DataTypes.BOOLEAN, defaultValue: false, field: "is_pinned" },
    isEditorsPick: { type: DataTypes.BOOLEAN, defaultValue: false, field: "is_editors_pick" },
    displayOrder: { type: DataTypes.INTEGER, defaultValue: 0, field: "display_order" },
    slug: { type: DataTypes.STRING, unique: true, allowNull: true },
    seoTitle: { type: DataTypes.STRING(70), allowNull: true, field: "seo_title" },
    seoDescription: { type: DataTypes.STRING(160), allowNull: true, field: "seo_description" },
    socialImage: { type: DataTypes.STRING, defaultValue: "", field: "social_image" },
    canonicalUrl: { type: DataTypes.STRING, defaultValue: "", field: "canonical_url" },
    publishAt: { type: DataTypes.DATE, allowNull: true, field: "publish_at" },
    publishedAt: { type: DataTypes.DATE, allowNull: true, field: "published_at" },
  }, { tableName: "blog_posts", timestamps: true, underscored: true });

  const BlogPostTag = sequelize.define("BlogPostTag", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    postId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "post_id" },
    tag: { type: DataTypes.STRING, allowNull: false },
  }, { tableName: "blog_post_tags", timestamps: false, underscored: true });

  const BlogPostRelation = sequelize.define("BlogPostRelation", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    postId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "post_id" },
    relatedPostId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "related_post_id" },
  }, { tableName: "blog_post_relations", timestamps: false, underscored: true });

  const Resource = sequelize.define("Resource", {
    ...commonId,
    title: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, defaultValue: "" },
    content: { type: DataTypes.TEXT("long"), defaultValue: "" },
    type: { type: DataTypes.ENUM("guide", "announcement", "event-recap", "download"), allowNull: false },
    fileUrl: { type: DataTypes.STRING, defaultValue: "", field: "file_url" },
    fileName: { type: DataTypes.STRING, defaultValue: "", field: "file_name" },
    fileType: { type: DataTypes.STRING, defaultValue: "", field: "file_type" },
    fileSize: { type: DataTypes.INTEGER, defaultValue: 0, field: "file_size" },
    eventDate: { type: DataTypes.DATE, allowNull: true, field: "event_date" },
    eventLocation: { type: DataTypes.STRING, defaultValue: "", field: "event_location" },
    coverImage: { type: DataTypes.STRING, defaultValue: "", field: "cover_image" },
    createdById: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "created_by_id" },
    authorName: { type: DataTypes.STRING, defaultValue: "", field: "author_name" },
    status: { type: DataTypes.ENUM("Draft", "Published", "Archived"), defaultValue: "Draft" },
    isFeatured: { type: DataTypes.BOOLEAN, defaultValue: false, field: "is_featured" },
    isPinned: { type: DataTypes.BOOLEAN, defaultValue: false, field: "is_pinned" },
    displayOrder: { type: DataTypes.INTEGER, defaultValue: 0, field: "display_order" },
    slug: { type: DataTypes.STRING, unique: true, allowNull: true },
    seoTitle: { type: DataTypes.STRING(70), defaultValue: "", field: "seo_title" },
    seoDescription: { type: DataTypes.STRING(160), defaultValue: "", field: "seo_description" },
    category: { type: DataTypes.STRING, defaultValue: "" },
    views: { type: DataTypes.INTEGER, defaultValue: 0 },
    downloads: { type: DataTypes.INTEGER, defaultValue: 0 },
    publishAt: { type: DataTypes.DATE, allowNull: true, field: "publish_at" },
    publishedAt: { type: DataTypes.DATE, allowNull: true, field: "published_at" },
  }, { tableName: "resources", timestamps: true, underscored: true });

  const ResourceTag = sequelize.define("ResourceTag", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    resourceId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "resource_id" },
    tag: { type: DataTypes.STRING, allowNull: false },
  }, { tableName: "resource_tags", timestamps: false, underscored: true });

  const ResourceRelation = sequelize.define("ResourceRelation", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    resourceId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "resource_id" },
    relatedResourceId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "related_resource_id" },
  }, { tableName: "resource_relations", timestamps: false, underscored: true });

  const ResourcePostRelation = sequelize.define("ResourcePostRelation", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    resourceId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "resource_id" },
    blogPostId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "blog_post_id" },
  }, { tableName: "resource_post_relations", timestamps: false, underscored: true });

  const Comment = sequelize.define("Comment", {
    ...commonId,
    postId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "post_id" },
    content: { type: DataTypes.TEXT, allowNull: false },
    authorUserId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "author_user_id" },
    authorName: { type: DataTypes.STRING, allowNull: false, field: "author_name" },
    authorAvatar: { type: DataTypes.STRING, defaultValue: "", field: "author_avatar" },
    authorRole: { type: DataTypes.ENUM("Member", "Moderator"), defaultValue: "Member", field: "author_role" },
    likes: { type: DataTypes.INTEGER, defaultValue: 0 },
    isPinned: { type: DataTypes.BOOLEAN, defaultValue: false, field: "is_pinned" },
    isBestInsight: { type: DataTypes.BOOLEAN, defaultValue: false, field: "is_best_insight" },
    status: { type: DataTypes.ENUM("approved", "pending", "hidden", "deleted"), defaultValue: "approved" },
    moderatedById: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: "moderated_by_id" },
    moderatedAt: { type: DataTypes.DATE, allowNull: true, field: "moderated_at" },
    moderationNote: { type: DataTypes.TEXT, defaultValue: "", field: "moderation_note" },
  }, { tableName: "comments", timestamps: true, underscored: true });

  const CommentLike = sequelize.define("CommentLike", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    commentId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "comment_id" },
    userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "user_id" },
  }, { tableName: "comment_likes", timestamps: false, underscored: true });

  const CommentReply = sequelize.define("CommentReply", {
    ...commonId,
    commentId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "comment_id" },
    content: { type: DataTypes.TEXT, allowNull: false },
    authorUserId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "author_user_id" },
    authorName: { type: DataTypes.STRING, allowNull: false, field: "author_name" },
    authorAvatar: { type: DataTypes.STRING, defaultValue: "", field: "author_avatar" },
    authorRole: { type: DataTypes.ENUM("Member", "Moderator"), defaultValue: "Member", field: "author_role" },
    likes: { type: DataTypes.INTEGER, defaultValue: 0 },
    status: { type: DataTypes.ENUM("approved", "pending", "hidden", "deleted"), defaultValue: "approved" },
  }, { tableName: "comment_replies", timestamps: true, underscored: true });

  const CommentReport = sequelize.define("CommentReport", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    commentId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "comment_id" },
    reportedById: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "reported_by_id" },
    reason: { type: DataTypes.STRING, allowNull: false },
    details: { type: DataTypes.TEXT, defaultValue: "" },
  }, { tableName: "comment_reports", timestamps: true, underscored: true });

  const CommentReplyReport = sequelize.define("CommentReplyReport", {
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    replyId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "reply_id" },
    reportedById: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "reported_by_id" },
    reason: { type: DataTypes.STRING, allowNull: false },
    details: { type: DataTypes.TEXT, defaultValue: "" },
  }, { tableName: "comment_reply_reports", timestamps: true, underscored: true });

  const StreakRestore = sequelize.define("StreakRestore", {
    ...commonId,
    userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "user_id" },
    month: { type: DataTypes.STRING, allowNull: false },
    count: { type: DataTypes.INTEGER, defaultValue: 0 },
    restoredForDate: { type: DataTypes.DATE, allowNull: true, field: "restored_for_date" },
  }, { tableName: "streak_restores", timestamps: true, underscored: true, indexes: [{ unique: true, fields: ["user_id", "month"] }] });

  const AuditLog = sequelize.define("AuditLog", {
    ...commonId,
    userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: "user_id" },
    userEmail: { type: DataTypes.STRING, allowNull: true, field: "user_email" },
    userName: { type: DataTypes.STRING, allowNull: true, field: "user_name" },
    userRole: { type: DataTypes.STRING, allowNull: true, field: "user_role" },
    action: { type: DataTypes.STRING, allowNull: false },
    entityType: { type: DataTypes.ENUM("Member", "Book", "Issue", "JoinRequest", "Role", "Permission", "User", "Report", "Blog", "Resource", "Challenge", "Reservation", "Other"), allowNull: true, field: "entity_type" },
    entityId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: "entity_id" },
    entityLabel: { type: DataTypes.STRING, allowNull: true, field: "entity_label" },
    changes: { type: DataTypes.JSON, allowNull: true },
    meta: { type: DataTypes.JSON, allowNull: true },
    ipAddress: { type: DataTypes.STRING, allowNull: true, field: "ip_address" },
    userAgent: { type: DataTypes.STRING, allowNull: true, field: "user_agent" },
  }, { tableName: "audit_logs", timestamps: true, underscored: true });

  const PushSubscription = sequelize.define("PushSubscription", {
    ...commonId,
    userId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "user_id" },
    endpoint: { type: DataTypes.TEXT, allowNull: false },
    p256dh: { type: DataTypes.TEXT, allowNull: false },
    auth: { type: DataTypes.TEXT, allowNull: false },
  }, { tableName: "push_subscriptions", timestamps: true, underscored: true });

  Role.hasMany(User, { foreignKey: "role_id", as: "users" });
  User.belongsTo(Role, { foreignKey: "role_id", as: "role" });
  Member.belongsTo(Role, { foreignKey: "role_id", as: "role" });
  Member.hasOne(User, { foreignKey: "member_ref_id", as: "user" });
  User.belongsTo(Member, { foreignKey: "member_ref_id", as: "member" });
  User.belongsTo(User, { foreignKey: "added_by_id", as: "addedBy" });
  User.belongsTo(User, { foreignKey: "updated_by_id", as: "updatedBy" });
  User.belongsTo(User, { foreignKey: "invited_by_id", as: "invitedBy" });
  Permission.belongsTo(PermissionCategory, { foreignKey: "category_id", as: "category" });
  PermissionCategory.hasMany(Permission, { foreignKey: "category_id", as: "permissions" });
  Role.belongsToMany(Permission, { through: RolePermission, foreignKey: "role_id", otherKey: "permission_id", as: "permissions" });
  User.belongsToMany(Permission, { through: UserPermission, foreignKey: "user_id", otherKey: "permission_id", as: "permissions" });
  Issue.belongsTo(Book, { foreignKey: "book_id", as: "book" });
  Issue.belongsTo(Member, { foreignKey: "member_id", as: "member" });
  IssueRequest.belongsTo(Book, { foreignKey: "book_id", as: "book" });
  IssueRequest.belongsTo(Member, { foreignKey: "member_id", as: "member" });
  IssueRequest.belongsTo(User, { foreignKey: "requested_by_id", as: "requestedBy" });
  IssueRequest.belongsTo(User, { foreignKey: "reviewed_by_id", as: "reviewedBy" });
  IssueRequest.belongsTo(Issue, { foreignKey: "issue_id", as: "issue" });
  Reservation.belongsTo(Book, { foreignKey: "book_id", as: "book" });
  Reservation.belongsTo(Member, { foreignKey: "member_id", as: "member" });
  Reservation.belongsTo(User, { foreignKey: "created_by_id", as: "createdBy" });
  DailyReport.belongsTo(User, { foreignKey: "created_by_id", as: "createdBy" });
  DailyReport.belongsTo(Book, { foreignKey: "book_id", as: "book" });
  ReadingChallenge.belongsTo(Book, { foreignKey: "book_id", as: "book" });
  ReadingChallenge.belongsTo(User, { foreignKey: "winner_id", as: "winner" });
  ReadingChallenge.belongsTo(User, { foreignKey: "created_by_id", as: "createdBy" });
  ChallengeParticipation.belongsTo(ReadingChallenge, { foreignKey: "challenge_id", as: "challenge" });
  ChallengeParticipation.belongsTo(User, { foreignKey: "user_id", as: "user" });
  UserAchievement.belongsTo(User, { foreignKey: "user_id", as: "user" });
  ReadingGoal.belongsTo(User, { foreignKey: "user_id", as: "user" });
  RefreshToken.belongsTo(User, { foreignKey: "user_id", as: "user" });
  Clubreq.belongsTo(Member, { foreignKey: "member_id", as: "member" });
  Clubreq.belongsTo(User, { foreignKey: "reviewed_by_id", as: "reviewedBy" });
  MemberNote.belongsTo(Member, { foreignKey: "member_id", as: "member" });
  MemberNote.belongsTo(User, { foreignKey: "author_id", as: "author" });
  ModeratorMember.belongsTo(User, { foreignKey: "moderator_id", as: "moderator" });
  ModeratorMember.belongsTo(Member, { foreignKey: "member_id", as: "member" });
  Notification.belongsTo(User, { foreignKey: "user_id", as: "user" });
  NotificationPreference.belongsTo(User, { foreignKey: "user_id", as: "user" });
  BlogPost.belongsTo(User, { foreignKey: "created_by_id", as: "createdBy" });
  BlogPostTag.belongsTo(BlogPost, { foreignKey: "post_id", as: "post" });
  BlogPostRelation.belongsTo(BlogPost, { foreignKey: "post_id", as: "post" });
  BlogPostRelation.belongsTo(BlogPost, { foreignKey: "related_post_id", as: "relatedPost" });
  Resource.belongsTo(User, { foreignKey: "created_by_id", as: "createdBy" });
  ResourceTag.belongsTo(Resource, { foreignKey: "resource_id", as: "resource" });
  ResourceRelation.belongsTo(Resource, { foreignKey: "resource_id", as: "resource" });
  ResourceRelation.belongsTo(Resource, { foreignKey: "related_resource_id", as: "relatedResource" });
  ResourcePostRelation.belongsTo(Resource, { foreignKey: "resource_id", as: "resource" });
  ResourcePostRelation.belongsTo(BlogPost, { foreignKey: "blog_post_id", as: "blogPost" });
  Comment.belongsTo(BlogPost, { foreignKey: "post_id", as: "post" });
  Comment.belongsTo(User, { foreignKey: "author_user_id", as: "authorUser" });
  Comment.belongsTo(User, { foreignKey: "moderated_by_id", as: "moderatedBy" });
  CommentLike.belongsTo(Comment, { foreignKey: "comment_id", as: "comment" });
  CommentLike.belongsTo(User, { foreignKey: "user_id", as: "user" });
  CommentReply.belongsTo(Comment, { foreignKey: "comment_id", as: "comment" });
  CommentReply.belongsTo(User, { foreignKey: "author_user_id", as: "authorUser" });
  CommentReport.belongsTo(Comment, { foreignKey: "comment_id", as: "comment" });
  CommentReport.belongsTo(User, { foreignKey: "reported_by_id", as: "reportedBy" });
  CommentReplyReport.belongsTo(CommentReply, { foreignKey: "reply_id", as: "reply" });
  CommentReplyReport.belongsTo(User, { foreignKey: "reported_by_id", as: "reportedBy" });
  StreakRestore.belongsTo(User, { foreignKey: "user_id", as: "user" });
  AuditLog.belongsTo(User, { foreignKey: "user_id", as: "user" });
  PushSubscription.belongsTo(User, { foreignKey: "user_id", as: "user" });

  return {
    Role,
    PermissionCategory,
    Permission,
    RolePermission,
    UserPermission,
    Member,
    User,
    Book,
    Issue,
    IssueRequest,
    Reservation,
    DailyReport,
    ReadingChallenge,
    ChallengeParticipation,
    Achievement,
    UserAchievement,
    ReadingGoal,
    RefreshToken,
    Clubreq,
    MemberNote,
    ModeratorMember,
    Notification,
    NotificationPreference,
    BlogPost,
    BlogPostTag,
    BlogPostRelation,
    Resource,
    ResourceTag,
    ResourceRelation,
    ResourcePostRelation,
    Comment,
    CommentLike,
    CommentReply,
    CommentReport,
    CommentReplyReport,
    StreakRestore,
    AuditLog,
    PushSubscription,
  };
}
