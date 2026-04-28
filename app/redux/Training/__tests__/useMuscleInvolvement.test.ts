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

const fixture = () => {
  // Plan id 1, micro 1, training-in-micro 1 -> trainingId 100 (PLANNED, today's training)
  // Plan id 1, micro 1, training-in-micro 2 -> trainingId 101 (PLANNED, sibling training in same micro)
  // Plan id 1, micro 0, training-in-micro 1 -> trainingId 102 (FINISHED, last week same slot)
  return makeState({
    exercises: {
      byId: {1: exerciseBench, 2: exerciseSquat},
      allIds: [1, 2],
    },
    workouts: {
      byId: {
        // planned workout for training 100 (today) - bench
        500: {id: 500, exerciseId: 1, sets: [{reps: 10, weight: 100, rir: 2}, {reps: 10, weight: 100, rir: 2}, {reps: 10, weight: 100, rir: 2}]},
        // planned workout for training 101 (sibling) - squat
        501: {id: 501, exerciseId: 2, sets: [{reps: 5, weight: 150, rir: 2}, {reps: 5, weight: 150, rir: 2}]},
        // done workout for training 102 (last week) - bench, slightly less
        600: {id: 600, exerciseId: 1, sets: [{reps: 8, weight: 90, rir: 2}, {reps: 8, weight: 90, rir: 2}]},
      },
      allIds: [500, 501, 600],
      byExerciseId: {},
      plannedWorkouts: [],
    } as any,
    trainings: {
      byId: {
        100: {id: 100, state: TrainingsState.PLANNED, exercises: [1], plannedWorkouts: {1: 500}, doneWorkoutIds: {}},
        101: {id: 101, state: TrainingsState.PLANNED, exercises: [2], plannedWorkouts: {2: 501}, doneWorkoutIds: {}},
        102: {
          id: 102,
          state: TrainingsState.FINISHED,
          exercises: [1],
          plannedWorkouts: {},
          doneWorkoutIds: {1: 600},
          start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          end: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 3600 * 1000),
        },
      },
      allIds: [100, 101, 102],
    },
    trainingsPlan: {
      byId: {
        1: {
          id: 1,
          name: 'Test Plan',
          trainings: {'1,1': 100, '1,2': 101, '0,1': 102},
          trainingNames: {1: 'Push', 2: 'Legs'},
        },
      },
      allIds: [1],
    },
  });
};

describe('computeMuscleInvolvement', () => {
  describe('compare = "none"', () => {
    it('returns today rows with reference 0', () => {
      const data = computeMuscleInvolvement(fixture(), {trainingsPlanId: 1, micro: 1, trainingInMicro: 1, metric: 'sets', compare: 'none'});
      expect(data.effectiveCompare).toBe('none');
      expect(data.referenceUnavailable).toBe(false);
      expect(data.rows.length).toBeGreaterThan(0);
      expect(data.rows.every((r) => r.reference === 0)).toBe(true);
      const chest = data.rows.find((r) => r.muscleGroupId === Muscles.CHEST);
      expect(chest?.today).toBeCloseTo(3, 5);
    });
  });

  describe('compare = "micro"', () => {
    it('aggregates planned sets across the whole micro as reference', () => {
      const data = computeMuscleInvolvement(fixture(), {trainingsPlanId: 1, micro: 1, trainingInMicro: 1, metric: 'sets', compare: 'micro'});
      expect(data.effectiveCompare).toBe('micro');
      expect(data.referenceUnavailable).toBe(false);
      const chest = data.rows.find((r) => r.muscleGroupId === Muscles.CHEST);
      // today's chest = 3 sets; reference = micro total = 3 (only training 100 has chest)
      expect(chest?.today).toBeCloseTo(3, 5);
      expect(chest?.reference).toBeCloseTo(3, 5);
      // Triceps: today = 1.5, ref = 1.5
      const triceps = data.rows.find((r) => r.muscleGroupId === Muscles.TRICEPS);
      expect(triceps?.today).toBeCloseTo(1.5, 5);
      expect(triceps?.reference).toBeCloseTo(1.5, 5);
    });

    it('handles volume metric', () => {
      const data = computeMuscleInvolvement(fixture(), {trainingsPlanId: 1, micro: 1, trainingInMicro: 1, metric: 'volume', compare: 'micro'});
      const chest = data.rows.find((r) => r.muscleGroupId === Muscles.CHEST);
      // 3 * (10*100*1.0) / 1000 = 3.0 t
      expect(chest?.today).toBeCloseTo(3, 5);
    });
  });

  describe('compare = "last"', () => {
    it('uses last finished training same slot as reference', () => {
      const data = computeMuscleInvolvement(fixture(), {trainingsPlanId: 1, micro: 1, trainingInMicro: 1, metric: 'sets', compare: 'last'});
      expect(data.effectiveCompare).toBe('last');
      expect(data.referenceUnavailable).toBe(false);
      const chest = data.rows.find((r) => r.muscleGroupId === Muscles.CHEST);
      // today = 3 sets, last (done) = 2 sets
      expect(chest?.today).toBeCloseTo(3, 5);
      expect(chest?.reference).toBeCloseTo(2, 5);
    });

    it('falls back to none when no finished training within 21 days', () => {
      const state = fixture();
      // Move the FINISHED training to >21 days ago
      const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      state.trainings.byId[102].start = oldDate;
      state.trainings.byId[102].end = oldDate;
      const data = computeMuscleInvolvement(state, {trainingsPlanId: 1, micro: 1, trainingInMicro: 1, metric: 'sets', compare: 'last'});
      expect(data.referenceUnavailable).toBe(true);
      expect(data.effectiveCompare).toBe('none');
    });

    it('falls back to none when no finished training matches the slot', () => {
      const state = fixture();
      // Remove the historical training reference
      delete state.trainingsPlan.byId[1].trainings['0,1'];
      const data = computeMuscleInvolvement(state, {trainingsPlanId: 1, micro: 1, trainingInMicro: 1, metric: 'sets', compare: 'last'});
      expect(data.referenceUnavailable).toBe(true);
      expect(data.effectiveCompare).toBe('none');
    });
  });
});
