import sequelize from '../config/database.js';
import User from './user.js';
import Role from './Role.js';
import Member from './Members.js';
import Book, { Counter } from './Books.js';
import Issue from './Issue.js';
import Reservation from './Reservation.js';
import IssueRequest from './IssueRequest.js';
import RefreshToken from './RefreshToken.js';
import Permission from './Permissions.js';
import PermissionCategory from './PermissionCategory.js';
import RolePermission from './RolePermission.js';
import UserPermission from './UserPermission.js';
import DailyReport from './DailyReport.js';
import Notification from './Notification.js';
import NotificationPreferences from './NotificationPreferences.js';
import BlogPost from './BlogPost.js';
import { Comment, Reply, CommentReport } from './Comments.js';
import Achievement from './Achievement.js';
import UserAchievement from './UserAchievement.js';
import ReadingChallenge from './ReadingChallenge.js';
import ChallengeParticipation from './ChallengeParticipation.js';
import ReadingGoal from './ReadingGoal.js';
import AuditLog from './AuditLog.js';
import MemberNote from './MemberNote.js';
import ModeratorMember from './ModeratorMember.js';
import Clubreq from './Clubreq.js';
import PushSubscription from './ushSubscription.js';
import StreakRestore from './StreakRestore.js';
import Resource from './Resource.js';

// ── Associations 

// Role ↔ User
User.belongsTo(Role, { foreignKey: 'role_id', as: 'roleInfo' });
User.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });
Role.hasMany(User, { foreignKey: 'role_id' });

// Member ↔ Role
Member.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });
Member.belongsTo(Role, { foreignKey: 'role_id', as: 'roleRef' });

// User ↔ Member
User.belongsTo(Member, { foreignKey: 'member_id_fk', as: 'member' });
Member.hasOne(User, { foreignKey: 'member_id_fk' });

// User self-references
User.belongsTo(User, { foreignKey: 'added_by', as: 'addedByUser' });
User.belongsTo(User, { foreignKey: 'updated_by', as: 'updatedByUser' });
User.belongsTo(User, { foreignKey: 'invited_by', as: 'invitedByUser' });

// Permission ↔ PermissionCategory
Permission.belongsTo(PermissionCategory, { foreignKey: 'category_id', as: 'category' });
PermissionCategory.hasMany(Permission, { foreignKey: 'category_id' });

// RolePermission associations
RolePermission.belongsTo(Role, { foreignKey: 'role_id', as: 'role' });
RolePermission.belongsTo(Permission, { foreignKey: 'permission_id', as: 'permission' });
Role.hasMany(RolePermission, { foreignKey: 'role_id' });
Permission.hasMany(RolePermission, { foreignKey: 'permission_id' });
RolePermission.belongsTo(User, { foreignKey: 'added_by', as: 'addedBy' });

// UserPermission associations
UserPermission.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
UserPermission.belongsTo(Permission, { foreignKey: 'permission_id', as: 'permission' });
User.hasMany(UserPermission, { foreignKey: 'user_id' });

// Issue associations
Issue.belongsTo(Book, { foreignKey: 'book_id', as: 'book' });
Issue.belongsTo(Member, { foreignKey: 'member_id', as: 'member' });
Book.hasMany(Issue, { foreignKey: 'book_id' });
Member.hasMany(Issue, { foreignKey: 'member_id' });

// Reservation associations
Reservation.belongsTo(Book, { foreignKey: 'book_id', as: 'book' });
Reservation.belongsTo(Member, { foreignKey: 'member_id', as: 'member' });
Reservation.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

// IssueRequest associations
IssueRequest.belongsTo(Book, { foreignKey: 'book_id', as: 'book' });
IssueRequest.belongsTo(Member, { foreignKey: 'member_id', as: 'member' });
IssueRequest.belongsTo(User, { foreignKey: 'requested_by', as: 'requestedBy' });
IssueRequest.belongsTo(User, { foreignKey: 'reviewed_by', as: 'reviewedBy' });
IssueRequest.belongsTo(Issue, { foreignKey: 'issue_id', as: 'issue' });

