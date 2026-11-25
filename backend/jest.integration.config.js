/**
 * Integration tests: the real Express app (app.js) against a real MySQL
 * database that is WIPED between suites. See tests/integration/README.md.
 *
 *   pnpm test:integration
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
  // Environment is set before any module (app, models) is loaded
  setupFiles: ['<rootDir>/tests/integration/env.js'],
  testTimeout: 30000,
  // One database for all suites: never run them in parallel
  maxWorkers: 1,
};
