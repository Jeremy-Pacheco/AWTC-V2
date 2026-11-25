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

// Most common passwords of 8+ characters (public breach lists). NIST 800-63B
// recommends rejecting known/compromised passwords instead of composition rules.
const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', '12345678910', '87654321', '11111111', '00000000',
  '88888888', '99999999', '11223344', '12341234', '123123123', 'password', 'password1',
  'password12', 'password123', 'passw0rd', 'p@ssw0rd', 'p@ssword', 'qwertyuiop', 'qwerty123',
  'qwerty12', 'qwertyui', 'asdfghjkl', 'zxcvbnm1', '1q2w3e4r', '1q2w3e4r5t', 'q1w2e3r4',
  'iloveyou', 'iloveyou1', 'sunshine', 'princess', 'football', 'baseball', 'welcome1',
  'welcome123', 'superman', 'trustno1', 'letmein1', 'abcd1234', 'abc12345', 'abcdefgh',
  'aa123456', 'admin123', 'administrator', 'changeme', 'whatever', 'starwars', 'dragon12',
  'contraseña', 'contrasena', 'contrasena1', 'contraseña1', 'contraseña123', 'teamo123',
  'awtc1234', 'voluntario', 'voluntario1',
]);

/**
 * Returns an error message, or null if the password is acceptable.
 * `context` (email, name) rejects passwords built from the user's own data.
 */
function validatePassword(password, context = {}) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`;
  }
  if (Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_LENGTH) {
    return `Password must be at most ${MAX_PASSWORD_LENGTH} bytes long`;
  }
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower) || /^(.)\1+$/.test(password)) {
    return 'This password is too common. Choose a less predictable one';
  }
  const personal = [];
  if (typeof context.email === 'string') {
    personal.push(context.email.toLowerCase(), context.email.split('@')[0].toLowerCase());
  }
  if (typeof context.name === 'string') {
    personal.push(...context.name.toLowerCase().split(/\s+/));
  }
  if (personal.some((part) => part.length >= 4 && lower.includes(part))) {
    return 'Password must not contain your name or email';
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
  const passwordError = validatePassword(password, { email, name });
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

  // LDAP: validate the DB record first, then create the LDAP entry, then the
  // DB row. If the DB write fails, the LDAP entry is removed again
  // (compensation) so the email is not blocked forever (BUG-04).
  const user = User.build({ name, email, role });
  await user.validate();
  try {
    await ldapUtil.addUser(name, email, password);
  } catch (err) {
    if (err && err.code === ldapUtil.LDAP_ENTRY_ALREADY_EXISTS) {
      // Entry exists in LDAP but not in the DB: never overwrite it (it could be
      // a directory-only account). An administrator has to resolve it.
      console.warn(`[auth] LDAP entry already exists for an email with no DB user: ${email}`);
      throw clientError('Email is already registered');
    }
    throw err;
  }
  try {
    await user.save();
  } catch (dbErr) {
    await ldapUtil.deleteUser(email).catch((cleanupErr) => {
      console.error(`[auth] Could not remove LDAP entry after failed registration of ${email}: ${cleanupErr.message}`);
    });
    throw dbErr;
  }
  return User.findByPk(user.id);
}

/**
 * Deletes a user from the database and, with LDAP, from the directory too
 * (BUG-05), so a deleted account can no longer authenticate.
 *
 * With LDAP both deletions run inside one DB transaction: the row is deleted,
 * then the LDAP entry; if LDAP fails the transaction is rolled back and
 * nothing changes.
 */
async function deleteUser(user) {
  if (getProvider() === 'local') {
    await user.destroy();
    return;
  }
  await User.sequelize.transaction(async (transaction) => {
    await user.destroy({ transaction });
    await ldapUtil.deleteUser(user.email);
  });
}

function clientError(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

module.exports = {
  getProvider,
  validatePassword,
  authenticate,
  registerUser,
  deleteUser,
  MIN_PASSWORD_LENGTH,
};
