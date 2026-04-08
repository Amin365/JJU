import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Reservation = sequelize.define('Reservation', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  book_id: { type: DataTypes.INTEGER, allowNull: false },
  member_id: { type: DataTypes.INTEGER, allowNull: false },
  created_by: { type: DataTypes.INTEGER, allowNull: true },
  status: { type: DataTypes.ENUM('Active', 'Fulfilled', 'Cancelled', 'Expired'), defaultValue: 'Active' },
  notifiedAt: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'reservations', timestamps: true });

export default Reservation;
