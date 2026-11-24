/**
 * Demo mode (public test site).
 *
 * DEMO_MODE=true enables:
 *  - three shared demo accounts (volunteer / coordinator / admin) that visitors
 *    can enter with one click ("Entrar como…"), without a password;
 *  - protections so those accounts cannot be deleted or have their role changed;
 *  - a smaller upload size limit (DEMO_MAX_UPLOAD_MB, default 1).
 *
 * The data is reset every night by scripts/reset-demo.js.
 * Demo accounts use the reserved example.com domain: they are never real people.
 */

const DEMO_ACCOUNTS = Object.freeze([
  Object.freeze({ role: 'volunteer', email: 'demo-volunteer@example.com', name: 'Demo Volunteer' }),
  Object.freeze({ role: 'coordinator', email: 'demo-coordinator@example.com', name: 'Demo Coordinator' }),
  Object.freeze({ role: 'admin', email: 'demo-admin@example.com', name: 'Demo Admin' }),
]);

const DEMO_EMAILS = new Set(DEMO_ACCOUNTS.map((a) => a.email));

const DEFAULT_UPLOAD_MB = 5;
const DEFAULT_DEMO_UPLOAD_MB = 1;

const isDemoMode = () => String(process.env.DEMO_MODE || '').toLowerCase() === 'true';

/** Accepts a User instance, a plain object with `email`, or an email string. */
function isDemoAccount(userOrEmail) {
  const email = typeof userOrEmail === 'string' ? userOrEmail : userOrEmail && userOrEmail.email;
  return typeof email === 'string' && DEMO_EMAILS.has(email.toLowerCase());
}

const findDemoAccount = (role) => DEMO_ACCOUNTS.find((a) => a.role === role) || null;

/** Maximum upload size in MB (smaller in demo mode to protect free storage quotas). */
function getMaxUploadMb() {
  if (!isDemoMode()) return DEFAULT_UPLOAD_MB;
  const value = parseFloat(process.env.DEMO_MAX_UPLOAD_MB);
  return Number.isFinite(value) && value > 0 && value <= DEFAULT_UPLOAD_MB ? value : DEFAULT_DEMO_UPLOAD_MB;
}

/** Public, non-sensitive information for the frontend. */
function getPublicConfig() {
  if (!isDemoMode()) return { enabled: false };
  return {
    enabled: true,
    maxUploadMb: getMaxUploadMb(),
    accounts: DEMO_ACCOUNTS.map(({ role, name }) => ({ role, name })),
  };
}

module.exports = {
  DEMO_ACCOUNTS,
  isDemoMode,
  isDemoAccount,
  findDemoAccount,
  getMaxUploadMb,
  getPublicConfig,
};
