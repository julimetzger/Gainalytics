import React, {createContext, useContext, useEffect, useState} from 'react';

/**
 * PERF-003: builds a screen's content over a few commits instead of one.
 *
 * Mounting a whole sub-tab (300+ native views) in a single commit costs one ~50 ms frame on the
 * device — three dropped frames right when a swipe snaps in or a tab is tapped. `ProgressiveMount`
 * hands its subtree a stage counter that climbs from 0 to `stages - 1`, one step per
 * {@link PROGRESSIVE_STAGE_MS}; parts of the content gate themselves on it ({@link Stage},
 * {@link useProgressiveLimit}), so every commit only adds a slice of the views.
 *
 * Outside a `ProgressiveMount` the stage is Infinity: everything renders at once (tests, every other
 * screen that shows the same components).
 */
const StageContext = createContext<number>(Infinity);

/** One frame at 60 Hz: the next stage is rendered right after the previous one has been handed to the screen. */
export const PROGRESSIVE_STAGE_MS = 16;

export const ProgressiveMount = ({children, stages = 5}: {children: React.ReactNode; stages?: number}) => {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (stage >= stages - 1) {
      return;
    }
    const timer = setTimeout(() => setStage((current) => current + 1), PROGRESSIVE_STAGE_MS);
    return () => clearTimeout(timer);
  }, [stage, stages]);
  // GH-418: the last stage renders EVERYTHING. Handing out the stage number there
  // capped every progressive list for good — useProgressiveLimit(2) at most
  // 2 + 4 × 2 = 10 items — so the 11th exercise of a plan never appeared in the
  // plan's read view (and a reordered exercise moved there seemed to vanish).
  return <StageContext.Provider value={stage >= stages - 1 ? Infinity : stage}>{children}</StageContext.Provider>;
};

/** The current stage; Infinity when not inside a {@link ProgressiveMount}. */
export const useMountStage = () => useContext(StageContext);

/**
 * How many items of a list to render now: `first` from stage `fromStage` on, then `step` more per stage
 * (0 before `fromStage`). Infinity = all, i.e. when not inside a {@link ProgressiveMount}.
 */
export const useProgressiveLimit = (first: number, step: number = first, fromStage: number = 0) => {
  const stage = useMountStage();
  if (stage === Infinity) {
    return Infinity;
  }
  return stage < fromStage ? 0 : first + (stage - fromStage) * step;
};

/** Renders its children from stage `at` on. */
export const Stage = ({at, children}: {at: number; children: React.ReactNode}) => {
  const stage = useMountStage();
  return stage >= at ? <>{children}</> : null;
};
