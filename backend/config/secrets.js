/**
 * Centralised access to required secrets.
 *
 * There are intentionally NO hardcoded fallbacks: a missing secret must stop
 * the server instead of silently using a value that is public in the repo.
 */

// Values that were previously hardcoded in the codebase and are therefore public.
const KNOWN_INSECURE_VALUES = new Set([
  'SecretAWTCKey',
  'awtc_session_secret',
  'admin',
  'adminawtc1234',
  'config',
]);

function requireSecret(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`[config] Missing required secret: ${name}. Define it in your environment or .env file.`);
  }
  if (KNOWN_INSECURE_VALUES.has(value)) {
    throw new Error(`[config] Insecure value for ${name}: it was hardcoded in the repository and must be rotated.`);
  }
  return value;
}

const getJwtSecret = () => requireSecret('JWT_SECRET');
const getSessionSecret = () => requireSecret('SESSION_SECRET');
const getLdapAdminPassword = () => requireSecret('LDAP_ADMIN_PASSWORD');

/** Call at startup to fail fast if any required secret is missing. */
function assertRequiredSecrets() {
  getJwtSecret();
  getSessionSecret();
}

module.exports = {
  requireSecret,
  getJwtSecret,
  getSessionSecret,
  getLdapAdminPassword,
  assertRequiredSecrets,
};
