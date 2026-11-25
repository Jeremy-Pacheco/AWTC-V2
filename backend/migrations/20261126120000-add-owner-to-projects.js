'use strict';

/**
 * Project ownership (AUDIT_REPORT.md, SEC-17): the coordinator responsible
 * for a project. Existing projects keep ownerId = NULL and can only be
 * managed by admins until one is assigned. Deleting the owner sets it back
 * to NULL. Idempotent.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable('Projects');
    if (columns.ownerId) return;

    await queryInterface.addColumn('Projects', 'ownerId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'Users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
    await queryInterface.addIndex('Projects', ['ownerId']);
  },

  async down (queryInterface) {
    const columns = await queryInterface.describeTable('Projects');
    if (!columns.ownerId) return;
    await queryInterface.removeColumn('Projects', 'ownerId');
  }
};
