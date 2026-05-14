// GH-279 (read-only perf diagnostic): trace every redux-persist action
// (type starts with "persist/") with a timestamp and a running counter so
// the per-cascade REHYDRATE/PERSIST/FLUSH/PAUSE counts can be read straight
// out of `adb logcat | grep PERSIST_TRACE` on a clean master build.
//
// Dev-only: gated on `__DEV__`, so production bundles get a plain passthrough.
// Independent of the `app/utils/perf/` instrumentation stack on purpose —
// the whole point of the ticket is to measure the *unmodified* persist path.
//
// Typed loosely (action: any) on purpose, to stay assignable next to the
// existing `redux-logger` entry in configureStore's middleware array.
let persistActionCount = 0;

export const persistActionTrace =
  (_store: any) => (next: (action: any) => any) => (action: any) => {
    if (__DEV__) {
      const type = action?.type;
      if (typeof type === 'string' && type.startsWith('persist/')) {
        persistActionCount += 1;
        console.log(`[PERSIST_TRACE] #${persistActionCount} ${type} @ ${Date.now()}`);
      }
    }
    return next(action);
  };
