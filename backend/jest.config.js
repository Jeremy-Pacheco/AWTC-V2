module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js', '**/*.test.js'],
  collectCoverageFrom: [
    'models/**/*.js',
    'controllers/**/*.js',
    '!tests/**',
    '!node_modules/**'
  ],
  testTimeout: 10000,
  // Integration tests need MySQL: run them with `pnpm test:integration`
  testPathIgnorePatterns: ['/node_modules/', '/tests/integration/'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js']
};
