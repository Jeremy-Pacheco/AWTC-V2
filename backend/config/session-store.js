/**
 * Session store for the EJS admin dashboard (AUDIT_REPORT.md, SEC-16).
 *
 * SESSION_STORE=database -> sessions in the `Sessions` table (connect-session-sequelize).
 *                           They survive restarts/redeploys and expired rows are purged.
 * SESSION_STORE=memory   -> express-session MemoryStore. Only for local development:
 *                           it leaks memory and loses every session on restart.
 *
 * Default: "database" when NODE_ENV=production, "memory" otherwise.
 */
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // keep in sync with the cookie maxAge
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;

function getSessionStoreKind() {
  const fallback = process.env.NODE_ENV === 'production' ? 'database' : 'memory';
  const kind = (process.env.SESSION_STORE || fallback).toLowerCase();
  if (kind !== 'database' && kind !== 'memory') {
    throw new Error(`[config] Invalid SESSION_STORE "${kind}". Use "database" or "memory".`);
  }
  return kind;
}

/**
 * Returns a store for express-session, or undefined to use the MemoryStore.
 * @param {typeof import('express-session')} session
 * @param {import('sequelize').Sequelize} sequelize
 */
function createSessionStore(session, sequelize) {
  if (getSessionStoreKind() === 'memory') {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[config] SESSION_STORE=memory in production: sessions are lost on restart and memory grows unbounded.');
    }
    return undefined;
  }
  const SequelizeStore = require('connect-session-sequelize')(session.Store);
  // The `Sessions` table is created by migrations/20261125120000-create-sessions.js
  return new SequelizeStore({
    db: sequelize,
    tableName: 'Sessions',
    expiration: SESSION_TTL_MS,
    checkExpirationInterval: CLEANUP_INTERVAL_MS,
  });
}

module.exports = { createSessionStore, getSessionStoreKind, SESSION_TTL_MS };
