// E2E tests: the real AppModule over HTTP (supertest) against the *_test database.
const base = require('./jest.config');

module.exports = {
  ...base,
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  globalSetup: '<rootDir>/test/setup/global-setup.ts',
  setupFiles: ['<rootDir>/test/setup/test-env.ts'],
};
