/**
 * HTTP security headers (AUDIT_REPORT.md, SEC-23) with helmet.
 *
 * Content-Security-Policy:
 *  - Scripts: only this origin plus inline <script> blocks that carry the
 *    per-request nonce (res.locals.cspNonce). No inline event handlers
 *    (onclick=, onerror=) and no third-party scripts: d3 is served from
 *    /vendor/d3 out of node_modules.
 *  - Styles: this origin, Font Awesome (cdnjs) and Google Fonts. Inline
 *    styles stay allowed: the views use many style="" attributes and the
 *    risk of style injection is far lower than script injection.
 *  - Images: this origin, data:/blob: and Cloudinary (uploaded images).
 *  - The page cannot be framed (clickjacking), no plugins, forms only post
 *    to this origin.
 *
 * Environment:
 *  - CSP_CONNECT_SRC=https://api.example.com,wss://api.example.com -> extra
 *                             origins for fetch/websockets (default: same origin).
 *  - CSP_REPORT_ONLY=true  -> send Content-Security-Policy-Report-Only to
 *                             try the policy without blocking anything.
 *  - SESSION_COOKIE_SECURE=true (HTTPS deployments) also enables
 *    upgrade-insecure-requests; it stays off on local HTTP.
 */
const crypto = require('crypto');
const helmet = require('helmet');

/** Generates a fresh nonce for every response; views read res.locals.cspNonce. */
function cspNonce(req, res, next) {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
}

/** Comma-separated list of origins -> array (ignores blanks and quotes). */
function extraOrigins(value) {
  return String(value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => /^(https?|wss?):\/\/[^\s'";]+$/i.test(origin));
}

function buildCspDirectives({ upgradeInsecureRequests }) {
  return {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
    scriptSrcAttr: ["'none'"],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com', 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'data:', 'https://cdnjs.cloudflare.com', 'https://fonts.gstatic.com'],
    imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
    // 'self' covers fetch() and the same-origin Socket.IO websocket;
    // CSP_CONNECT_SRC adds API/websocket origins when they live elsewhere
    connectSrc: ["'self'", ...extraOrigins(process.env.CSP_CONNECT_SRC)],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    frameAncestors: ["'none'"],
    upgradeInsecureRequests: upgradeInsecureRequests ? [] : null,
  };
}

/**
 * @param {{ httpsOnly: boolean }} options httpsOnly: the app is only reached over HTTPS
 */
function securityHeaders({ httpsOnly }) {
  const reportOnly = String(process.env.CSP_REPORT_ONLY || '').toLowerCase() === 'true';
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: buildCspDirectives({ upgradeInsecureRequests: httpsOnly && !reportOnly }),
      reportOnly,
    },
    // Images under /images are loaded by the SPA from another origin (Vercel)
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // HSTS only means something over HTTPS; browsers ignore it on plain HTTP
    strictTransportSecurity: httpsOnly ? { maxAge: 15552000, includeSubDomains: true } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });
}

module.exports = { cspNonce, securityHeaders, buildCspDirectives };
