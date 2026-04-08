import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Resource = sequelize.define('Resource', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT, defaultValue: '' },
  content: { type: DataTypes.TEXT, defaultValue: '' },
  type: { type: DataTypes.ENUM('guide', 'announcement', 'event-recap', 'download'), allowNull: false },
  fileUrl: { type: DataTypes.STRING, defaultValue: '' },
  fileName: { type: DataTypes.STRING, defaultValue: '' },
  fileSize: { type: DataTypes.INTEGER, defaultValue: 0 },
  fileType: { type: DataTypes.STRING, defaultValue: '' },
  eventDate: { type: DataTypes.DATE },
  eventLocation: { type: DataTypes.STRING, defaultValue: '' },
  coverImage: { type: DataTypes.STRING, defaultValue: '' },
  created_by: { type: DataTypes.INTEGER, allowNull: false },
  author_name: { type: DataTypes.STRING, defaultValue: '' },
  status: { type: DataTypes.ENUM('Draft', 'Published', 'Archived'), defaultValue: 'Draft' },
  isFeatured: { type: DataTypes.BOOLEAN, defaultValue: false },
  isPinned: { type: DataTypes.BOOLEAN, defaultValue: false },
  displayOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
  slug: { type: DataTypes.STRING, unique: true },
  seoTitle: { type: DataTypes.STRING(70) },
  seoDescription: { type: DataTypes.STRING(160) },
  tags: { type: DataTypes.JSON, defaultValue: [] },
  category: { type: DataTypes.STRING, defaultValue: '' },
  views: { type: DataTypes.INTEGER, defaultValue: 0 },
  downloads: { type: DataTypes.INTEGER, defaultValue: 0 },
  publishAt: { type: DataTypes.DATE },
  publishedAt: { type: DataTypes.DATE },
  relatedResources: { type: DataTypes.JSON, defaultValue: [] },
  relatedPosts: { type: DataTypes.JSON, defaultValue: [] },
}, { tableName: 'resources', timestamps: true });

export default Resource;
