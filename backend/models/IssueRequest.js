import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const IssueRequest = sequelize.define('IssueRequest', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  book_id: { type: DataTypes.INTEGER, allowNull: false },
  member_id: { type: DataTypes.INTEGER, allowNull: false },
  requested_by: { type: DataTypes.INTEGER, allowNull: true },
  status: { type: DataTypes.ENUM('Requested', 'Approved', 'Rejected', 'Issued', 'Cancelled'), defaultValue: 'Requested' },
  requestedDays: { type: DataTypes.INTEGER, defaultValue: 7 },
  note: { type: DataTypes.TEXT },
  reviewed_by: { type: DataTypes.INTEGER, allowNull: true },
  reviewedAt: { type: DataTypes.DATE },
  reviewNote: { type: DataTypes.TEXT },
  issue_id: { type: DataTypes.INTEGER, allowNull: true },
}, { tableName: 'issue_requests', timestamps: true });

export default IssueRequest;
