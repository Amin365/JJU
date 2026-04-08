import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const BlogPost = sequelize.define('BlogPost', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  author: { type: DataTypes.STRING, allowNull: false },
  relatedBook: { type: DataTypes.STRING, defaultValue: '' },
  created_by: { type: DataTypes.INTEGER, allowNull: true },
  status: { type: DataTypes.ENUM('Draft', 'Published', 'Scheduled'), defaultValue: 'Draft' },
  tags: { type: DataTypes.JSON, defaultValue: [] },
  likes: { type: DataTypes.INTEGER, defaultValue: 0 },
  views: { type: DataTypes.INTEGER, defaultValue: 0 },
  blog_picture: { type: DataTypes.STRING, defaultValue: '' },
  author_name: { type: DataTypes.STRING, defaultValue: '' },
  author_picture: { type: DataTypes.STRING, defaultValue: '' },
  isFeatured: { type: DataTypes.BOOLEAN, defaultValue: false },
  isPinned: { type: DataTypes.BOOLEAN, defaultValue: false },
  isEditorsPick: { type: DataTypes.BOOLEAN, defaultValue: false },
  displayOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
  relatedPosts: { type: DataTypes.JSON, defaultValue: [] },
  slug: { type: DataTypes.STRING, unique: true },
  seoTitle: { type: DataTypes.STRING(70) },
  seoDescription: { type: DataTypes.STRING(160) },
  socialImage: { type: DataTypes.STRING },
  canonicalUrl: { type: DataTypes.STRING },
  keywords: { type: DataTypes.JSON, defaultValue: [] },
  publishAt: { type: DataTypes.DATE },
  publishedAt: { type: DataTypes.DATE },
}, { tableName: 'blog_posts', timestamps: true });

export default BlogPost;
