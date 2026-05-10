import type {Middleware} from 'redux';
import {perfRecorder} from './perfRecorder';

const now = (): number =>
  typeof performance !== 'undefined' && performance.now
    ? performance.now()
    : Date.now();

// Records, per dispatch:
//   - reducerMs: synchronous reducer/dispatch wall time
//   - totalMs:   reducer time + the immediate next macrotask, which is
//                the slot where redux-persist debounces its setItem.
//                bytesWrittenInTick captures every payload written between
//                dispatch entry and the macrotask boundary.
//
// The setTimeout(0) callback charges ~ one macrotask of overhead per
// dispatch — only enabled when __DEV_PERF__ is true at module-load time.
export const perfMiddleware: Middleware = () => (next) => (action) => {
  const actionType =
    typeof action === 'object' && action !== null && 'type' in action
      ? String((action as {type: unknown}).type)
      : 'unknown';
  perfRecorder.noteAction(actionType);
  perfRecorder.resetTick();

  const t0 = now();
  const result = next(action);
  const t1 = now();

  // Capture tick scratch synchronously — setTimeout(0) callbacks queue
  // behind redux-persist's setItem, so we add a macrotask to give the
  // adapter time to land.
  setTimeout(() => {
    const t2 = now();
    perfRecorder.recordDispatch({
      ts: Date.now(),
      actionType,
      reducerMs: t1 - t0,
      totalMs: t2 - t0,
      bytesWrittenInTick: perfRecorder.tickBytes,
      setItemCallsInTick: perfRecorder.tickSetItemCalls,
      hardSetCount: perfRecorder.tickHardSet,
    });
  }, 0);

  return result;
};
