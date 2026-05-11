import type {Middleware} from 'redux';
import {perfRecorder} from './perfRecorder';

const now = (): number =>
  typeof performance !== 'undefined' && performance.now
    ? performance.now()
    : Date.now();

// Per-dispatch paint-gap probe (GH-267).
//
// Captures four timestamps per redux action so we can attribute the
// "dispatch returns ~50 ms" / "next paint at ~415 ms" gap previously
// reported in GH-253 (#260) and GH-262 (#266):
//
//   dispatch_entry_ts  : middleware enters, before next(action)
//   dispatch_return_ts : middleware exits, after next(action)
//   paint_observed_ts  : first requestAnimationFrame callback after the
//                        dispatch returns. On Hermes / RN this fires
//                        after the next React commit + native paint.
//   gap_ms             : paint_observed_ts - dispatch_return_ts
//
// Record runs only when __DEV_PERF__ is true (perfRecorder.enabled is the
// module-level gate from devPerfFlag.ts). Production builds drop the
// middleware before configureStore plumbs it in (see configureStore.ts).
export const paintGapMiddleware: Middleware = () => (next) => (action) => {
  if (!perfRecorder.enabled) {
    return next(action);
  }
  const actionType =
    typeof action === 'object' && action !== null && 'type' in action
      ? String((action as {type: unknown}).type)
      : 'unknown';
  const dispatchEntry = now();
  const result = next(action);
  const dispatchReturn = now();

  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => {
      const paintObserved = now();
      perfRecorder.recordPaintGap({
        ts: Date.now(),
        actionType,
        dispatchEntryMs: dispatchEntry,
        dispatchReturnMs: dispatchReturn,
        paintObservedMs: paintObserved,
        gapMs: paintObserved - dispatchReturn,
      });
    });
  }

  return result;
};
