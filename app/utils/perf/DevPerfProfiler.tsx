import React, {Profiler, ProfilerOnRenderCallback, ReactNode} from 'react';
import {__DEV_PERF__} from './devPerfFlag';
import {perfRecorder} from './perfRecorder';

// React.Profiler wrapper for GH-267 render-time profiling.
//
// In production builds (`__DEV_PERF__ === false`) this collapses to a
// fragment so React adds zero work and zero ProfilerNode allocations.
// In dev/perf builds every commit calls the recorder and pushes a
// RenderRecord into the in-memory buffer, dumped to CSV via the existing
// SettingsTab "Dump Perf CSV" button.
const onRender: ProfilerOnRenderCallback = (
  id,
  phase,
  actualDuration,
  baseDuration,
  startTime,
  commitTime,
) => {
  perfRecorder.recordRender({
    ts: Date.now(),
    id,
    phase,
    actualDuration,
    baseDuration,
    startTime,
    commitTime,
    lastActionType: perfRecorder.lastActionType,
  });
};

interface Props {
  id: string;
  children: ReactNode;
}

export const DevPerfProfiler: React.FC<Props> = ({id, children}) => {
  if (!__DEV_PERF__) return <>{children}</>;
  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  );
};
