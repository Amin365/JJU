import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const DailyReport = sequelize.define('DailyReport', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  created_by: { type: DataTypes.INTEGER, allowNull: false },
  book_id: { type: DataTypes.INTEGER, allowNull: false },
  readingDate: { type: DataTypes.DATE, allowNull: false },
  pagesFrom: { type: DataTypes.INTEGER, allowNull: false },
  pagesTo: { type: DataTypes.INTEGER, allowNull: false },
  timeSpent: { type: DataTypes.INTEGER, allowNull: false },
  summary: { type: DataTypes.TEXT, allowNull: false },
  rating: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.ENUM('Pending', 'Approved', 'Needs Improvement'), defaultValue: 'Pending' },
}, {
  tableName: 'daily_reports',
  timestamps: true,
  indexes: [{ unique: true, fields: ['created_by', 'book_id', 'readingDate'] }],
});

export default DailyReport;
