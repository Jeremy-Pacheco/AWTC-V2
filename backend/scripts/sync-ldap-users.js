/**
 * Creates the ou=users branch and the seed users (seeders/20251025120000-users.js)
 * in a LOCAL LDAP directory, so they can log in with AUTH_PROVIDER=ldap.
 *
 * Usage (from backend/):
 *   LDAP_ADMIN_PASSWORD=... LDAP_SEED_PASSWORD=... node scripts/sync-ldap-users.js
 *
 * No credentials live in this file (they were public before, see SEC-01/SEC-11):
 *  - LDAP_ADMIN_PASSWORD: admin bind password of the directory (required).
 *  - LDAP_SEED_PASSWORD:  password given to every seed user (required, must pass
 *                         the password policy of services/auth.service.js).
 * Passwords are stored hashed ({SSHA}) unless LDAP_PASSWORD_HASH=server.
 */
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env.production') });
require('dotenv').config({ path: path.join(__dirname, '../.env.development') });

const ldap = require('ldapjs');
const { getLdapAdminPassword, requireSecret } = require('../config/secrets');
const { buildUserDN, buildUserEntry, LDAP_USERS_DN } = require('../utils/ldap.util');
const { validatePassword } = require('../services/auth.service');

const LDAP_URL = process.env.LDAP_URL || 'ldap://localhost:389';
const LDAP_ADMIN_DN = process.env.LDAP_ADMIN_DN || 'cn=admin,dc=awtc,dc=com';

// Must match the users created by the database seeder
const usersToSync = [
  { name: 'Admin', email: 'admin@awtc.es' },
  { name: 'Juan', email: 'juan@gmail.com' },
  { name: 'Paco', email: 'paco@gmail.com' },
  { name: 'Maria', email: 'maria@gmail.com' },
];

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

let adminPassword;
let seedPassword;
try {
  adminPassword = getLdapAdminPassword();
  seedPassword = requireSecret('LDAP_SEED_PASSWORD');
} catch (err) {
  fail(err.message);
}
for (const user of usersToSync) {
  const problem = validatePassword(seedPassword, user);
  if (problem) fail(`LDAP_SEED_PASSWORD rejected for ${user.email}: ${problem}`);
}

const client = ldap.createClient({ url: LDAP_URL });

function ensureUsersOU() {
  return new Promise((resolve, reject) => {
    const entry = {
      ou: 'users',
      objectClass: ['organizationalUnit', 'top']
    };

    client.add(LDAP_USERS_DN, entry, (err) => {
      if (err) {
        if (err.code === 68) { // EntryAlreadyExists
          console.log('ℹ️  Group ou=users already exists.');
          return resolve();
        }
        return reject(err);
      }
      console.log('✅ Group ou=users created.');
      resolve();
    });
  });
}

function addUserToLDAP(user) {
  return new Promise((resolve, reject) => {
    client.add(buildUserDN(user.email), buildUserEntry(user.name, user.email, seedPassword), (err) => {
      if (err) {
        if (err.code === 68) {
          console.log(`⚠️  User ${user.email} already exists in LDAP.`);
          return resolve();
        }
        return reject(err);
      }
      console.log(`✅ User ${user.email} created in LDAP.`);
      resolve();
    });
  });
}

client.bind(LDAP_ADMIN_DN, adminPassword, async (err) => {
  if (err) {
    console.error('❌ Error connecting to LDAP:', err.message);
    process.exit(1);
  }
  console.log('🔌 Connected to LDAP as Admin.');

  try {
    await ensureUsersOU();

    for (const user of usersToSync) {
      await addUserToLDAP(user);
    }
    console.log('\n✨ Synchronization completed. You can now log in with these users.');
  } catch (error) {
    console.error('❌ Error during synchronization:', error.message);
    process.exitCode = 1;
  } finally {
    client.unbind();
  }
});
