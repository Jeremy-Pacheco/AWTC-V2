'use strict';

/**
 * Server-side sessions of the EJS admin dashboard (config/session-store.js,
 * connect-session-sequelize). Idempotent: skips the table when sync() already
 * created it.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const tables = (await queryInterface.showAllTables()).map((t) => (typeof t === 'string' ? t : t.tableName));
    if (tables.some((t) => t.toLowerCase() === 'sessions')) return;

    await queryInterface.createTable('Sessions', {
      sid: {
        type: Sequelize.STRING(36),
        primaryKey: true,
        allowNull: false
      },
      expires: {
        type: Sequelize.DATE,
        allowNull: true
      },
      data: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
    await queryInterface.addIndex('Sessions', ['expires']);
  },

  async down (queryInterface) {
    await queryInterface.dropTable('Sessions');
  }
};
