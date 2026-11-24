'use strict';

/**
 * Adds a bcrypt password hash for the local authentication provider
 * (AUTH_PROVIDER=local). It is nullable: with the LDAP provider passwords
 * live in the directory and this column stays empty.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('Users');
    if (!tableInfo.passwordHash) {
      await queryInterface.addColumn('Users', 'passwordHash', {
        type: Sequelize.STRING(100),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const tableInfo = await queryInterface.describeTable('Users');
    if (tableInfo.passwordHash) {
      await queryInterface.removeColumn('Users', 'passwordHash');
    }
  },
};
