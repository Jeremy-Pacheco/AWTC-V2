/**
 * Parses an "Authorization: Basic <base64>" header (BUG-03).
 *
 * - Decodes as UTF-8, so passwords with "ñ", accents or emoji survive
 *   (the frontend encodes them with TextEncoder before btoa).
 * - Splits on the FIRST ":" only: RFC 7617 forbids ":" in the user id,
 *   but passwords may contain it.
 *
 * Returns { email, password } or null when the header is missing/malformed.
 */
function parseBasicAuth(header) {
  if (typeof header !== 'string' || !header.startsWith('Basic ')) return null;
  const decoded = Buffer.from(header.slice('Basic '.length).trim(), 'base64').toString('utf8');
  const separator = decoded.indexOf(':');
  if (separator <= 0) return null;
  const email = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);
  if (!password) return null;
  return { email, password };
}

module.exports = { parseBasicAuth };
