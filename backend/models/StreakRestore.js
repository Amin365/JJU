import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const StreakRestore = sequelize.define('StreakRestore', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  month: { type: DataTypes.STRING, allowNull: false },
  count: { type: DataTypes.INTEGER, defaultValue: 0 },
  restoredForDate: { type: DataTypes.DATE },
}, {
  tableName: 'streak_restores',
  timestamps: true,
  indexes: [{ unique: true, fields: ['user_id', 'month'] }],
});

export default StreakRestore;
