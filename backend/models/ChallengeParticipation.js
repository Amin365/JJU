import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const ChallengeParticipation = sequelize.define('ChallengeParticipation', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  challenge_id: { type: DataTypes.INTEGER, allowNull: false },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  pagesRead: { type: DataTypes.INTEGER, defaultValue: 0 },
  minutesRead: { type: DataTypes.INTEGER, defaultValue: 0 },
  reportsCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  currentStreak: { type: DataTypes.INTEGER, defaultValue: 0 },
  longestStreak: { type: DataTypes.INTEGER, defaultValue: 0 },
  joinedAt: { type: DataTypes.DATE },
  completedAt: { type: DataTypes.DATE },
  status: { type: DataTypes.ENUM('Active', 'Completed', 'Dropped'), defaultValue: 'Active' },
}, {
  tableName: 'challenge_participations',
  timestamps: true,
  indexes: [{ unique: true, fields: ['challenge_id', 'user_id'] }],
});

export default ChallengeParticipation;
