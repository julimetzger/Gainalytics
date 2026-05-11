import {Storage} from 'redux-persist';
import {MMKV} from 'react-native-mmkv';
import {perfRecorder} from './perfRecorder';
import {isForceSyncWritesEnabled} from './createBaseStorage';

// Wraps the MMKV-backed redux-persist storage adapter and records per-call
// timing. Pure measurement: the wrapped contract still resolves the same
// promise with the same value at the same time.
//
// `value` is already a JSON string by the time redux-persist hands it to
// the adapter. We can therefore only measure MMKV native call time + size
// here — the upstream JSON.stringify cost is captured separately via the
// transform hook in createProfilingPersistConfig.
//
// GH-262 round-2: `setItem` now defers the MMKV native call via
// `setTimeout(0)` to match the production base adapter. The timing record
// is captured inside the deferred macrotask so `mmkv_ms` still reflects the
// real native cost. `bytes` is captured synchronously (cheap) but emitted
// inside the deferred record so the CSV order matches the actual write
// order on disk.
export function createProfilingStorage(mmkv: MMKV): Storage {
  return {
    setItem: (key, value) => {
      const bytes = typeof value === 'string' ? value.length : 0;
      // Synchronous tick-scratch update. `perfMiddleware` reads
      // `tickBytes` / `tickSetItemCalls` from its own deferred macrotask
      // and must see the "scheduled this tick" count regardless of when the
      // native write actually runs. We bypass `recordStorage` for the
      // synchronous side and push the CSV row from the deferred callback
      // so the `mmkv_ms` column reflects the real native call cost.
      if (perfRecorder.enabled) {
        perfRecorder.tickBytes += bytes;
        perfRecorder.tickSetItemCalls += 1;
      }
      // GH-270: when a safe-point flush has flipped sync mode on, write
      // synchronously so the bytes land BEFORE the activity onStop pauses
      // the JS bridge. See createBaseStorage.ts for the rationale.
      if (isForceSyncWritesEnabled()) {
        const start =
          typeof performance !== 'undefined' && performance.now
            ? performance.now()
            : Date.now();
        mmkv.set(key, value);
        const end =
          typeof performance !== 'undefined' && performance.now
            ? performance.now()
            : Date.now();
        if (perfRecorder.enabled) {
          perfRecorder.storage.push({
            ts: Date.now(),
            op: 'setItem',
            key,
            bytes,
            jsonMs: -1,
            mmkvMs: end - start,
            lastActionType: perfRecorder.lastActionType,
          });
        }
        return Promise.resolve(true);
      }
      setTimeout(() => {
        const start =
          typeof performance !== 'undefined' && performance.now
            ? performance.now()
            : Date.now();
        mmkv.set(key, value);
        const end =
          typeof performance !== 'undefined' && performance.now
            ? performance.now()
            : Date.now();
        if (perfRecorder.enabled) {
          perfRecorder.storage.push({
            ts: Date.now(),
            op: 'setItem',
            key,
            bytes,
            jsonMs: -1,
            mmkvMs: end - start,
            lastActionType: perfRecorder.lastActionType,
          });
        }
      }, 0);
      return Promise.resolve(true);
    },
    getItem: (key) => {
      const start =
        typeof performance !== 'undefined' && performance.now
          ? performance.now()
          : Date.now();
      const value = mmkv.getString(key);
      const end =
        typeof performance !== 'undefined' && performance.now
          ? performance.now()
          : Date.now();
      perfRecorder.recordStorage({
        ts: Date.now(),
        op: 'getItem',
        key,
        bytes: typeof value === 'string' ? value.length : 0,
        jsonMs: -1,
        mmkvMs: end - start,
        lastActionType: perfRecorder.lastActionType,
      });
      return Promise.resolve(value);
    },
    removeItem: (key) => {
      const start =
        typeof performance !== 'undefined' && performance.now
          ? performance.now()
          : Date.now();
      mmkv.delete(key);
      const end =
        typeof performance !== 'undefined' && performance.now
          ? performance.now()
          : Date.now();
      perfRecorder.recordStorage({
        ts: Date.now(),
        op: 'removeItem',
        key,
        bytes: 0,
        jsonMs: -1,
        mmkvMs: end - start,
        lastActionType: perfRecorder.lastActionType,
      });
      return Promise.resolve();
    },
  };
}
