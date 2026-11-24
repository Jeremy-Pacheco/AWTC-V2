/**
 * Single source of truth for allowed browser origins (REST API + Socket.IO).
 *
 * - CORS_ORIGINS: comma-separated list of exact origins, e.g.
 *     CORS_ORIGINS=https://awtc.vercel.app,https://www.awilltochange.me
 *   When set, it REPLACES the default list below.
 * - FRONTEND_URL is always allowed as well.
 *
 * Origins must match exactly (scheme + host + port, no trailing slash).
 */

// Previous hardcoded list, kept as the default so existing setups keep working.
const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:8080',
  'https://localhost:5173',
  'https://localhost:8443',
  'http://209.97.187.131:5173',
  'http://209.97.187.131:8080',
  'https://209.97.187.131',
  'http://awilltochange.me:5173',
  'http://awilltochange.me:8080',
  'https://awilltochange.me:5173',
  'https://awilltochange.me:8443',
  'http://awilltochange.me',
  'https://awilltochange.me',
  'http://www.awilltochange.me',
  'https://www.awilltochange.me',
  'https://awtc.com',
  'https://www.awtc.com',
];

const normalize = (origin) => origin.trim().replace(/\/+$/, '');

function getAllowedOrigins() {
  const fromEnv = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(normalize)
    .filter(Boolean);

  const base = fromEnv.length > 0 ? fromEnv : DEFAULT_ORIGINS;
  const frontendUrl = process.env.FRONTEND_URL ? [normalize(process.env.FRONTEND_URL)] : [];

  return [...new Set([...base, ...frontendUrl])];
}

/**
 * Origin check usable by both `cors` and Socket.IO.
 * Requests without an Origin header (curl, server-to-server, same-origin
 * navigation) are allowed; browsers always send it on cross-origin requests.
 */
function isOriginAllowed(origin) {
  if (!origin) return true;
  return getAllowedOrigins().includes(normalize(origin));
}

function corsOriginCallback(origin, callback) {
  if (isOriginAllowed(origin)) return callback(null, true);
  console.warn(`CORS blocked origin: ${origin}`);
  return callback(new Error('Not allowed by CORS'));
}

module.exports = { getAllowedOrigins, isOriginAllowed, corsOriginCallback, DEFAULT_ORIGINS };
