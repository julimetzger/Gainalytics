// Hermes / RN bridgeless boot-order shim — required as the very first import
// from `index.tsx` so it runs before any other module evaluates.
//
// Background: in RN 0.84 with the new architecture + bridgeless runtime, the
// metro dev bundle (served from `npm start`) ships only `__r(0)` for the entry
// module — it does NOT auto-require `Libraries/Core/InitializeCore`, so the
// runBeforeMain polyfills (`setUpGlobals` for `window`/`self`, `setUpTimers`
// for `setImmediate`/`queueMicrotask`, `setUpReactDevTools`, …) are never
// installed unless something explicitly requires InitializeCore.
//
// Modules that touch those globals at top level then crash the runtime before
// it is ready, e.g. `App.tsx`'s `LogBox.ignoreLogs([...])` triggers
// `LogBoxData.handleUpdate` → `setImmediate(...)` and Hermes throws
// "[runtime not ready]: ReferenceError: Property 'setImmediate' doesn't exist".
// `Libraries/Debugging/DebuggingOverlayRegistry` similarly reads `window.__REACT_DEVTOOLS_GLOBAL_HOOK__`
// at module top level and crashes with "Property 'window' doesn't exist".
//
// Requiring InitializeCore here forces `setUpDefaultReactNativeEnvironment` to
// run (it is idempotent — guarded by an `initialized` flag) so every global
// the rest of the bundle relies on is in place before the entry module
// continues. This is the only `react-native` deep import sanctioned by
// `@react-native/babel-preset` (see `plugin-warn-on-deep-imports.js`), exactly
// because workarounds like this one need it.
//
// The release/AAB build path goes through `createBundleDebugJsAndAssets` which
// uses the standard metro serializer and DOES auto-include InitializeCore, so
// the baked APK is unaffected — but Maestro and dev builds are.

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('react-native/Libraries/Core/InitializeCore');

export {};
