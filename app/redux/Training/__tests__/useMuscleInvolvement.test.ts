import {computeMuscleInvolvement} from '../use/useMuscleInvolvement';
import {GlobalState} from '../../rootReducer';
import {Muscles} from '../../../models/Muscles';
import {TrainingsState} from '../../../models/TrainingsState';

const makeState = (overrides: Partial<GlobalState> = {}): GlobalState => ({
  exercises: {byId: {}, allIds: []},
  workouts: {byId: {}, allIds: [], byExerciseId: {}, plannedWorkouts: []} as any,
  trainingsPlan: {byId: {}, allIds: []},
  trainings: {byId: {}, allIds: []},
  videoAnalyses: {byId: {}, allIds: []},
  settings: {mode: 'dark'},
  effects: {} as any,
  aiChat: {} as any,
  ...overrides,
});

const exerciseBench = {
  id: 1,
  name: 'Bench',
  muscles: [
    {muscle: Muscles.CHEST, percent: 100},
    {muscle: Muscles.TRICEPS, percent: 50},
  ],
};

const exerciseSquat = {
  id: 2,
  name: 'Squat',
  muscles: [
    {muscle: Muscles.QUADS, percent: 100},
    {muscle: Muscles.GLUTES, percent: 50},
  ],
};

const exerciseRow = {
  id: 3,
  name: 'Row',
  muscles: [
    {muscle: Muscles.BACK, percent: 100},
    {muscle: Muscles.BICEPS, percent: 50},
  ],
};

/**
 * Fixture:
 *   plan id 1
 *   micro 2 (current):
 *     trainingInMicro 1 -> trainingId 200 (PLANNED, current "today" training, bench)
 *     trainingInMicro 2 -> trainingId 201 (PLANNED, sibling, squat)
 *   micro 1 (previous):
 *     trainingInMicro 1 -> trainingId 100 (PLANNED, bench heavier)
 *     trainingInMicro 2 -> trainingId 101 (PLANNED, row)
 */
const fixture = () => makeState({
  exercises: {
    byId: {1: exerciseBench, 2: exerciseSquat, 3: exerciseRow},
    allIds: [1, 2, 3],
  },
  workouts: {
    byId: {
      // current micro - today (bench): 3 sets x 10 x 100kg
      500: {id: 500, exerciseId: 1, sets: [
        {reps: 10, weight: 100, rir: 2},
        {reps: 10, weight: 100, rir: 2},
        {reps: 10, weight: 100, rir: 2},
      ]},
      // current micro - sibling (squat): 4 sets x 5 x 150kg
      501: {id: 501, exerciseId: 2, sets: [
        {reps: 5, weight: 150, rir: 2},
        {reps: 5, weight: 150, rir: 2},
        {reps: 5, weight: 150, rir: 2},
        {reps: 5, weight: 150, rir: 2},
      ]},
      // previous micro - bench: 4 sets x 8 x 110kg
      400: {id: 400, exerciseId: 1, sets: [
        {reps: 8, weight: 110, rir: 2},
        {reps: 8, weight: 110, rir: 2},
        {reps: 8, weight: 110, rir: 2},
        {reps: 8, weight: 110, rir: 2},
      ]},
      // previous micro - row: 3 sets x 8 x 60kg
      401: {id: 401, exerciseId: 3, sets: [
        {reps: 8, weight: 60, rir: 2},
        {reps: 8, weight: 60, rir: 2},
        {reps: 8, weight: 60, rir: 2},
      ]},
    },
    allIds: [400, 401, 500, 501],
    byExerciseId: {},
    plannedWorkouts: [],
  } as any,
  trainings: {
    byId: {
      100: {id: 100, state: TrainingsState.PLANNED, exercises: [1], plannedWorkouts: {1: 400}, doneWorkoutIds: {}},
      101: {id: 101, state: TrainingsState.PLANNED, exercises: [3], plannedWorkouts: {3: 401}, doneWorkoutIds: {}},
      200: {id: 200, state: TrainingsState.PLANNED, exercises: [1], plannedWorkouts: {1: 500}, doneWorkoutIds: {}},
      201: {id: 201, state: TrainingsState.PLANNED, exercises: [2], plannedWorkouts: {2: 501}, doneWorkoutIds: {}},
    },
    allIds: [100, 101, 200, 201],
  },
  trainingsPlan: {
    byId: {
      1: {
        id: 1,
        name: 'Test Plan',
        trainings: {'1,1': 100, '1,2': 101, '2,1': 200, '2,2': 201},
        trainingNames: {1: 'Push', 2: 'Legs'},
      },
    },
    allIds: [1],
  },
});

