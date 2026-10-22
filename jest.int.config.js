// Integration tests: *.int-spec.ts against the migrated *_test database.
const base = require('./jest.config');

module.exports = {
  ...base,
  testRegex: '(src|seeds)/.*\\.int-spec\\.ts$',
  globalSetup: '<rootDir>/test/setup/global-setup.ts',
  setupFiles: ['<rootDir>/test/setup/test-env.ts'],
};
