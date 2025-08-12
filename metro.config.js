const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
    resolver: {
        // Optimierungen für bessere Performance
        enableGlobalPackages: true,
        unstable_enableSymlinks: true,
    },
    transformer: {
        // Babel-Optimierungen
        minifierConfig: {
            keep_fnames: true,
            mangle: {
                keep_fnames: true,
            },
        },
    },
    // Bundle-Optimierungen
    maxWorkers: 2,
    resetCache: false,
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
