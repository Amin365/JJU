import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ReadingGoal = sequelize.define('ReadingGoal', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  goalType: { type: DataTypes.ENUM('pages_per_day', 'minutes_per_day', 'reports_per_week'), allowNull: false },
  targetValue: { type: DataTypes.INTEGER, allowNull: false },
  startDate: { type: DataTypes.DATE, allowNull: false },
  endDate: { type: DataTypes.DATE },
  status: { type: DataTypes.ENUM('Active', 'Completed', 'Expired'), defaultValue: 'Active' },
  completedAt: { type: DataTypes.DATE },
  completionNotifiedAt: { type: DataTypes.DATE },
}, { tableName: 'reading_goals', timestamps: true });

export default ReadingGoal;
