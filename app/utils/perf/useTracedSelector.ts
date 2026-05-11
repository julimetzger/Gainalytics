import {useSelector} from 'react-redux';
import {__DEV_PERF__} from './devPerfFlag';
import {perfRecorder} from './perfRecorder';

const now = (): number =>
  typeof performance !== 'undefined' && performance.now
    ? performance.now()
    : Date.now();

// Wraps `useSelector` so we can attribute time to a named selector during
// the GH-267 dispatch cascade. The wrapper times the inner selector call
// and pushes a SelectorRecord; behaviour and equality semantics are
// identical to plain `useSelector(fn)`.
//
// Production builds short-circuit to plain `useSelector` and drop the
// recorder import via the __DEV_PERF__ gate.
export function useTracedSelector<TState, TResult>(
  name: string,
  selector: (state: TState) => TResult,
): TResult {
  if (!__DEV_PERF__ || !perfRecorder.enabled) {
    return useSelector(selector);
  }
  return useSelector((state: TState) => {
    const t0 = now();
    const result = selector(state);
    const t1 = now();
    perfRecorder.recordSelector({
      ts: Date.now(),
      name,
      ms: t1 - t0,
      lastActionType: perfRecorder.lastActionType,
    });
    return result;
  });
}
