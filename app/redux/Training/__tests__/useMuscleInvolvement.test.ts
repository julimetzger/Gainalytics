import {computeMuscleInvolvement, findLastMatchingTraining} from '../use/useMuscleInvolvement';
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

// GH-300: per-training compare modes (last_training_plan / last_training_done).
// Uses a two-meso fixture so we can prove the same-meso preference and previous-meso fallback.
const MESOS = [
  {id: 1, name: 'Meso 1', order: 1, startMicro: 1},
  {id: 2, name: 'Meso 2', order: 2, startMicro: 3},
];

const makeSets = (n: number, weight: number) => Array.from({length: n}, (_, i) => ({index: i + 1, reps: 5, weight, rir: 0}));

const fixtureMultiMeso = () =>
  makeState({
    exercises: {byId: {1: exerciseBench}, allIds: [1]} as any,
    workouts: {
      byId: {
        // planned bench, one workout per training
        1001: {id: 1001, exerciseId: 1, sets: makeSets(3, 100)}, // planned m1 (3 sets)
        1002: {id: 1002, exerciseId: 1, sets: makeSets(4, 110)}, // planned m2 (4 sets)
        1003: {id: 1003, exerciseId: 1, sets: makeSets(2, 120)}, // planned m3 (2 sets)
        1004: {id: 1004, exerciseId: 1, sets: makeSets(1, 130)}, // planned m4 — current (1 set)
        // done bench (only m1 and m2 actually completed)
        2001: {id: 2001, exerciseId: 1, sets: makeSets(3, 95)},
        2002: {id: 2002, exerciseId: 1, sets: makeSets(4, 105)},
      },
      allIds: [1001, 1002, 1003, 1004, 2001, 2002],
      byExerciseId: {},
      plannedWorkouts: [],
    } as any,
    trainings: {
      byId: {
        301: {id: 301, exercises: [1], plannedWorkouts: {1: 1001}, doneWorkoutIds: {1: 2001}, state: TrainingsState.FINISHED, end: new Date('2026-01-08')},
        302: {id: 302, exercises: [1], plannedWorkouts: {1: 1002}, doneWorkoutIds: {1: 2002}, state: TrainingsState.FINISHED, end: new Date('2026-01-15')},
        303: {id: 303, exercises: [1], plannedWorkouts: {1: 1003}, doneWorkoutIds: {}, state: TrainingsState.PLANNED},
        304: {id: 304, exercises: [1], plannedWorkouts: {1: 1004}, doneWorkoutIds: {}, state: TrainingsState.PLANNED},
      },
      allIds: [301, 302, 303, 304],
    },
    trainingsPlan: {
      byId: {
        1: {
          id: 1,
          name: 'Test Plan',
          trainings: {'1,0': 301, '2,0': 302, '3,0': 303, '4,0': 304},
          trainingNames: {0: 'Push'},
          mesos: MESOS,
        },
      },
      allIds: [1],
    } as any,
  });

describe('findLastMatchingTraining', () => {
  it('prefers a same-meso match over a previous-meso match', () => {
    const state = fixtureMultiMeso();
    const plan = state.trainingsPlan.byId[1];
    const match = findLastMatchingTraining(state, plan, 0, 4, false);
    expect(match?.micro).toBe(3);
    expect(match?.training.id).toBe(303);
  });

  it('falls back to the previous meso when no same-meso match exists', () => {
    const state = fixtureMultiMeso();
    const plan = state.trainingsPlan.byId[1];
    // From micro 3 (start of meso 2) there is no earlier same-meso training; should jump to meso 1 (last entry: m2).
    const match = findLastMatchingTraining(state, plan, 0, 3, false);
    expect(match?.micro).toBe(2);
    expect(match?.training.id).toBe(302);
  });

  it('skips trainings without end when requireDone=true (last_training_done filter)', () => {
    const state = fixtureMultiMeso();
    const plan = state.trainingsPlan.byId[1];
    // From micro 4, same-meso candidate is m3 (PLANNED, no end). Done filter forces fallback to meso 1 (m2 — last done).
    const match = findLastMatchingTraining(state, plan, 0, 4, true);
    expect(match?.micro).toBe(2);
    expect(match?.training.id).toBe(302);
  });

  it('returns undefined when no earlier matching training exists in either meso', () => {
    const state = fixtureMultiMeso();
    const plan = state.trainingsPlan.byId[1];
    const match = findLastMatchingTraining(state, plan, 0, 1, false);
    expect(match).toBeUndefined();
  });

  it('returns undefined for last_training_done when no training has an end date', () => {
    const state = fixtureMultiMeso();
    const plan = state.trainingsPlan.byId[1];
    state.trainings.byId[301] = {...state.trainings.byId[301], end: undefined};
    state.trainings.byId[302] = {...state.trainings.byId[302], end: undefined};
    const match = findLastMatchingTraining(state, plan, 0, 4, true);
    expect(match).toBeUndefined();
  });
});

describe('computeMuscleInvolvement — last_training_plan / last_training_done (GH-300)', () => {
  it('uses planned data of the same-meso last match for last_training_plan', () => {
    const state = fixtureMultiMeso();
    const data = computeMuscleInvolvement(state, {
      trainingsPlanId: 1,
      micro: 4,
      trainingInMicro: 0,
      metric: 'sets',
      compare: 'last_training_plan',
      view: 'plan',
    });
    expect(data.effectiveCompare).toBe('last_training_plan');
    const chest = data.rows.find((r) => r.muscleGroupId === Muscles.CHEST);
    // today = m4 planned (1 set bench); reference = m3 planned (2 sets bench)
    expect(chest?.today).toBeCloseTo(1, 5);
    expect(chest?.reference).toBeCloseTo(2, 5);
  });

  it('uses done data of the last matching done training for last_training_done (cross-meso fallback)', () => {
    const state = fixtureMultiMeso();
    // Give the current (m4) training done sets so today is non-empty in analyse view.
    state.trainings.byId[304] = {
      ...state.trainings.byId[304],
      doneWorkoutIds: {1: 2002},
      state: TrainingsState.FINISHED,
      end: new Date('2026-01-22'),
    };
    const data = computeMuscleInvolvement(state, {
      trainingsPlanId: 1,
      micro: 4,
      trainingInMicro: 0,
      metric: 'sets',
      compare: 'last_training_done',
      view: 'analyse',
    });
    expect(data.effectiveCompare).toBe('last_training_done');
    const chest = data.rows.find((r) => r.muscleGroupId === Muscles.CHEST);
    // today = m4 done (4 sets); reference = m2 done (4 sets) — m3 has no end so it is skipped
    expect(chest?.today).toBeCloseTo(4, 5);
    expect(chest?.reference).toBeCloseTo(4, 5);
  });

  it('marks reference unavailable for last_training_plan when no earlier training exists', () => {
    const state = fixtureMultiMeso();
    const data = computeMuscleInvolvement(state, {
      trainingsPlanId: 1,
      micro: 1,
      trainingInMicro: 0,
      metric: 'sets',
      compare: 'last_training_plan',
      view: 'plan',
    });
    expect(data.referenceUnavailable).toBe(true);
    expect(data.effectiveCompare).toBe('none');
  });
});
