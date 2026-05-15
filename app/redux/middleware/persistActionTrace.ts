import {Middleware} from 'redux';

/**
 * Dev-only control-measurement middleware (GH-288, à la GH-279).
 *
 * Logs every `persist/*` action plus every `ADD_OR_UPDATE_SET_IN_WORKOUT`
 * dispatch with a running counter, readable via `adb logcat`. The purpose is
 * a control measurement: confirm that adding a set in live training does NOT
 * pull in any `persist/*` noise (the GH-279 finding — the old REHYDRATE storm
 * was an instrumentation artefact, not a master bug).
 *
 * It is gated on `__DEV__` for the log call and is only wired into the store
 * middleware array for `NODE_ENV === 'development'` (see `configureStore.ts`),
 * so production bundles never even construct it.
 */
let traceCount = 0;

export const persistActionTrace: Middleware = () => next => action => {
  if (__DEV__ && typeof action?.type === 'string') {
    if (action.type.startsWith('persist/')) {
      traceCount += 1;
      // eslint-disable-next-line no-console
      console.log(`[PERSIST_TRACE] #${traceCount} ${action.type} @${Date.now()}`);
    } else if (action.type === 'ADD_OR_UPDATE_SET_IN_WORKOUT') {
      traceCount += 1;
      // eslint-disable-next-line no-console
      console.log(`[PERSIST_TRACE] #${traceCount} ${action.type} @${Date.now()}`);
    }
  }
  return next(action);
};
