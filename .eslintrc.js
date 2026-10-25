module.exports = {
  root: true,
  // `@react-native-community/eslint-config` was renamed to `@react-native/eslint-config`
  // (same rule set, versioned with react-native itself).
  extends: '@react-native',
  ignorePatterns: ['node_modules/', 'android/', 'ios/', '__tests__/coverage/', '__tests__/reports/'],
  overrides: [
    {
      // Jest globals in the setup file and in test files outside __tests__/ folders.
      files: ['jest.setup.js', '**/*.spec.*', '**/*.test.*', '**/__tests__/**'],
      env: {jest: true},
    },
    {
      // Plain Node scripts (fixture generators, e2e helpers, config files).
      files: ['**/scripts/**/*.js', '*.config.js', '*.config.cjs', 'babel-jest.js'],
      env: {node: true},
    },
  ],
};
