const path = require('path');
const env = process.env.NODE_ENV || 'development';
require('dotenv').config({ path: path.resolve(__dirname, `../.env.${env}`) });

/**
 * Rebuilds PEM certificates from however the value was pasted into a hosting
 * panel: real newlines, literal "\n", newlines turned into spaces, or the
 * base64 body without line breaks. Returns null if no certificate is found.
 */
function normalizePem(value) {
  const text = String(value || '').replace(/\\n/g, '\n');
  const blocks = text.match(/-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/g);
  if (!blocks) return null;
  return blocks.map((block) => {
    const body = block
      .replace('-----BEGIN CERTIFICATE-----', '')
      .replace('-----END CERTIFICATE-----', '')
      .replace(/[^A-Za-z0-9+/=]/g, '');
    const lines = body.match(/.{1,64}/g) || [];
    return ['-----BEGIN CERTIFICATE-----', ...lines, '-----END CERTIFICATE-----'].join('\n');
  }).join('\n') + '\n';
}

/**
 * DB_SSL=true enables TLS. With DB_SSL_CA (the provider's CA certificate in
 * PEM, e.g. Aiven's ca.pem) the server certificate is verified; without it the
 * connection is encrypted but not authenticated. An unusable DB_SSL_CA stops
 * the app with a clear error instead of a cryptic TLS failure.
 */
function sslOptions() {
  if (process.env.DB_SSL !== 'true') return false;
  const raw = process.env.DB_SSL_CA;
  if (raw && raw.trim()) {
    const ca = normalizePem(raw);
    if (!ca) {
      throw new Error('[config] DB_SSL_CA does not contain a PEM certificate (-----BEGIN CERTIFICATE----- ... -----END CERTIFICATE-----).');
    }
    return { ca, rejectUnauthorized: true };
  }
  return { rejectUnauthorized: false };
}

module.exports = {
  development: {
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || null,
    database: process.env.DB_NAME || 'database_development',
    host: process.env.DB_HOST || '127.0.0.1',
    dialect: 'mysql'
  },
  // Integration tests WIPE this database: it must be a dedicated one
  // (tests/integration/helpers.js refuses names without "test").
  test: {
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || null,
    database: process.env.DB_NAME || 'awtc_test',
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false // Disable logging in tests
  },
  production: {
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
    dialectOptions: {
      ssl: sslOptions()
    }
  }
};

// Exposed for tests
module.exports.normalizePem = normalizePem;
