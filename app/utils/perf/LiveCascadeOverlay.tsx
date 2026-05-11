import React, {useContext} from 'react';
import {Alert, Pressable, StyleSheet, Text, View} from 'react-native';
import {ReactReduxContext} from 'react-redux';
import {__DEV_PERF__} from './devPerfFlag';
import {instrumentSubmitTiming} from './instrumentSubmitTiming';
import {dumpPerfCsv} from './dumpPerfCsv';
import {perfRecorder} from './perfRecorder';

interface Props {
  workoutId?: number;
  exerciseId?: number;
}

// GH-272 floating debug overlay. Mounted at the top of <ExecuteTraining> when
// __DEV_PERF__ is on. Tiny 40×40 Pressable in the top-right corner with a
// minimal hit-box so it does not intercept taps on the real submit button or
// other ExecuteTraining controls. Dispatches the exact same cascade as the
// Settings 'Run 5' button (ADD_OR_UPDATE_SET_IN_WORKOUT + START_REST_TIMER,
// 5×, ~4s apart) but fires it WHILE the user is on the live-training screen
// so the React.Profiler wrappers around the real <ExecuteTraining> subtree
// are guaranteed to observe the resulting commits. CSV is auto-dumped at +22s.
export const LiveCascadeOverlay: React.FC<Props> = ({workoutId, exerciseId}) => {
  // useContext directly so the component is safe to render in unit tests that
  // do not wrap the tree in a <Provider> (returns null instead of throwing).
  const ctx = useContext(ReactReduxContext);
  if (!__DEV_PERF__) return null;
  if (!ctx || !ctx.store) return null;
  const store = ctx.store;

  // Resolve the workout lazily at tap time. Render the button unconditionally
  // (when __DEV_PERF__) so it is visible the moment <ExecuteTraining> mounts,
  // even before the first set lands a real notFinishedWorkouts entry. Falls
  // back to the FIRST exercise's most-recent workout if no workout is bound to
  // the currently chosen exercise, mirroring the Settings 'Run 5' fallback so
  // the cascade always lands on a real workout in the store.
  const onPress = () => {
    const state: any = store.getState();
    let resolvedExerciseId = exerciseId;
    let workout: any = undefined;

    if (resolvedExerciseId !== undefined) {
      const notFinishedId = state.workouts?.notFinishedWorkouts?.[resolvedExerciseId];
      if (notFinishedId !== undefined) {
        workout = state.workouts?.byId?.[notFinishedId];
      } else if (workoutId !== undefined) {
        workout = state.workouts?.byId?.[workoutId];
      }
      if (!workout || workout.id === undefined) {
        const byEx = state.workouts?.byExerciseId?.[resolvedExerciseId] ?? [];
        const lastId = byEx[byEx.length - 1];
        workout = lastId !== undefined ? state.workouts?.byId?.[lastId] : undefined;
      }
    }
    if ((!workout || workout.id === undefined) && state.exercises?.allIds?.length) {
      // Settings 'Run 5' fallback: first exercise's most-recent workout.
      const fbExId = state.exercises.allIds[0];
      resolvedExerciseId = fbExId;
      const byEx = state.workouts?.byExerciseId?.[fbExId] ?? [];
      const lastId = byEx[byEx.length - 1];
      workout = lastId !== undefined ? state.workouts?.byId?.[lastId] : undefined;
    }
    if (!workout || workout.id === undefined || resolvedExerciseId === undefined) {
      Alert.alert(
        'GH-272',
        `No workout to drive cascade. exId=${resolvedExerciseId} wkId=${workoutId}`,
      );
      return;
    }

    const baseIndex = (workout.sets ?? []).reduce(
      (m: number, s: any) => Math.max(m, s.index ?? 0),
      0,
    );
    perfRecorder.reset();
    const dispatch = (store as any).dispatch;
    const targetWorkoutId = workout.id;
    const targetExerciseId = resolvedExerciseId;
    const runRep = (i: number) => {
      instrumentSubmitTiming('gh272-live-submit', () => {
        // Same cascade as Settings 'Run 5' (#260/#266/#268/#271) so the
        // dispatch / paint-gap CSVs are directly comparable to those reports.
        dispatch({
          type: 'ADD_OR_UPDATE_SET_IN_WORKOUT',
          set: {
            index: baseIndex + 200 + i,
            date: new Date(),
            weight: 100 + i,
            reps: 10,
            rir: 1,
          },
          workoutId: targetWorkoutId,
        });
        dispatch({
          type: 'START_REST_TIMER',
          startedAt: Date.now(),
          targetSeconds: 90,
          exerciseId: targetExerciseId,
          setIndex: baseIndex + 200 + i,
        });
      });
    };
    for (let i = 0; i < 5; i++) {
      setTimeout(() => runRep(i), i * 4000);
    }
    // Auto-dump 2s after the last submit so the worker can pull the CSV
    // without hunting for a second button.
    setTimeout(() => {
      dumpPerfCsv('gh272-live').catch(() => {});
    }, 5 * 4000 + 2000);
  };

  return (
    <View pointerEvents="box-none" style={styles.host}>
      <Pressable
        testID="gh272-live-cascade-button"
        accessibilityLabel="GH-272 Run 5 live cascade"
        onPress={onPress}
        hitSlop={4}
        style={({pressed}) => [styles.button, pressed && styles.buttonPressed]}>
        <Text style={styles.label} numberOfLines={1}>
          R5
        </Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  // box-none host so taps OUTSIDE the small button hit-box pass through to
  // the live-training UI underneath. Positioned absolutely flush to the
  // top-right with a safe-area-ish inset.
  host: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 44,
    height: 44,
    zIndex: 999,
    elevation: 12,
  },
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(220,40,40,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: 'rgba(180,30,30,0.95)',
  },
  label: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
});
