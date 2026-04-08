import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const MemberNote = sequelize.define('MemberNote', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  member_id: { type: DataTypes.INTEGER, allowNull: false },
  author_id: { type: DataTypes.INTEGER, allowNull: false },
  note: { type: DataTypes.TEXT, allowNull: false },
  category: { type: DataTypes.STRING, defaultValue: '' },
  isArchived: { type: DataTypes.BOOLEAN, defaultValue: false },
}, { tableName: 'member_notes', timestamps: true });

export default MemberNote;
