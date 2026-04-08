import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Clubreq = sequelize.define('Clubreq', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  FullName: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false },
  phone: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.ENUM('Pending', 'Approved', 'Rejected'), defaultValue: 'Pending' },
  rejectionReason: { type: DataTypes.STRING, defaultValue: '' },
  member_id: { type: DataTypes.INTEGER, allowNull: true },
  reviewed_by: { type: DataTypes.INTEGER, allowNull: true },
  reviewedAt: { type: DataTypes.DATE },
}, { tableName: 'club_requests', timestamps: true });

export default Clubreq;
