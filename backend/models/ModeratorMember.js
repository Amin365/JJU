import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ModeratorMember = sequelize.define('ModeratorMember', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  moderator_id: { type: DataTypes.INTEGER, allowNull: false },
  member_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
}, { tableName: 'moderator_members', timestamps: true });

export default ModeratorMember;
