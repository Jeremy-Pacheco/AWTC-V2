'use strict';

/** Refresh token record: only the SHA-256 hash of the token is stored (SEC-18). */
module.exports = (sequelize, DataTypes) => {
  const RefreshToken = sequelize.define('RefreshToken', {
    userId: { type: DataTypes.INTEGER, allowNull: false },
    tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    familyId: { type: DataTypes.STRING(36), allowNull: false },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    revokedAt: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'RefreshTokens',
  });

  RefreshToken.associate = (models) => {
    RefreshToken.belongsTo(models.User, { foreignKey: 'userId', onDelete: 'CASCADE' });
  };

  return RefreshToken;
};
