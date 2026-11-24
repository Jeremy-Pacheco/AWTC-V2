'use strict';

/**
 * Push notification subscriptions (models/subscription.js).
 *
 * This file used to be empty, which made `sequelize-cli db:migrate` fail on
 * a fresh database; the table was only created by `sequelize.sync()` at
 * startup. It is idempotent so databases where sync already created the
 * table can run it safely.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const tables = (await queryInterface.showAllTables()).map((t) => (typeof t === 'string' ? t : t.tableName));
    if (tables.some((t) => t.toLowerCase() === 'subscriptions')) return;

    await queryInterface.createTable('Subscriptions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      endpoint: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      expirationTime: {
        type: Sequelize.BIGINT,
        allowNull: true
      },
      keys: {
        type: Sequelize.TEXT,
        allowNull: false
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
  },

  async down (queryInterface) {
    await queryInterface.dropTable('Subscriptions');
  }
};
