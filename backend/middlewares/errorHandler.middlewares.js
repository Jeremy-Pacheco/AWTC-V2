const logger = require('../utils/logger');

/**
 * Centralised error handling.
 * - Logs the full error server-side.
 * - Never sends stack traces, SQL or internal messages to the client.
 */

// 404 for unknown API routes (JSON instead of the SPA's index.html)
function apiNotFound(req, res) {
  res.status(404).json({ message: 'Not found' });
}

// Express error handler: must keep the 4-argument signature
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Malformed JSON body or payload too large (body-parser)
  if (err && (err.type === 'entity.parse.failed' || err.type === 'entity.too.large')) {
    return res.status(err.status || 400).json({ message: 'Invalid request body' });
  }

  // CORS rejection from the cors() origin callback
  if (err && err.message === 'Not allowed by CORS') {
    return res.status(403).json({ message: 'Origin not allowed' });
  }

  const status = Number.isInteger(err && err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  logger.error(`${req.method} ${req.originalUrl} -> ${status}: ${err && err.stack ? err.stack : err}`);

  if (res.headersSent) return;

  // Only expose a message for explicit client errors (4xx) raised on purpose
  const message = status < 500 && err && err.expose ? err.message : 'Internal server error';
  res.status(status).json({ message });
}

module.exports = { apiNotFound, errorHandler };
