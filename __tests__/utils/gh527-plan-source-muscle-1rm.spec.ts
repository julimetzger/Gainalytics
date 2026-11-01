/**
 * GH-527 (UX audit H5/H6):
 *  - H5: the planned sets of an exercise that was removed from a training stayed
 *    stored and were counted by the Muscle Overview table and the Sets total but not
 *    by the muscle map. Now none of the views count them.
 *  - H6: 1RM / Max / Average Intensity of a muscle were the values of the strongest
 *    exercise of the whole period, identical for every muscle (also for muscles
 *    without a single set).
 */
import fs from 'fs';
import path from 'path';
import {doneWorkoutIdsOf, plannedWorkoutIdsOf, setsOf} from '../../app/utils/overview-comparison';
import {calculateMetricComparisonsForMuscle, WorkoutSetMap} from '../../app/utils/AnalyseUtils';
import {aggregateWorkouts} from '../../app/utils/MuscleInvolvementUtils';
import {selectAllTrainingsInMicro} from '../../app/redux/Training/use/useAllTrainingsInMicro';
import {Training} from '../../app/models/entities/Training';
import {Workout} from '../../app/models/entities/Workout';
import {Exercise} from '../../app/models/entities/Exercise';
import {Metric} from '../../app/models/Metric';
import {Muscles} from '../../app/models/Muscles';
import {TrainingsState} from '../../app/models/TrainingsState';
import {GlobalState} from '../../app/redux/rootReducer';

/** The Muscle Overview table's input, built exactly like MetricsOverviewForWorkouts does. */
const exerciseWorkoutMap = (exercisesById: {[id: number]: Exercise}, current: Workout[], previous: Workout[] = []) =>
  new Map<Exercise, WorkoutSetMap>(
    [...new Set([...current, ...previous].map((workout) => workout.exerciseId))].map((exerciseId) => {
      const currentWorkouts = current.filter((workout) => workout.exerciseId === exerciseId);
      const lastWorkouts = previous.filter((workout) => workout.exerciseId === exerciseId);
      return [
        exercisesById[exerciseId],
        {
          currentWorkoutSets: currentWorkouts.flatMap((workout) => workout.sets),
          lastWorkoutSets: lastWorkouts.flatMap((workout) => workout.sets),
          currentWorkoutsCount: currentWorkouts.length,
          lastWorkoutsCount: lastWorkouts.length,
        },
      ];
    }),
  );

const STRENGTH_METRICS = [Metric.ONE_RM, Metric.MAX_INTENSITY, Metric.AVERAGE_INTENSITY];
const strengthOf = (comparisons: ReturnType<typeof calculateMetricComparisonsForMuscle>) =>
  Object.fromEntries(Array.from(comparisons).map(([muscle, byMetric]) => [muscle, Object.fromEntries(STRENGTH_METRICS.map((metric) => [metric, byMetric.get(metric)]))]));

describe('GH-527 plannedWorkoutIdsOf — one source for planned sets', () => {
  const training = (exercises: number[] | undefined, plannedWorkouts: {[exerciseId: number]: number}, doneWorkoutIds: {[exerciseId: number]: number} = {}) =>
    ({exercises, plannedWorkouts, doneWorkoutIds, state: TrainingsState.PLANNED}) as unknown as Training;

  it('skips the planned workouts of exercises that are no longer in the training', () => {
    expect(
      plannedWorkoutIdsOf([
        training([1, 2], {1: 11, 2: 12, 3: 13}),
        undefined,
        // legacy training without an exercise list keeps everything it planned
        training(undefined, {4: 14}),
        training([], {5: 15}),
      ]),
    ).toEqual([11, 12, 14]);
  });

  it('keeps every done workout — only the plan is filtered', () => {
    expect(doneWorkoutIdsOf([training([1], {1: 11}, {1: 21, 3: 23}), undefined])).toEqual([21, 23]);
  });
});

describe('GH-527 baseline Micro 1 of "Push pull" — map, table and Sets total agree', () => {
  const state = JSON.parse(fs.readFileSync(path.join(__dirname, '../e2e/maestro/fixtures/baseline.gains'), 'utf8')) as GlobalState;
  const trainings = selectAllTrainingsInMicro(state, 5, 1);
  const workoutsOf = (ids: number[]) => ids.map((id) => state.workouts.byId[id]);
  const planned = workoutsOf(plannedWorkoutIdsOf(trainings));
  const allStored = workoutsOf(trainings.flatMap((training) => Object.values(training.plannedWorkouts)));

  it('drops the stored sets of SA lat pulldown and Machine chest press everywhere', () => {
    const map = aggregateWorkouts(planned, state.exercises.byId, 'sets');
    const table = calculateMetricComparisonsForMuscle(exerciseWorkoutMap(state.exercises.byId, planned));
    const pick = (muscle: Muscles) => ({map: map.get(muscle), table: table.get(muscle)?.get(Metric.SETS)?.value});

    expect({total: setsOf(planned), back: pick(Muscles.BACK), chest: pick(Muscles.CHEST)}).toEqual({
      total: 41,
      back: {map: 12, table: 12},
      chest: {map: 0.8, table: 0.8},
    });
    // the removed exercises' sets are still stored (no data migration)
    expect(setsOf(allStored)).toBe(45);
  });

  it('computes 1RM and intensity of each muscle from its own exercises (done, Total tab)', () => {
    const done = workoutsOf(doneWorkoutIdsOf(trainings));
    const strength = strengthOf(calculateMetricComparisonsForMuscle(exerciseWorkoutMap(state.exercises.byId, done)));
    // Back: Paused deadlift 170 kg × 7 @ RIR 3 → 170 × (1 + 10/30) = 226.7 kg.
    // Chest: Dips 135 kg × 10 @ RIR 0 → 135 × (1 + 10/30) = 180 kg; Bankdrücken 110 × 6 @ 2 → 139.3.
    // Shoulders: Bankdrücken (Shoulders 10 %) 139.3 kg, no deadlift, no dips.
    // Biceps: Machine lat pulldown neutral 105 kg × 12 → 147 kg.
    expect({back: strength[Muscles.BACK][Metric.ONE_RM], chest: strength[Muscles.CHEST][Metric.ONE_RM], shoulders: strength[Muscles.SHOULDERS][Metric.ONE_RM], biceps: strength[Muscles.BICEPS][Metric.ONE_RM]}).toEqual({
      back: {value: expect.closeTo(226.67, 2), difference: undefined},
      chest: {value: expect.closeTo(180, 5), difference: undefined},
      shoulders: {value: expect.closeTo(139.33, 2), difference: undefined},
      biceps: {value: expect.closeTo(147, 5), difference: undefined},
    });
  });
});

