// Coverage over all three suites: controllers and app wiring are only exercised end to end.
const base = require('./jest.config');

module.exports = {
  ...base,
  testRegex: '(src/.*\\.(int-)?spec|test/.*\\.e2e-spec)\\.ts$',
  globalSetup: '<rootDir>/test/setup/global-setup.ts',
  setupFiles: ['<rootDir>/test/setup/test-env.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.int-spec.ts',
    '!src/**/*Module.ts',
    '!src/**/*Model.ts',
    '!src/**/*.cli.ts',
    '!src/main.ts',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: { lines: 85, branches: 80, functions: 85, statements: 85 },
  },
};
