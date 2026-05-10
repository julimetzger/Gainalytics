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
export function createBaseStorage(mmkv: Pick<MMKV, 'set' | 'getString' | 'delete'>): Storage {
  return {
    setItem: (key, value) => {
      setTimeout(() => mmkv.set(key, value), 0);
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
