// jest.config.cjs
const path = require('path');

// -> Pfad zum Paket-Root von react-native (enthält jest-preset.js)
const rnPresetDir = path.dirname(require.resolve('react-native/package.json'));

/** @type {import('jest').Config} */
module.exports = {
    preset: rnPresetDir, // <— WICHTIG: ein Verzeichnis, nicht die Datei

    rootDir: '.',
    verbose: true,

    transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
        '^.+\\.(js|jsx)$': require.resolve('babel-jest'),
    },
    transformIgnorePatterns: [
        'node_modules/(?!(react-native|@react-native|react-native-.*|@react-navigation|@shopify/flash-list|sharingan-rn-modal-dropdown)/)',
    ],

    testMatch: ['**/__tests__/**/*.@(spec|test).@(ts|tsx|js|jsx)'],
    testPathIgnorePatterns: ['/node_modules/', '/__tests__/coverage/'],

    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

    // Für @testing-library/react-native
    testEnvironment: 'jsdom',

    setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],

    collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        'redux/**/*.{ts,tsx}',
        '!**/*.d.ts',
    ],
};
