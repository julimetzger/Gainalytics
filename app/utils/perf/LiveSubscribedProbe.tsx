import React from 'react';
import {Text, View} from 'react-native';
import {DevPerfProfiler} from './DevPerfProfiler';
import {useTracedSelector} from './useTracedSelector';
import {oneRepMaxForWorkouts} from '../AnalyseUtils';

// GH-267 measurement aid. NEVER rendered in production builds.
//
// A small subtree that subscribes to the workouts slice via several
// real-shape selectors so a synthetic ADD_OR_UPDATE_SET_IN_WORKOUT cascade
// from SettingsTab actually triggers a React commit on a subscriber tree
// (the way the live-training screen would). Without this probe the synthetic
// "Run 5 Submits" button only measures the dispatch + persist + Settings
// commit, never the workouts-slice subscriber re-render that dominates the
// real user flow.
//
// The selectors mirror the access patterns of the real hot hooks
// (useWorkoutById, useUnfinishedWorkout, useAllTimeOneRepMax,
// useLastFinishedWorkoutsByExerciseIds, useSettings) so the per-call CSV
// rows are representative.
export const LiveSubscribedProbe: React.FC = () => {
  // 1) Settings — small object, used by virtually every screen
  const restTimer = useTracedSelector('settings.restTimer', (s: any) =>
    s?.settings?.restTimer ?? null,
  );

  // 2) First-exercise id (proxy for chosenExercise.id)
  const exerciseId = useTracedSelector(
    'exercises.allIds[0]',
    (s: any) => s?.exercises?.allIds?.[0],
  );

  // 3) byExerciseId list for that exercise — same pattern as
  //    useAllTimeOneRepMax / useLastFinishedWorkoutsByExerciseIds
  const workoutIds = useTracedSelector(
    'workouts.byExerciseId[id]',
    (s: any) => (exerciseId !== undefined ? s?.workouts?.byExerciseId?.[exerciseId] ?? [] : []),
  );

  // 4) Resolve the most-recent workout — same pattern as useWorkoutById
  const lastWorkoutId = Array.isArray(workoutIds) && workoutIds.length > 0
    ? workoutIds[workoutIds.length - 1]
    : undefined;
  const lastWorkout = useTracedSelector(
    'workouts.byId[lastId]',
    (s: any) => (lastWorkoutId !== undefined ? s?.workouts?.byId?.[lastWorkoutId] : undefined),
  );

  // 5) Walk the byExerciseId list and compute an aggregate — same shape
  //    as useAllTimeOneRepMax (1RM over every workout for an exercise).
  const allTimeOneRm = useTracedSelector('useAllTimeOneRepMax-like', (s: any) => {
    if (exerciseId === undefined) return 0;
    const ids: number[] = s?.workouts?.byExerciseId?.[exerciseId] ?? [];
    if (ids.length === 0) return 0;
    const workouts = ids
      .map((id) => s?.workouts?.byId?.[id])
      .filter((w: any) => w !== undefined && w?.end !== undefined);
    if (workouts.length === 0) return 0;
    return oneRepMaxForWorkouts(...(workouts as any[]));
  });

  return (
    <DevPerfProfiler id="live-subscribed-probe">
      <View
        // eslint-disable-next-line react-native/no-inline-styles
        style={{padding: 8, marginHorizontal: 10, borderColor: '#888', borderWidth: 1, borderRadius: 4, marginVertical: 4}}
        testID="gh267-live-probe-root">
        <Text>
          GH-267 Live-Subscribed Probe • workouts={Array.isArray(workoutIds) ? workoutIds.length : 0} • lastSets={lastWorkout?.sets?.length ?? 0} • 1RM={allTimeOneRm.toFixed(1)} • rest={restTimer?.active ? 'on' : 'off'}
        </Text>
      </View>
    </DevPerfProfiler>
  );
};
