import React from 'react';

/**
 * Dev-only render-time instrumentation (GH-288).
 *
 * Wraps a subtree in `<React.Profiler>` and logs every commit's
 * `id / phase / actualDuration / baseDuration` via `console.log` (visible in
 * `adb logcat` as `ReactNativeJS`). In production this is a transparent
 * pass-through — `React.Profiler` is only mounted under `__DEV__`, so the
 * shipped bundle carries zero profiling overhead.
 *
 * This is intentionally NOT the old `app/utils/perf/*` stack — it is a single
 * ~25-line component with no global state, no overlay and no store coupling.
 */
const onRender: React.ProfilerOnRenderCallback = (id, phase, actualDuration, baseDuration) => {
  // eslint-disable-next-line no-console
  console.log(
    `[PROFILER] id=${id} phase=${phase} actual=${actualDuration.toFixed(3)} base=${baseDuration.toFixed(3)} @${Date.now()}`,
  );
};

interface Props {
  id: string;
  children: React.ReactNode;
}

const RenderProfiler = ({id, children}: Props) => {
  if (!__DEV__) {
    return <>{children}</>;
  }
  return (
    <React.Profiler id={id} onRender={onRender}>
      {children}
    </React.Profiler>
  );
};

export default RenderProfiler;
