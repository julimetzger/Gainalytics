// Read-only perf instrumentation gate (GH-253).
//
// Tracks redux-persist write/hydration costs. Defaults to `__DEV__`, so
// production bundles with `__DEV__ === false` dead-code-eliminate the
// instrumentation paths. To force-disable in a dev build, set the env var
// `GAINS_DEV_PERF=0` before starting Metro.
//
// MUST stay a module-level constant so Metro / Hermes can fold the
// branches at build time. Do not turn this into a runtime setting.
declare const __DEV__: boolean;

const ENV_OFF =
  typeof process !== 'undefined' && process?.env?.GAINS_DEV_PERF === '0';

export const __DEV_PERF__: boolean = !!__DEV__ && !ENV_OFF;
