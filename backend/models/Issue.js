import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Issue = sequelize.define('Issue', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  book_id: { type: DataTypes.INTEGER, allowNull: false },
  member_id: { type: DataTypes.INTEGER, allowNull: false },
  issueDate: { type: DataTypes.DATE, allowNull: false },
  returnDate: { type: DataTypes.DATE, allowNull: false },
  status: { type: DataTypes.ENUM('Issued', 'Returned', 'Overdue'), defaultValue: 'Issued' },
  returnedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: 'issues',
  timestamps: true,
  indexes: [
    { fields: ['member_id', 'status', 'returnDate'] },
    { fields: ['book_id', 'status', 'issueDate'] },
  ],
});

export default Issue;
