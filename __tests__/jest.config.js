module.exports = {
    preset: 'react-native',
    setupFiles: ['../node_modules/@testing-library/jest-native/extend-expect'],
    transform: {
        '^.+\\.jsx?$': '../babel-jest.js',
    },
    transformIgnorePatterns: [
        '../node_modules/(?!(@react-native|react-native)/)',
    ],
};
