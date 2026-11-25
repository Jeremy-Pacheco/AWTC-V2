'use strict';

/**
 * Refresh tokens (AUDIT_REPORT.md, SEC-18). Only a SHA-256 hash of each token
 * is stored. Tokens of one login share a familyId: reusing a rotated token
 * revokes the whole family (theft detection). Idempotent.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const tables = (await queryInterface.showAllTables()).map((t) => (typeof t === 'string' ? t : t.tableName));
    if (tables.some((t) => t.toLowerCase() === 'refreshtokens')) return;

    await queryInterface.createTable('RefreshTokens', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      tokenHash: { type: Sequelize.STRING(64), allowNull: false, unique: true },
      familyId: { type: Sequelize.STRING(36), allowNull: false },
      expiresAt: { type: Sequelize.DATE, allowNull: false },
      revokedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE }
    });
    await queryInterface.addIndex('RefreshTokens', ['userId']);
    await queryInterface.addIndex('RefreshTokens', ['familyId']);
  },

  async down (queryInterface) {
    await queryInterface.dropTable('RefreshTokens');
  }
};
