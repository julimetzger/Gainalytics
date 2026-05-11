import {Storage} from 'redux-persist';
import type {MMKV} from 'react-native-mmkv';

// Plain MMKV-backed redux-persist storage adapter (GH-262 round-2):
// `setItem` defers the synchronous `storage.set(...)` to a `setTimeout(0)`
// macrotask and returns `Promise.resolve(true)` immediately. This pulls the
// ~10-20 ms MMKV.set out of the critical React-commit tick that follows a
// user submit, so the optimistic checkmark paints BEFORE the persist write
// runs. The trade-off is a ~16 ms crash window during which the in-memory
// state is ahead of disk; that window is closed by an AppState listener at
// the call-site (active → background/inactive triggers `persistor.flush()`).
//
// `getItem` and `removeItem` stay synchronous — `getItem` is only used
// during hydration where blocking is correct, and `removeItem` runs in
// response to slice purges where ordering matters.
//
// GH-270 — synchronous write mode for safe-point flushes.
// `setForceSyncWrites(true)` switches `setItem` from the `setTimeout(0)`
// deferred path back to a synchronous `mmkv.set`. The hot-action middleware
// (`flushHotActionState`) flips this flag on while it dispatches the
// REHYDRATE-resync + `persistor.flush()` pair on AppState
// background/inactive, FINALIZE_WORKOUT, and the 30 s interval. Without sync
// mode, the deferred `setTimeout(0)` would queue behind the activity
// `onStop` and the JS bridge can pause before the macrotask drains —
// observed on R5CN30HWZFN where HOME-key + 5 s wait would still produce a
// stale on-disk snapshot. With sync mode, MMKV is committed inside the
// same synchronous frame as the AppState change event, so a HOME press or
// SIGKILL after a hot-only cascade no longer loses the cascade state.
let forceSyncWrites = false;

export function setForceSyncWrites(on: boolean): void {
  forceSyncWrites = on;
}

export function isForceSyncWritesEnabled(): boolean {
  return forceSyncWrites;
}

export function createBaseStorage(mmkv: Pick<MMKV, 'set' | 'getString' | 'delete'>): Storage {
  return {
    setItem: (key, value) => {
      if (forceSyncWrites) {
        mmkv.set(key, value);
      } else {
        setTimeout(() => mmkv.set(key, value), 0);
      }
      return Promise.resolve(true);
    },
    getItem: (key) => {
      const value = mmkv.getString(key);
      return Promise.resolve(value);
    },
    removeItem: (key) => {
      mmkv.delete(key);
      return Promise.resolve();
    },
  };
}