describe('GH-527 1RM / intensity per muscle', () => {
  const pullUp = {id: 1, name: 'Pull up', muscles: [{muscle: Muscles.BACK, percent: 100}, {muscle: Muscles.BICEPS, percent: 80}]} satisfies Exercise;
  const bench = {id: 2, name: 'Bench', muscles: [{muscle: Muscles.CHEST, percent: 100}, {muscle: Muscles.TRICEPS, percent: 50}]} satisfies Exercise;
  const dips = {id: 3, name: 'Dips', muscles: [{muscle: Muscles.TRICEPS, percent: 100}, {muscle: Muscles.CHEST, percent: 0}]} satisfies Exercise;
  const plank = {id: 4, name: 'Plank', muscles: [{muscle: Muscles.CORE, percent: 100}]} satisfies Exercise;
  const exercisesById = {1: pullUp, 2: bench, 3: dips, 4: plank};
  const set = (weight: number, reps: number, index = 0) => ({index, weight, reps, rir: 0});

  // e1RM = weight × (1 + reps/30): Pull up 60 × 15 → 90, Bench 90 × 10 → 120, Dips 30 × 15 → 45.
  const current = [
    {id: 11, exerciseId: 1, sets: [set(60, 15), set(50, 15, 1)]},
    {id: 12, exerciseId: 2, sets: [set(90, 10)]},
    {id: 13, exerciseId: 3, sets: [set(30, 15), set(15, 15, 1)]},
    {id: 14, exerciseId: 4, sets: []},
  ] satisfies Workout[];
  // reference: Pull up 50 × 15 → 75 kg; Plank, Bench and Dips have no sets there.
  const previous = [{id: 21, exerciseId: 1, sets: [set(50, 15)]}] satisfies Workout[];

  it('takes every muscle only from the exercises that train it and shows nothing for a muscle without sets', () => {
    const strength = strengthOf(calculateMetricComparisonsForMuscle(exerciseWorkoutMap(exercisesById, current, previous)));

    expect(strength).toEqual({
      // Pull up only: 1RM 90 vs 75, max 60/90 vs 50/75, average (60 + 50) / 2 / 90 vs 50/75.
      [Muscles.BACK]: {
        [Metric.ONE_RM]: {value: 90, difference: 15},
        [Metric.MAX_INTENSITY]: {value: expect.closeTo(66.67, 2), difference: expect.closeTo(0, 5)},
        [Metric.AVERAGE_INTENSITY]: {value: expect.closeTo(61.11, 2), difference: expect.closeTo(-5.56, 2)},
      },
      [Muscles.BICEPS]: {
        [Metric.ONE_RM]: {value: 90, difference: 15},
        [Metric.MAX_INTENSITY]: {value: expect.closeTo(66.67, 2), difference: expect.closeTo(0, 5)},
        [Metric.AVERAGE_INTENSITY]: {value: expect.closeTo(61.11, 2), difference: expect.closeTo(-5.56, 2)},
      },
      // Bench only — Dips list Chest at 0 % and do not count; no reference sets → no delta.
      [Muscles.CHEST]: {
        [Metric.ONE_RM]: {value: 120, difference: undefined},
        [Metric.MAX_INTENSITY]: {value: 75, difference: undefined},
        [Metric.AVERAGE_INTENSITY]: {value: 75, difference: undefined},
      },
      // Bench (120 kg, 75 %) and Dips (45 kg, 30/45 and 15/45): 1RM and max are the
      // highest exercise, the average runs over all three sets: (75 + 66.67 + 33.33) / 3.
      [Muscles.TRICEPS]: {
        [Metric.ONE_RM]: {value: 120, difference: undefined},
        [Metric.MAX_INTENSITY]: {value: 75, difference: undefined},
        [Metric.AVERAGE_INTENSITY]: {value: expect.closeTo(58.33, 2), difference: undefined},
      },
      // Plank has no set: no value, no delta (the table shows "–").
      [Muscles.CORE]: {
        [Metric.ONE_RM]: {value: undefined, difference: undefined},
        [Metric.MAX_INTENSITY]: {value: undefined, difference: undefined},
        [Metric.AVERAGE_INTENSITY]: {value: undefined, difference: undefined},
      },
    });
  });
});
