/**
 * Authentication provider abstraction.
 *
 * AUTH_PROVIDER=ldap  (default) -> passwords live in the LDAP directory
 * AUTH_PROVIDER=local           -> bcrypt hash stored in Users.passwordHash
 *
 * The local provider exists so the app can be deployed on free hosting
 * (Render + managed MySQL) where no LDAP server is available.
 */
const bcrypt = require('bcrypt');
const { User } = require('../models');
const ldapUtil = require('../utils/ldap.util');

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72; // bcrypt only uses the first 72 bytes

// Pre-computed hash used to keep response time constant when the user does not exist
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_ROUNDS);

function getProvider() {
  const provider = (process.env.AUTH_PROVIDER || 'ldap').toLowerCase();
  if (provider !== 'ldap' && provider !== 'local') {
    throw new Error(`[config] Invalid AUTH_PROVIDER "${provider}". Use "ldap" or "local".`);
  }
  return provider;
}

/** Returns an error message, or null if the password is acceptable. */
function validatePassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`;
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} bytes long`;
  }
  return null;
}

/**
 * Verifies credentials. Returns the User (without passwordHash) or null.
 * The caller must not reveal whether the email or the password was wrong.
 */
async function authenticate(email, password) {
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return null;
  }

  if (getProvider() === 'local') {
    const user = await User.scope('withPassword').findOne({ where: { email } });
    const ok = await bcrypt.compare(password, (user && user.passwordHash) || DUMMY_HASH);
    if (!user || !user.passwordHash || !ok) return null;
    return User.findByPk(user.id);
  }

  const isAuthenticated = await ldapUtil.authenticate(email, password);
  if (!isAuthenticated) return null;
  return User.findOne({ where: { email } });
}

/**
 * Registers credentials for a new user and creates the DB record.
 * Throws an Error with `status` 400 for validation problems.
 */
async function registerUser({ name, email, password, role = 'volunteer' }) {
  const passwordError = validatePassword(password);
  if (passwordError) {
    const err = new Error(passwordError);
    err.status = 400;
    throw err;
  }

  if (getProvider() === 'local') {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await User.create({ name, email, role, passwordHash });
    return User.findByPk(user.id);
  }

  // LDAP: validate the DB record first so a failure doesn't leave an orphan LDAP entry
  const user = User.build({ name, email, role });
  await user.validate();
  await ldapUtil.addUser(name, email, password);
  await user.save();
  return User.findByPk(user.id);
}

module.exports = {
  getProvider,
  validatePassword,
  authenticate,
  registerUser,
  MIN_PASSWORD_LENGTH,
};
