import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Achievement = sequelize.define('Achievement', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING, unique: true, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.STRING, defaultValue: '' },
  icon: { type: DataTypes.STRING, defaultValue: '🏆' },
  unlockRules_type: { type: DataTypes.ENUM('first_report', 'streak', 'reports_count', 'pages_count'), allowNull: true },
  unlockRules_threshold: { type: DataTypes.INTEGER, defaultValue: 1 },
}, { tableName: 'achievements', timestamps: true });

export default Achievement;