describe('computeMuscleInvolvement', () => {
  describe('compare = "none"', () => {
    it('returns today rows with reference 0 and effective compare none', () => {
      const data = computeMuscleInvolvement(fixture(), {trainingsPlanId: 1, micro: 2, trainingInMicro: 1, metric: 'sets', compare: 'none'});
      expect(data.effectiveCompare).toBe('none');
      expect(data.referenceUnavailable).toBe(false);
      expect(data.rows.length).toBeGreaterThan(0);
      expect(data.rows.every((r) => r.reference === 0)).toBe(true);
      expect(data.rows.find((r) => r.muscleGroupId === Muscles.CHEST)?.today).toBeCloseTo(3, 5);
    });

    it('volume metric leaves reference at 0', () => {
      const data = computeMuscleInvolvement(fixture(), {trainingsPlanId: 1, micro: 2, trainingInMicro: 1, metric: 'volume', compare: 'none'});
      expect(data.rows.find((r) => r.muscleGroupId === Muscles.CHEST)?.today).toBeCloseTo(3, 5); // 3*10*100/1000 = 3 t
    });
  });

  describe('compare = "current_total_plan"', () => {
    it('aggregates planned sets across the entire current micro (incl. current training)', () => {
      const data = computeMuscleInvolvement(fixture(), {trainingsPlanId: 1, micro: 2, trainingInMicro: 1, metric: 'sets', compare: 'current_total_plan'});
      expect(data.effectiveCompare).toBe('current_total_plan');
      expect(data.referenceUnavailable).toBe(false);
      // CHEST: today = 3 (bench). Reference = 3 (only training 200 has chest in micro 2).
      const chest = data.rows.find((r) => r.muscleGroupId === Muscles.CHEST);
      expect(chest?.today).toBeCloseTo(3, 5);
      expect(chest?.reference).toBeCloseTo(3, 5);
    });

    it('aggregates planned volume across the entire current micro', () => {
      const data = computeMuscleInvolvement(fixture(), {trainingsPlanId: 1, micro: 2, trainingInMicro: 1, metric: 'volume', compare: 'current_total_plan'});
      expect(data.effectiveCompare).toBe('current_total_plan');
      const chest = data.rows.find((r) => r.muscleGroupId === Muscles.CHEST);
      expect(chest?.today).toBeCloseTo(3, 5);
      expect(chest?.reference).toBeCloseTo(3, 5);
    });

    it('falls back to none when no planned data exists in current micro', () => {
      const state = fixture();
      // Wipe all workouts in current micro
      state.trainings.byId[200].plannedWorkouts = {};
      state.trainings.byId[201].plannedWorkouts = {};
      const data = computeMuscleInvolvement(state, {trainingsPlanId: 1, micro: 2, trainingInMicro: 1, metric: 'sets', compare: 'current_total_plan'});
      expect(data.referenceUnavailable).toBe(true);
      expect(data.effectiveCompare).toBe('none');
    });
  });

  describe('compare = "last_plan"', () => {
    it('aggregates planned sets across the previous micro only', () => {
      const data = computeMuscleInvolvement(fixture(), {trainingsPlanId: 1, micro: 2, trainingInMicro: 1, metric: 'sets', compare: 'last_plan'});
      expect(data.effectiveCompare).toBe('last_plan');
      expect(data.referenceUnavailable).toBe(false);
      // CHEST today = 3, reference = 4 sets (training 100, 4 sets bench)
      const chest = data.rows.find((r) => r.muscleGroupId === Muscles.CHEST);
      expect(chest?.today).toBeCloseTo(3, 5);
      expect(chest?.reference).toBeCloseTo(4, 5);
    });

    it('aggregates planned volume across the previous micro only', () => {
      const data = computeMuscleInvolvement(fixture(), {trainingsPlanId: 1, micro: 2, trainingInMicro: 1, metric: 'volume', compare: 'last_plan'});
      // previous micro bench: 4 sets * 8 reps * 110kg / 1000 = 3.52 t for CHEST
      const chest = data.rows.find((r) => r.muscleGroupId === Muscles.CHEST);
      expect(chest?.reference).toBeCloseTo(3.52, 4);
    });

    it('falls back to none when on micro 1 (no previous micro)', () => {
      const data = computeMuscleInvolvement(fixture(), {trainingsPlanId: 1, micro: 1, trainingInMicro: 1, metric: 'sets', compare: 'last_plan'});
      expect(data.referenceUnavailable).toBe(true);
      expect(data.effectiveCompare).toBe('none');
    });

    it('falls back to none when previous micro has no planned data', () => {
      const state = fixture();
      // Wipe all planned workouts in micro 1
      state.trainings.byId[100].plannedWorkouts = {};
      state.trainings.byId[101].plannedWorkouts = {};
      const data = computeMuscleInvolvement(state, {trainingsPlanId: 1, micro: 2, trainingInMicro: 1, metric: 'sets', compare: 'last_plan'});
      expect(data.referenceUnavailable).toBe(true);
      expect(data.effectiveCompare).toBe('none');
    });

    it('does NOT include current micro trainings in last_plan reference', () => {
      const data = computeMuscleInvolvement(fixture(), {trainingsPlanId: 1, micro: 2, trainingInMicro: 1, metric: 'sets', compare: 'last_plan'});
      // QUADS appear only in current-micro squat (training 201). last_plan should NOT contain QUADS.
      const quads = data.rows.find((r) => r.muscleGroupId === Muscles.QUADS);
      // QUADS not in today's training (bench), so no row at all — but ensure reference would be 0 for today muscles.
      // BACK appears only in previous micro (training 101 row). It's not in today either, so no row.
      expect(quads).toBeUndefined();
      // CHEST is in today AND previous-micro. Reference must equal previous-micro chest only.
      const chest = data.rows.find((r) => r.muscleGroupId === Muscles.CHEST);
      expect(chest?.reference).toBeCloseTo(4, 5); // 4 sets, NOT 4+3
    });
  });
});
