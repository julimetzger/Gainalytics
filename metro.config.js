const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
// Resolve the real path for node_modules (follows symlinks from worktrees)
const nodeModulesPath = path.resolve(__dirname, 'node_modules');
const realNodeModulesPath = require('fs').realpathSync(nodeModulesPath);

const config = {
  watchFolders: [realNodeModulesPath],
  resolver: {
    nodeModulesPaths: [nodeModulesPath, realNodeModulesPath],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
