/**
 * CSRF protection for the EJS admin dashboard (cookie-authenticated forms).
 *
 * Signed double-submit token: a random token is stored in a signed, httpOnly,
 * SameSite=Strict cookie and echoed in a hidden `_csrf` form field. A POST is
 * accepted only if both match. A cross-site page cannot read the cookie, and a
 * cookie injected from a sibling subdomain fails the signature check
 * (cookie-parser must be initialised with a secret).
 *
 * The JSON API does not need this: it only accepts Bearer tokens, which the
 * browser never attaches automatically.
 */
const crypto = require('crypto');

const CSRF_COOKIE = 'awtc.csrf';
const CSRF_FIELD = '_csrf';
const TOKEN_BYTES = 32;

function cookieOptions(req) {
  const secure = req.app.get('sessionCookieSecure');
  return {
    httpOnly: true,
    sameSite: 'strict',
    signed: true,
    secure: secure === 'auto' ? req.secure : Boolean(secure),
    path: '/',
  };
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

/** Returns the current token, issuing a new cookie when there is none. */
function getOrIssueToken(req, res) {
  const existing = req.signedCookies && req.signedCookies[CSRF_COOKIE];
  if (typeof existing === 'string' && existing.length === TOKEN_BYTES * 2) return existing;
  const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  res.cookie(CSRF_COOKIE, token, cookieOptions(req));
  return token;
}

/**
 * Makes `csrfToken` available to every EJS view (including error re-renders
 * of POST forms). Mount it for the dashboard (non-API) routes only.
 */
function provideCsrfToken(req, res, next) {
  res.locals.csrfToken = getOrIssueToken(req, res);
  next();
}

/** Rejects state-changing requests whose `_csrf` field does not match the cookie. */
function verifyCsrfToken(req, res, next) {
  const cookieToken = req.signedCookies && req.signedCookies[CSRF_COOKIE];
  const bodyToken = req.body && req.body[CSRF_FIELD];
  if (safeEqual(cookieToken, bodyToken)) return next();

  return res.status(403).render('login', {
    error: 'Your session form expired. Please try again.',
    email: '',
    frontendUrl: req.app.locals.frontendUrl,
  });
}

module.exports = {
  CSRF_COOKIE,
  CSRF_FIELD,
  provideCsrfToken,
  verifyCsrfToken,
};
