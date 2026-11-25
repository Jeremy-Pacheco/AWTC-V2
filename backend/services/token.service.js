/**
 * Access and refresh tokens (AUDIT_REPORT.md, SEC-18).
 *
 * - Access token: short-lived JWT (ACCESS_TOKEN_TTL, default 15m) sent as a
 *   Bearer header. Stolen, it is only useful for minutes.
 * - Refresh token: random 256-bit value in an httpOnly cookie that
 *   JavaScript cannot read, scoped to /api/auth. Only its SHA-256 hash is
 *   stored. It rotates on every use; tokens of one login share a familyId.
 * - Reuse detection: presenting an already rotated token revokes the whole
 *   family (someone else used it). A short grace window avoids logging
 *   people out when two tabs refresh at the same time.
 * - Logout revokes the family on the server.
 *
 * Environment:
 *   ACCESS_TOKEN_TTL         jsonwebtoken duration, default "15m"
 *   REFRESH_TOKEN_TTL_DAYS   default 7 (1-90)
 *   REFRESH_COOKIE_SAMESITE  lax (default) | strict | none. Use "none" (with
 *                            SESSION_COOKIE_SECURE=true) when the frontend is on
 *                            another site than the API (e.g. Vercel + Render).
 */
const crypto = require('crypto');
const { Op } = require('sequelize');
const { RefreshToken, User } = require('../models');
const { generateToken } = require('../utils/utils');

const REFRESH_COOKIE = 'awtc.rt';
const REFRESH_COOKIE_PATH = '/api/auth';
const REUSE_GRACE_MS = 15 * 1000;

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function refreshTtlMs() {
  const days = parseInt(process.env.REFRESH_TOKEN_TTL_DAYS, 10);
  const safeDays = Number.isFinite(days) && days >= 1 && days <= 90 ? days : 7;
  return safeDays * 24 * 60 * 60 * 1000;
}

function sameSite() {
  const value = (process.env.REFRESH_COOKIE_SAMESITE || 'lax').toLowerCase();
  return ['lax', 'strict', 'none'].includes(value) ? value : 'lax';
}

function cookieOptions(req) {
  const secureSetting = req.app.get('sessionCookieSecure');
  const policy = sameSite();
  return {
    httpOnly: true,
    // SameSite=None is only accepted by browsers on Secure cookies
    secure: policy === 'none' ? true : secureSetting === 'auto' ? req.secure : Boolean(secureSetting),
    sameSite: policy,
    path: REFRESH_COOKIE_PATH,
    maxAge: refreshTtlMs(),
  };
}

function clearRefreshCookie(req, res) {
  const options = cookieOptions(req);
  delete options.maxAge;
  res.clearCookie(REFRESH_COOKIE, options);
}

function unauthorized(message = 'Session expired. Please log in again.') {
  return Object.assign(new Error(message), { status: 401 });
}

async function storeNewRefreshToken(userId, familyId) {
  const token = crypto.randomBytes(32).toString('base64url');
  await RefreshToken.create({
    userId,
    tokenHash: hashToken(token),
    familyId,
    expiresAt: new Date(Date.now() + refreshTtlMs()),
  });
  // Housekeeping: drop this user's expired tokens (best effort)
  RefreshToken.destroy({ where: { userId, expiresAt: { [Op.lt]: new Date() } } }).catch(() => {});
  return token;
}

async function revokeFamily(familyId) {
  await RefreshToken.update({ revokedAt: new Date() }, { where: { familyId, revokedAt: null } });
}

/**
 * Starts a session after a successful login/sign-up: sets the refresh cookie
 * and returns a short-lived access token.
 */
async function startSession(req, res, user) {
  const refreshToken = await storeNewRefreshToken(user.id, crypto.randomUUID());
  res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions(req));
  return generateToken(user);
}

/**
 * Rotates the refresh cookie and returns { user, accessToken }.
 * Throws an Error with status 401 when the session cannot be renewed.
 */
async function refreshSession(req, res) {
  const presented = req.cookies && req.cookies[REFRESH_COOKIE];
  if (typeof presented !== 'string' || presented.length < 20) throw unauthorized();

  const record = await RefreshToken.findOne({ where: { tokenHash: hashToken(presented) } });
  if (!record) {
    clearRefreshCookie(req, res);
    throw unauthorized();
  }

  const now = new Date();
  if (record.revokedAt) {
    // Rotated moments ago by a parallel request of the same browser: the new
    // cookie is already there, so just ask the client to retry.
    if (now - record.revokedAt < REUSE_GRACE_MS) throw unauthorized('Session refreshed by another request. Retry.');
    // Otherwise an old token is being replayed: assume theft, end the login.
    await revokeFamily(record.familyId);
    clearRefreshCookie(req, res);
    console.warn(`[auth] Refresh token reuse detected for user ${record.userId}; session family revoked`);
    throw unauthorized();
  }
  if (record.expiresAt <= now) {
    clearRefreshCookie(req, res);
    throw unauthorized();
  }

  const user = await User.findByPk(record.userId);
  if (!user) {
    await revokeFamily(record.familyId);
    clearRefreshCookie(req, res);
    throw unauthorized();
  }

  // Atomic rotation: only one request can revoke this token
  const [revoked] = await RefreshToken.update({ revokedAt: now }, { where: { id: record.id, revokedAt: null } });
  if (revoked === 0) throw unauthorized('Session refreshed by another request. Retry.');

  const next = await storeNewRefreshToken(user.id, record.familyId);
  res.cookie(REFRESH_COOKIE, next, cookieOptions(req));
  return { user, accessToken: generateToken(user) };
}

/** Logout: revokes the whole login (all rotations) and clears the cookie. */
async function endSession(req, res) {
  const presented = req.cookies && req.cookies[REFRESH_COOKIE];
  if (typeof presented === 'string' && presented) {
    const record = await RefreshToken.findOne({ where: { tokenHash: hashToken(presented) } });
    if (record) await revokeFamily(record.familyId);
  }
  clearRefreshCookie(req, res);
}

module.exports = {
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  REUSE_GRACE_MS,
  hashToken,
  cookieOptions,
  startSession,
  refreshSession,
  endSession,
};
