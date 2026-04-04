const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const projectRoot = "/home/jmetzger/projects/PowerliftingWorkoutPlanner/.worktrees/feature-ANA-004";
const sharedNodeModules = "/home/jmetzger/projects/PowerliftingWorkoutPlanner/node_modules";

module.exports = mergeConfig(getDefaultConfig(projectRoot), {
  projectRoot,
  watchFolders: [sharedNodeModules],
  resolver: {
    unstable_enableSymlinks: true,
    nodeModulesPaths: [path.join(projectRoot, 'node_modules'), sharedNodeModules],
  },
});
