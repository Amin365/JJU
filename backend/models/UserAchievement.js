import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const UserAchievement = sequelize.define('UserAchievement', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  achievementCode: { type: DataTypes.STRING, allowNull: false },
  unlockedAt: { type: DataTypes.DATE },
}, {
  tableName: 'user_achievements',
  timestamps: true,
  indexes: [{ unique: true, fields: ['user_id', 'achievementCode'] }],
});

export default UserAchievement;
