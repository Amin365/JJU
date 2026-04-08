import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

export const Comment = sequelize.define('Comment', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  post_id: { type: DataTypes.INTEGER, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  author_user_id: { type: DataTypes.INTEGER, allowNull: false },
  author_name: { type: DataTypes.STRING, allowNull: false },
  author_avatar: { type: DataTypes.STRING, defaultValue: '' },
  author_role: { type: DataTypes.ENUM('Member', 'Moderator'), defaultValue: 'Member' },
  likes: { type: DataTypes.INTEGER, defaultValue: 0 },
  likedBy: { type: DataTypes.JSON, defaultValue: [] },
  isPinned: { type: DataTypes.BOOLEAN, defaultValue: false },
  isBestInsight: { type: DataTypes.BOOLEAN, defaultValue: false },
  status: { type: DataTypes.ENUM('approved', 'pending', 'hidden', 'deleted'), defaultValue: 'approved' },
  moderated_by: { type: DataTypes.INTEGER, allowNull: true },
  moderatedAt: { type: DataTypes.DATE },
  moderationNote: { type: DataTypes.STRING },
}, { tableName: 'comments', timestamps: true });

export const Reply = sequelize.define('Reply', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  comment_id: { type: DataTypes.INTEGER, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  author_user_id: { type: DataTypes.INTEGER, allowNull: false },
  author_name: { type: DataTypes.STRING, allowNull: false },
  author_avatar: { type: DataTypes.STRING, defaultValue: '' },
  author_role: { type: DataTypes.ENUM('Member', 'Moderator'), defaultValue: 'Member' },
  likes: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.ENUM('approved', 'pending', 'hidden', 'deleted'), defaultValue: 'approved' },
}, { tableName: 'replies', timestamps: true });

export const CommentReport = sequelize.define('CommentReport', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  comment_id: { type: DataTypes.INTEGER, allowNull: true },
  reply_id: { type: DataTypes.INTEGER, allowNull: true },
  reported_by: { type: DataTypes.INTEGER, allowNull: false },
  reason: { type: DataTypes.STRING, allowNull: false },
  details: { type: DataTypes.STRING, defaultValue: '' },
}, { tableName: 'comment_reports', timestamps: true });

export default Comment;
