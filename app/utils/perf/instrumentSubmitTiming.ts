import {__DEV_PERF__} from './devPerfFlag';
import {perfRecorder} from './perfRecorder';

const now = (): number =>
  typeof performance !== 'undefined' && performance.now
    ? performance.now()
    : Date.now();

// Wraps a submit-button onPress callback so we capture user-perceived latency
// per tap (GH-262):
//   t0  → onPress entry, captured synchronously before fn() runs
//   t1  → setTimeout(0): JS thread free again after the synchronous redux
//         dispatch cascade + the immediate persist debounce settles
//   t2  → requestAnimationFrame: the next React commit/paint after fn(), i.e.
//         the frame on which the optimistic checkmark becomes visible
//
// Production builds dead-code-eliminate the entire wrapper because
// __DEV_PERF__ is a module-level constant gated on __DEV__.
export function instrumentSubmitTiming(label: string, fn: () => void): void {
  if (!__DEV_PERF__ || !perfRecorder.enabled) {
    fn();
    return;
  }
  const t0 = now();
  let t1Ms: number | null = null;
  let t2Ms: number | null = null;
  const finalize = () => {
    if (t1Ms !== null && t2Ms !== null) {
      perfRecorder.recordSubmit({
        ts: Date.now(),
        label,
        t1MinusT0Ms: t1Ms,
        t2MinusT0Ms: t2Ms,
      });
    }
  };
  fn();
  setTimeout(() => {
    t1Ms = now() - t0;
    finalize();
  }, 0);
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => {
      t2Ms = now() - t0;
      finalize();
    });
  } else {
    // Fallback on environments without rAF (Node test runner): treat t2 == t1.
    setTimeout(() => {
      t2Ms = now() - t0;
      finalize();
    }, 0);
  }
}
