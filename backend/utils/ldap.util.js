const crypto = require('crypto');
const ldap = require('ldapjs');
const { getLdapAdminPassword } = require('../config/secrets');

const LDAP_URL = process.env.LDAP_URL || 'ldap://localhost:389';
const LDAP_BASE_DN = process.env.LDAP_BASE_DN || 'dc=awtc,dc=com';
const LDAP_ADMIN_DN = process.env.LDAP_ADMIN_DN || 'cn=admin,dc=awtc,dc=com';
const LDAP_USERS_DN = `ou=users,${LDAP_BASE_DN}`;

// Only plausible email addresses are ever turned into a DN or sent to LDAP
const EMAIL_RE = /^[^\s@,;<>"\\]+@[^\s@,;<>"\\]+\.[^\s@,;<>"\\]+$/;

function getClient() {
  return ldap.createClient({
    url: LDAP_URL,
    reconnect: true
  });
}

const isValidEmail = (email) => typeof email === 'string' && email.length <= 254 && EMAIL_RE.test(email);

/**
 * Escapes an attribute value for use inside a DN (RFC 4514, section 2.4).
 * Special characters are written as \XX hex pairs. ldapjs' own RDN escaping
 * is not used because it leaves "\" unescaped, which changes the value.
 */
function escapeDNValue(value) {
  const s = String(value);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const code = ch.charCodeAt(0);
    const special = '"+,;<>\\='.includes(ch) || code === 0
      || (i === 0 && (ch === ' ' || ch === '#'))
      || (i === s.length - 1 && ch === ' ');
    out += special ? `\\${code.toString(16).padStart(2, '0')}` : ch;
  }
  return out;
}

/**
 * DN of a user entry: cn=<email>,ou=users,<base>.
 * The email is escaped as a DN value, so characters such as ",", "+", "="
 * or "\" cannot inject extra DN components or alter the value (SEC-19).
 */
function buildUserDN(email) {
  return `cn=${escapeDNValue(email)},${LDAP_USERS_DN}`;
}

/**
 * LDAP_PASSWORD_HASH=ssha   (default) -> store a salted SHA-1 hash ({SSHA}), which
 *                                        every OpenLDAP server verifies natively.
 * LDAP_PASSWORD_HASH=server            -> send the password as is, ONLY when the server
 *                                        hashes it itself (ppolicy olcPPolicyHashCleartext,
 *                                        e.g. with {ARGON2}).
 * Never store passwords in clear text (SEC-11).
 */
function getPasswordHashMode() {
  const mode = (process.env.LDAP_PASSWORD_HASH || 'ssha').toLowerCase();
  if (mode !== 'ssha' && mode !== 'server') {
    throw new Error(`[config] Invalid LDAP_PASSWORD_HASH "${mode}". Use "ssha" or "server".`);
  }
  return mode;
}

/** {SSHA} = base64(SHA1(password + salt) + salt), the OpenLDAP format. */
function hashPasswordSSHA(password, salt = crypto.randomBytes(16)) {
  const digest = crypto.createHash('sha1').update(Buffer.from(password, 'utf8')).update(salt).digest();
  return `{SSHA}${Buffer.concat([digest, salt]).toString('base64')}`;
}

function passwordForStorage(password) {
  return getPasswordHashMode() === 'ssha' ? hashPasswordSSHA(password) : password;
}

/** inetOrgPerson entry for a new user (password already hashed). */
function buildUserEntry(name, email, password) {
  return {
    cn: email,
    sn: name,
    mail: email,
    userPassword: passwordForStorage(password),
    objectClass: ['inetOrgPerson', 'top']
  };
}

/**
 * Authenticate a user against LDAP
 * @param {string} email - User email (used as CN)
 * @param {string} password - User password
 * @returns {Promise<boolean>}
 */
function authenticate(email, password) {
  // An empty password would be an "unauthenticated bind", which some
  // servers accept as a success: never let it reach LDAP.
  if (!isValidEmail(email) || typeof password !== 'string' || password.length === 0) {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    const client = getClient();
    client.bind(buildUserDN(email), password, (err) => {
      client.unbind();
      if (err) {
        console.error('LDAP Auth Error:', err.name || err.message);
        return resolve(false);
      }
      return resolve(true);
    });
  });
}

/**
 * Add a new user to LDAP
 * @param {string} name - User full name
 * @param {string} email - User email
 * @param {string} password - User password (hashed before storage)
 * @returns {Promise<void>}
 */
function addUser(name, email, password) {
  if (!isValidEmail(email)) {
    return Promise.reject(Object.assign(new Error('Invalid email'), { status: 400 }));
  }
  return new Promise((resolve, reject) => {
    let adminPassword;
    let entry;
    try {
      adminPassword = getLdapAdminPassword();
      entry = buildUserEntry(name, email, password);
    } catch (configErr) {
      return reject(configErr);
    }

    const client = getClient();
    client.bind(LDAP_ADMIN_DN, adminPassword, (err) => {
      if (err) {
        client.unbind();
        return reject(err);
      }
      client.add(buildUserDN(email), entry, (addErr) => {
        client.unbind();
        if (addErr) return reject(addErr);
        resolve();
      });
    });
  });
}

module.exports = {
  authenticate,
  addUser,
  buildUserDN,
  buildUserEntry,
  escapeDNValue,
  hashPasswordSSHA,
  getPasswordHashMode,
  isValidEmail,
  LDAP_USERS_DN,
};
