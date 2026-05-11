import type {Middleware, Store} from 'redux';
import type {Persistor} from 'redux-persist';
import {setForceSyncWrites} from '../../utils/perf/createBaseStorage';

// GH-270: skip redux-persist writes for hot-path actions in a live workout.
//
// Hot actions update Redux state in memory only. The full persist path
// (JSON.stringify of the 2 MB root blob + redux-persist throttle wait +
// MMKV native call) is removed from the user-tap critical path.
//
// Implementation choice (from the three sketched in the ticket):
//   (a) **pause/persist via redux-persist's public API** — chosen.
//   (b) Inbound transform that no-ops on hot actions — rejected, would still
//       call `_persistoid.update()` and pay the queueing cost.
//   (c) Custom storage adapter that short-circuits `setItem` — rejected, the
//       expensive `JSON.stringify(2 MB)` happens inside redux-persist's
//       `processNextKey` BEFORE `setItem`, so adapter-level skipping only
//       saves the ~16 ms MMKV native call, not the ~150 ms stringify.
//
// (a) wins because `persistor.pause()` flips `_paused` inside `persistReducer`'s
// closure, which makes `conditionalUpdate` skip `_persistoid.update()`
// entirely — no key queued, no `setInterval` armed, no serialize, no write.
//
// CRITICAL — the lastState resync.
// `persistor.pause()` skips `_persistoid.update(state)`, so `_persistoid`'s
// internal `lastState` does not advance during hot actions. If the user
// backgrounds the app after only hot actions, `persistor.flush()` would walk
// an empty `keysToProcess` queue and write nothing. To close that window we
// dispatch a synthetic `persist/REHYDRATE` action (payload undefined, key
// matching the persist config) before every safe-point flush. REHYDRATE
// routes through `persistReducer`'s REHYDRATE branch, which always calls
// `conditionalUpdate(newState)` — at that point `_paused` is false, so
// `_persistoid.update(currentState)` sees every changed slice since the last
// real write and queues them. The subsequent `persistor.flush()` then drains
// the queue synchronously and writes.
//
// Flush triggers (all wired in configureStore.ts):
//   - `FINALIZE_WORKOUT` action               — summary screen, ~400 ms ok
//   - `AppState.change !== 'active'`          — closes the swipe-away window
//   - 30 s `setInterval`                      — crash-window backup
//
// Worst-case data-loss window with the AppState/interval mitigations wired:
// ~30 s of hot-action state (between interval ticks) if the app crashes
// without ever firing the AppState transition (e.g. SIGKILL while the
// activity is still foreground-resumed). Under normal app exit (user swipes
// away, OS backgrounds the app, system reboot warning) the AppState flush
// fires first and the worst-case window collapses to ~0 ms.

export const HOT_ACTION_TYPES: ReadonlySet<string> = new Set([
  'ADD_OR_UPDATE_SET_IN_WORKOUT',
  'START_REST_TIMER',
  'UPDATE_RECORD',
  'ADD_RECORD',
  'DELETE_RECORD',
]);

export const FLUSH_ON_ACTION_TYPES: ReadonlySet<string> = new Set([
  'FINALIZE_WORKOUT',
]);

// Internal redux-persist actions; these must never count as "user dispatches"
// for the purpose of triggering pause/persist or flush.
const PERSIST_INTERNAL_PREFIX = 'persist/';

interface Attached {
  persistor: Persistor;
  store: Store;
  persistKey: string;
}

let attached: Attached | null = null;

export function attachPersistorForHotActionSkip(
  persistor: Persistor,
  store: Store,
  persistKey: string = 'root',
): void {
  attached = {persistor, store, persistKey};
}

export function detachPersistorForHotActionSkip(): void {
  attached = null;
}

export function getAttachedForTests(): Attached | null {
  return attached;
}

// Public flush entrypoint for callers outside the middleware chain (the
// AppState listener and the 30 s interval in configureStore.ts).
//
// Synchronous order: dispatch the synthetic REHYDRATE first (it routes
// through persistReducer → conditionalUpdate → _persistoid.update so every
// slice that mutated under a paused window gets queued for write), then call
// `persistor.flush()` which drains the queue synchronously through the
// same storage adapter.
export function flushHotActionState(): Promise<unknown> {
  if (attached === null) return Promise.resolve();
  const {persistor, store, persistKey} = attached;
  // Switch the storage adapter to synchronous mode for the duration of the
  // flush so the MMKV write completes inside the same synchronous frame as
  // the caller (AppState onChange, FINALIZE_WORKOUT dispatch, or 30 s
  // interval). With the default `setTimeout(0)`-deferred path, an AppState
  // background event can pause the JS bridge before the macrotask drains
  // and the write is lost.
  setForceSyncWrites(true);
  try {
    try {
      store.dispatch({
        type: 'persist/REHYDRATE',
        payload: undefined,
        err: undefined,
        key: persistKey,
      } as any);
    } catch {
      // never break the caller if dispatch throws (eg. during teardown)
    }
    try {
      return persistor.flush();
    } catch {
      return Promise.resolve();
    }
  } finally {
    setForceSyncWrites(false);
  }
}

function actionType(action: unknown): string | null {
  if (
    typeof action === 'object' &&
    action !== null &&
    'type' in action &&
    typeof (action as {type: unknown}).type === 'string'
  ) {
    return (action as {type: string}).type;
  }
  return null;
}

export const skipPersistOnHotActions: Middleware = () => (next) => (action) => {
  const a = attached;
  const type = actionType(action);

  // No persistor yet (pre-bootstrap), or non-string action type — passthrough.
  if (a === null || type === null) {
    return next(action);
  }

  // Redux-persist's own action stream (PAUSE/PERSIST/REHYDRATE/FLUSH/PURGE)
  // routes through the chain; never treat it as hot/cold for skip purposes.
  if (type.startsWith(PERSIST_INTERNAL_PREFIX)) {
    return next(action);
  }

  if (HOT_ACTION_TYPES.has(type)) {
    // Pause BEFORE next(action). PAUSE flips `_paused` in persistReducer's
    // closure synchronously; the reducer chain then runs and persistReducer's
    // conditionalUpdate skips `_persistoid.update`.
    a.persistor.pause();
    try {
      return next(action);
    } finally {
      // Resume for subsequent (cold) actions. PERSIST flips `_paused` back to
      // false. Resume itself does not queue a catch-up write; the next state
      // change after resume triggers update normally.
      a.persistor.persist();
    }
  }

  if (FLUSH_ON_ACTION_TYPES.has(type)) {
    const result = next(action);
    // Flush after the reducer has produced the post-FINALIZE state. Use the
    // public `flushHotActionState` helper so we get the REHYDRATE-resync
    // semantics even though FINALIZE itself is a cold action — between the
    // last cold action and FINALIZE, hot actions may have accumulated state
    // that `_persistoid.lastState` has not yet seen.
    flushHotActionState();
    return result;
  }

  return next(action);
};