// DailyReport associations
DailyReport.belongsTo(User, { foreignKey: 'created_by', as: 'createdBy' });
DailyReport.belongsTo(Book, { foreignKey: 'book_id', as: 'book' });

// Notification associations
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// NotificationPreferences associations
NotificationPreferences.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasOne(NotificationPreferences, { foreignKey: 'user_id' });

// BlogPost associations
BlogPost.belongsTo(User, { foreignKey: 'created_by', as: 'createdBy' });

// Comment associations
Comment.belongsTo(BlogPost, { foreignKey: 'post_id', as: 'post' });
Comment.belongsTo(User, { foreignKey: 'author_user_id', as: 'authorUser' });
Comment.belongsTo(User, { foreignKey: 'moderated_by', as: 'moderatedByUser' });
BlogPost.hasMany(Comment, { foreignKey: 'post_id', as: 'comments' });

// Reply associations
Reply.belongsTo(Comment, { foreignKey: 'comment_id', as: 'comment' });
Reply.belongsTo(User, { foreignKey: 'author_user_id', as: 'authorUser' });
Comment.hasMany(Reply, { foreignKey: 'comment_id', as: 'replies' });

// CommentReport associations
CommentReport.belongsTo(Comment, { foreignKey: 'comment_id', as: 'comment' });
CommentReport.belongsTo(Reply, { foreignKey: 'reply_id', as: 'reply' });
CommentReport.belongsTo(User, { foreignKey: 'reported_by', as: 'reportedByUser' });

// UserAchievement associations
UserAchievement.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(UserAchievement, { foreignKey: 'user_id' });

// ChallengeParticipation associations
ChallengeParticipation.belongsTo(ReadingChallenge, { foreignKey: 'challenge_id', as: 'challenge' });
ChallengeParticipation.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
ReadingChallenge.hasMany(ChallengeParticipation, { foreignKey: 'challenge_id', as: 'participations' });

// ReadingGoal associations
ReadingGoal.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(ReadingGoal, { foreignKey: 'user_id' });

// AuditLog associations
AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// MemberNote associations
MemberNote.belongsTo(Member, { foreignKey: 'member_id', as: 'member' });
MemberNote.belongsTo(User, { foreignKey: 'author_id', as: 'author' });

// ModeratorMember associations
ModeratorMember.belongsTo(User, { foreignKey: 'moderator_id', as: 'moderator' });
ModeratorMember.belongsTo(Member, { foreignKey: 'member_id', as: 'member' });

// Clubreq associations
Clubreq.belongsTo(Member, { foreignKey: 'member_id', as: 'member' });
Clubreq.belongsTo(User, { foreignKey: 'reviewed_by', as: 'reviewedBy' });

// StreakRestore associations
StreakRestore.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// RefreshToken associations
RefreshToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Resource associations
Resource.belongsTo(User, { foreignKey: 'created_by', as: 'createdBy' });

// ReadingChallenge associations
ReadingChallenge.belongsTo(Book, { foreignKey: 'book_id', as: 'book' });
ReadingChallenge.belongsTo(User, { foreignKey: 'winner_id', as: 'winner' });
ReadingChallenge.belongsTo(User, { foreignKey: 'created_by', as: 'createdBy' });

// PushSubscription associations
PushSubscription.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

export {
  sequelize,
  User,
  Role,
  Member,
  Book,
  Counter,
  Issue,
  Reservation,
  IssueRequest,
  RefreshToken,
  Permission,
  PermissionCategory,
  RolePermission,
  UserPermission,
  DailyReport,
  Notification,
  NotificationPreferences,
  BlogPost,
  Comment,
  Reply,
  CommentReport,
  Achievement,
  UserAchievement,
  ReadingChallenge,
  ChallengeParticipation,
  ReadingGoal,
  AuditLog,
  MemberNote,
  ModeratorMember,
  Clubreq,
  PushSubscription,
  StreakRestore,
  Resource,
};
