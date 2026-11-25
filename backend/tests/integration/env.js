/**
 * Environment for integration tests (runs before app.js / models are loaded).
 *
 * The database comes from TEST_DB_* variables (CI) or defaults to a local
 * `awtc_test` database. .env.development is deliberately NOT loaded: these
 * tests delete every row of the database they use.
 */
process.env.NODE_ENV = 'test';
process.env.DB_HOST = process.env.TEST_DB_HOST || '127.0.0.1';
process.env.DB_PORT = process.env.TEST_DB_PORT || '3306';
process.env.DB_USER = process.env.TEST_DB_USER || 'root';
process.env.DB_PASS = process.env.TEST_DB_PASS || '';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'awtc_test';

// App configuration under test
process.env.AUTH_PROVIDER = 'local';
process.env.STORAGE_PROVIDER = 'local';
process.env.SESSION_STORE = 'memory';
process.env.TRUST_PROXY = '0';
process.env.JWT_SECRET = 'integration-tests-jwt-secret-not-for-production';
process.env.SESSION_SECRET = 'integration-tests-session-secret-not-for-production';
process.env.FRONTEND_URL = 'http://localhost:5173';
// Generous limits: the suites log in many times from the same address
process.env.LOGIN_RATE_LIMIT = '1000';
process.env.SIGNUP_RATE_LIMIT = '1000';
process.env.CONTACT_RATE_LIMIT = '1000';
delete process.env.DEMO_MODE;
delete process.env.CORS_ORIGINS;

// The push controller validates VAPID keys when it is loaded: use a
// throwaway pair generated for this run (no notification is really sent)
const webPush = require('web-push');
const vapid = webPush.generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = vapid.publicKey;
process.env.VAPID_PRIVATE_KEY = vapid.privateKey;
process.env.VAPID_EMAIL = 'tests@example.com';
