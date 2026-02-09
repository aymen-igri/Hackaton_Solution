module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/db/**',
    '!src/queue/**', // Queues tested via integration tests
  ],
  testMatch: [
    '**/tests/**/*.test.js',
  ],
  coverageThreshold: {
    global: {
      branches: 30,
      functions: 30,
      lines: 30,
      statements: 30,
    },
  },
  testTimeout: 15000,
  verbose: true,
  // Ensure mocks are reset between tests
  clearMocks: true,
  resetMocks: true,
  // Handle async operations properly
  detectOpenHandles: false,
  forceExit: true,
};

