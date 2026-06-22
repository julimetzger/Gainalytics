// jest.config.cjs
/** @type {import('jest').Config} */
module.exports = {
  preset: 'react-native',

  rootDir: '.',
  verbose: true,

  // Let Babel handle *js, jsx, ts, tsx*
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': require.resolve('babel-jest'),
  },

  // Ensure RN deps get transformed
  transformIgnorePatterns: [
    'node_modules/(?!(react-native'
    + '|@react-native'
    + '|react-native-.*'
    + '|@react-navigation'
    + '|@shopify/flash-list'
    + '|sharingan-rn-modal-dropdown'
    + ')/)',
  ],

  testMatch: ['**/?(*.)+(spec|test).(ts|tsx|js|jsx)'],
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/coverage/'],

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // JSDOM works well with @testing-library/react-native
  testEnvironment: 'jsdom',

  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js',
    '@testing-library/jest-native/extend-expect',
  ],

  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'redux/**/*.{ts,tsx}',
    '!**/*.d.ts',
  ],
};
