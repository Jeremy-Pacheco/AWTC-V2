const path = require('path');
const env = process.env.NODE_ENV || 'development';
require('dotenv').config({ path: path.resolve(__dirname, `../.env.${env}`) });

/**
 * DB_SSL=true enables TLS. With DB_SSL_CA (the provider's CA certificate in
 * PEM, e.g. Aiven's ca.pem; literal "\n" escapes are accepted) the server
 * certificate is verified; without it the connection is encrypted but not
 * authenticated.
 */
function sslOptions() {
  if (process.env.DB_SSL !== 'true') return false;
  const ca = process.env.DB_SSL_CA;
  if (ca && ca.trim()) return { ca: ca.replace(/\\n/g, '\n'), rejectUnauthorized: true };
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
