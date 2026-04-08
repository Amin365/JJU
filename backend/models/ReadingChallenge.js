import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ReadingChallenge = sequelize.define('ReadingChallenge', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.STRING, defaultValue: '' },
  book_id: { type: DataTypes.INTEGER, allowNull: true },
  winner_id: { type: DataTypes.INTEGER, allowNull: true },
  completedAt: { type: DataTypes.DATE },
  completionReason: { type: DataTypes.ENUM('target_reached', 'date_ended'), allowNull: true },
  type: { type: DataTypes.ENUM('streak', 'pages', 'minutes', 'reports'), allowNull: false },
  startDate: { type: DataTypes.DATE, allowNull: false },
  endDate: { type: DataTypes.DATE, allowNull: false },
  rules_minPagesPerDay: { type: DataTypes.INTEGER, defaultValue: 0 },
  rules_minMinutesPerDay: { type: DataTypes.INTEGER, defaultValue: 0 },
  rules_requiredConsecutiveDays: { type: DataTypes.INTEGER, defaultValue: 0 },
  rules_targetTotal: { type: DataTypes.INTEGER, defaultValue: 0 },
  status: { type: DataTypes.ENUM('Draft', 'Active', 'Completed'), defaultValue: 'Active' },
  created_by: { type: DataTypes.INTEGER, allowNull: false },
}, { tableName: 'reading_challenges', timestamps: true });

export default ReadingChallenge;
