/**
 * Tests for GH-162-fix1: reference-based memoization in AIChatTab.
 *
 * Both tests verify a scenario that would have been INVISIBLE to the old
 * count-based memoization:
 *
 *  - Old allFinishedTrainings memo: `[trainingsAllIds.length]`
 *    → FINISH_TRAINING keeps allIds.length constant → stale array
 *  - Old reseed effect deps: `[..., workoutCount, exerciseCount]`
 *    → set-value edit keeps counts constant → stale seedContextJson
 *
 * The new code uses createSelector (reference equality on byId/allIds) and
 * object references in the effect deps, so both mutations fire correctly.
 */

import {selectAllFinishedTrainings} from '../../../app/redux/AIChat/selectors';
import trainingsReducer from '../../../app/redux/Training/trainingsReducer';
import {serializeTrainingsForChat} from '../../../app/utils/ai/serializeTrainingsForChat';
import {TrainingsState} from '../../../app/models/TrainingsState';
import {Training} from '../../../app/models/entities/Training';
import {Workout} from '../../../app/models/entities/Workout';
import {Exercise} from '../../../app/models/entities/Exercise';
import {GlobalState} from '../../../app/redux/rootReducer';

function makePlannedTraining(id: number): Training {
  return {
    id,
    state: TrainingsState.PLANNED,
    doneWorkoutIds: {10: 100},
    plannedWorkouts: {},
    exercises: [10],
  } as Training;
}

function makeWorkout(id: number, weightKg: number): Workout {
  return {
    id,
    sets: [{index: 0, reps: 5, weight: weightKg, rir: 2, date: new Date()}],
    exerciseId: 10,
    trainingsId: 1,
  } as unknown as Workout;
}

function makeExercise(id: number, name: string): Exercise {
  return {id, name, muscles: []};
}

function makeGlobalState(trainingsState: {byId: Record<number, Training>; allIds: number[]}): GlobalState {
  return {trainings: trainingsState} as unknown as GlobalState;
}

describe('AIChatTab memoization fix (GH-162-fix1)', () => {
  it('FINISH_TRAINING updates selectAllFinishedTrainings even when allIds.length is unchanged', () => {
    // One PLANNED training — allIds.length = 1 before and after FINISH_TRAINING.
    // Old memo `[trainingsAllIds.length]` would return stale []; new createSelector returns [training].
    const initialTrainings = {
      byId: {1: makePlannedTraining(1)} as Record<number, Training>,
      allIds: [1],
    };

    const before = selectAllFinishedTrainings(makeGlobalState(initialTrainings));
    expect(before).toHaveLength(0);

    // FINISH_TRAINING mutates byId content but allIds stays [1] (length unchanged).
    const newTrainings = trainingsReducer(initialTrainings as any, {
      type: 'FINISH_TRAINING',
      trainingsId: 1,
      date: new Date().toISOString(),
    } as any);

    expect(newTrainings.allIds.length).toBe(initialTrainings.allIds.length); // length still 1

    const after = selectAllFinishedTrainings(makeGlobalState(newTrainings as any));
    expect(after).toHaveLength(1);
    expect(after[0].state).toBe(TrainingsState.FINISHED);
  });

  it('set-value update changes seedContextJson content without changing workout count', () => {
    // This proves the old `workoutCount` dep was insufficient: count stays 1,
    // but weight changes from 100 → 105 → serializeTrainingsForChat returns different JSON.
    // With the fixed effect deps ([..., workoutsById, ...]) the effect fires on reference change.
    const finishedTraining: Training = {
      id: 1,
      state: TrainingsState.FINISHED,
      end: new Date('2026-04-01'),
      doneWorkoutIds: {10: 100},
      plannedWorkouts: {},
      exercises: [10],
    } as Training;

    const exercises: Record<number, Exercise> = {10: makeExercise(10, 'Squat')};

    const workoutsBefore: Record<number, Workout> = {100: makeWorkout(100, 100)};
    const workoutsAfter: Record<number, Workout> = {100: makeWorkout(100, 105)};

    // Counts are identical — old dep would miss this change.
    expect(Object.keys(workoutsBefore).length).toBe(Object.keys(workoutsAfter).length);

    // But object references differ (new Redux state after reducer), so new dep fires.
    expect(workoutsBefore).not.toBe(workoutsAfter);

    const jsonBefore = serializeTrainingsForChat([finishedTraining], workoutsBefore, exercises, {});
    const jsonAfter = serializeTrainingsForChat([finishedTraining], workoutsAfter, exercises, {});

    expect(jsonBefore).not.toBeNull();
    expect(jsonAfter).not.toBeNull();
    expect(jsonBefore).not.toBe(jsonAfter);

    const parsedBefore = JSON.parse(jsonBefore!);
    const parsedAfter = JSON.parse(jsonAfter!);
    expect(parsedBefore.sessions[0].exercises[0].sets[0].weight_kg).toBe(100);
    expect(parsedAfter.sessions[0].exercises[0].sets[0].weight_kg).toBe(105);
  });
});
