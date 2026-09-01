jest.mock('react-native-fs', () => ({
  DownloadDirectoryPath: '/downloads',
  writeFile: jest.fn(),
}));

import {buildTrainingsPlanExportPayload, TrainingsPlanExportPayload} from '../../app/utils/exportTrainingsPlan';
import fullStateReducer from '../../app/redux/fullstateactions/fullStateReducer';
import {GlobalState} from '../../app/redux/rootReducer';
import {TrainingsPlan} from '../../app/models/entities/TrainingsPlan';
import {TrainingsState} from '../../app/models/TrainingsState';
import {WorkoutSet} from '../../app/models/entities/WorkoutSet';

// GH-63: a shared plan must carry its ranges, and a plan file written by an
// older version (no range keys at all) must keep importing unchanged.

const rangedSet: WorkoutSet = {index: 1, reps: 8, rir: 1, weight: 100, repsMax: 12, rirMax: 3, weightMax: 110};
const fixedSet: WorkoutSet = {index: 2, reps: 6, rir: 2, weight: 120};

const plan: TrainingsPlan = {
  id: 1,
  name: 'Push pull',
  trainings: {'1,1': 1},
  trainingNames: {'1': 'Pull'},
};

const buildState = (sets: WorkoutSet[]): GlobalState =>
  ({
    trainingsPlan: {byId: {1: plan}, allIds: [1]},
    trainings: {
      byId: {
        1: {
          id: 1,
          state: TrainingsState.PLANNED,
          plannedWorkouts: {10: 100},
          doneWorkoutIds: {},
          exercises: [10],
        },
      },
      allIds: [1],
    },
    exercises: {
      byId: {10: {id: 10, name: 'Bench', muscles: []}},
      allIds: [10],
    },
    workouts: {
      byId: {100: {id: 100, sets, exerciseId: 10}},
      allIds: [100],
      byExerciseId: {},
      plannedWorkouts: [],
    },
    videoAnalyses: {byId: {}, allIds: []},
    settings: {mode: 'dark'},
    effects: {},
  }) as unknown as GlobalState;

const emptyTargetState = (): GlobalState =>
  ({
    trainingsPlan: {byId: {}, allIds: []},
    trainings: {byId: {}, allIds: []},
    exercises: {byId: {}, allIds: []},
    workouts: {byId: {}, allIds: [], byExerciseId: {}, plannedWorkouts: []},
    videoAnalyses: {byId: {}, allIds: []},
    settings: {mode: 'dark'},
    effects: {},
  }) as unknown as GlobalState;

const roundTrip = (payload: TrainingsPlanExportPayload) => {
  const serialized: TrainingsPlanExportPayload = JSON.parse(JSON.stringify(payload));
  const imported = fullStateReducer(emptyTargetState(), {type: 'IMPORT_TRAININGS_PLAN', payload: serialized});
  const workoutId = imported.workouts.allIds[0];
  return imported.workouts.byId[workoutId].sets;
};

describe('plan export/import with ranges (GH-63)', () => {
  it('exports the range bounds of every planned set', () => {
    const payload = buildTrainingsPlanExportPayload(plan, buildState([rangedSet, fixedSet]));
    expect(payload.workouts[0].sets).toEqual([rangedSet, fixedSet]);
  });

  it('keeps the ranges through a serialise → import round trip', () => {
    const payload = buildTrainingsPlanExportPayload(plan, buildState([rangedSet, fixedSet]));
    expect(roundTrip(payload)).toEqual([rangedSet, fixedSet]);
  });

  it('imports a plan from an older version, which has no range keys at all', () => {
    // Exactly what a pre-GH-63 export file contains for these sets.
    const legacyPayload: TrainingsPlanExportPayload = {
      trainingsPlan: {id: 1, name: 'Push pull', trainings: {'1,1': 1}, trainingNames: {'1': 'Pull'}},
      trainings: [
        {
          id: 1,
          state: TrainingsState.PLANNED,
          plannedWorkouts: {10: 100},
          doneWorkoutIds: {},
          exercises: [10],
        },
      ],
      exercises: [{id: 10, name: 'Bench', muscles: []}],
      workouts: [{id: 100, exerciseId: 10, sets: [{index: 1, reps: 8, rir: 1, weight: 100}]}],
    };

    const sets = roundTrip(legacyPayload);
    expect(sets).toEqual([{index: 1, reps: 8, rir: 1, weight: 100}]);
    expect(Object.keys(sets[0]).sort()).toEqual(['index', 'reps', 'rir', 'weight']);
  });
});
