import {Storage} from 'redux-persist';
import {MMKV} from 'react-native-mmkv';
import {perfRecorder} from './perfRecorder';

// Wraps the MMKV-backed redux-persist storage adapter and records per-call
// timing. Pure measurement: the wrapped contract still resolves the same
// promise with the same value at the same time.
//
// `value` is already a JSON string by the time redux-persist hands it to
// the adapter. We can therefore only measure MMKV native call time + size
// here — the upstream JSON.stringify cost is captured separately via the
// transform hook in createProfilingPersistConfig.
export function createProfilingStorage(mmkv: MMKV): Storage {
  return {
    setItem: (key, value) => {
      const start =
        typeof performance !== 'undefined' && performance.now
          ? performance.now()
          : Date.now();
      mmkv.set(key, value);
      const end =
        typeof performance !== 'undefined' && performance.now
          ? performance.now()
          : Date.now();
      perfRecorder.recordStorage({
        ts: Date.now(),
        op: 'setItem',
        key,
        bytes: typeof value === 'string' ? value.length : 0,
        jsonMs: -1,
        mmkvMs: end - start,
        lastActionType: perfRecorder.lastActionType,
      });
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
