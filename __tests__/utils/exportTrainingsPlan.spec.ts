jest.mock('react-native-fs', () => ({
  DownloadDirectoryPath: '/downloads',
  writeFile: jest.fn(),
}));

import {buildTrainingsPlanExportPayload} from '../../app/utils/exportTrainingsPlan';
import {TrainingsPlan} from '../../app/models/entities/TrainingsPlan';
import {TrainingsState} from '../../app/models/TrainingsState';
import {GlobalState} from '../../app/redux/rootReducer';

const buildState = (): GlobalState =>
  ({
    trainingsPlan: {
      byId: {},
      allIds: [],
    },
    trainings: {
      byId: {
        1: {
          id: 1,
          state: TrainingsState.PLANNED,
          plannedWorkouts: {10: 100, 11: 101},
          doneWorkoutIds: {10: 999},
          exercises: [10, 11, 12],
        },
        2: {
          id: 2,
          state: TrainingsState.STARTED,
          plannedWorkouts: {12: 102},
          doneWorkoutIds: {12: 998},
          exercises: [12],
        },
        3: {
          id: 3,
          state: TrainingsState.PLANNED,
          plannedWorkouts: {},
          doneWorkoutIds: {13: 1000},
          exercises: [13],
        },
      },
      allIds: [1, 2, 3],
    },
    exercises: {
      byId: {
        10: {
          id: 10,
          name: 'Bench',
          muscles: [],
          records: {'1RM': [{value: 12, workoutId: 100}]},
          vlReference: {rir: 1, velocityLossPercent: 28, referencedAt: '2026-03-15T10:00:00.000Z', analysisId: 7, workoutId: 100, setIndex: 1},
        },
        11: {id: 11, name: 'Squat', muscles: []},
        12: {id: 12, name: 'Deadlift', muscles: []},
        13: {id: 13, name: 'Deadlift', muscles: []},
      },
      allIds: [10, 11, 12, 13],
    },
    workouts: {
      byId: {
        100: {id: 100, sets: [], exerciseId: 10},
        101: {id: 101, sets: [], exerciseId: 11},
        102: {id: 102, sets: [], exerciseId: 12},
      },
      allIds: [100, 101, 102],
      byExerciseId: {},
      plannedWorkouts: [],
    },
    videoAnalyses: {
      byId: {},
      allIds: [],
    },
    effects: {},
    settings: {
      mode: 'dark',
    },
  } satisfies GlobalState);

describe('buildTrainingsPlanExportPayload', () => {
  it('exports only planned exercises and clears done workouts', () => {
    const plan: TrainingsPlan = {
      id: 99,
      name: 'Strength',
      trainings: {
        '1:1': 1,
        '1:2': 2,
      },
      trainingNames: {},
    };

    const payload = buildTrainingsPlanExportPayload(plan, buildState());

    const expectedPayload = {
      trainingsPlan: {
        id: 99,
        name: 'Strength',
        trainings: {
          '1:1': 1,
          '1:2': 2,
        },
        trainingNames: {},
      },
      trainings: [
        {
          id: 1,
          state: TrainingsState.PLANNED,
          plannedWorkouts: {10: 100, 11: 101},
          doneWorkoutIds: {},
          exercises: [10, 11],
          start: undefined,
          end: undefined,
        },
        {
          id: 2,
          state: TrainingsState.PLANNED,
          plannedWorkouts: {12: 102},
          doneWorkoutIds: {},
          exercises: [12],
          start: undefined,
          end: undefined,
        },
      ],
      exercises: [
        {id: 10, name: 'Bench', muscles: []},
        {id: 11, name: 'Squat', muscles: []},
        {id: 12, name: 'Deadlift', muscles: []},
      ],
      workouts: [
        {id: 100, exerciseId: 10, sets: []},
        {id: 101, exerciseId: 11, sets: []},
        {id: 102, exerciseId: 12, sets: []},
      ],
    };

    expect(payload).toEqual(expectedPayload);
  });

  // GH-316: the VL reference is calibrated from the owner's own filmed set. Sharing a plan
  // must not hand that anchor to the recipient — their curve would be scaled by someone
  // else's bar speed.
  it('strips the VL reference from every exported exercise, in the object and in the written JSON', () => {
    const plan: TrainingsPlan = {
      id: 99,
      name: 'Strength',
      trainings: {'1:1': 1},
      trainingNames: {},
    };

    const state = buildState();
    expect(state.exercises.byId[10].vlReference).toBeDefined();

    const payload = buildTrainingsPlanExportPayload(plan, state);

    const bench = payload.exercises.find((exercise) => exercise.id === 10);
    expect(bench).toBeDefined();
    expect(Object.keys(bench!)).not.toContain('vlReference');
    expect(JSON.parse(JSON.stringify(payload))).not.toHaveProperty('exercises.0.vlReference');
    expect(JSON.stringify(payload)).not.toContain('vlReference');

    // The reference stays on the exercise in the store — only the shared copy loses it,
    // so the full `.gains` backup (which serialises the raw state) still restores it.
    expect(state.exercises.byId[10].vlReference).toEqual({
      rir: 1,
      velocityLossPercent: 28,
      referencedAt: '2026-03-15T10:00:00.000Z',
      analysisId: 7,
      workoutId: 100,
      setIndex: 1,
    });
  });

  it('does not mutate the provided trainings plan object while removing lastTraining in export payload', () => {
    const plan: TrainingsPlan = {
      id: 100,
      name: 'Meet Prep',
      trainings: {
        '1:1': 1,
      },
      trainingNames: {},
      lastTraining: 1,
    };

    const initialPlanSnapshot = {
      id: 100,
      name: 'Meet Prep',
      trainings: {
        '1:1': 1,
      },
      trainingNames: {},
      lastTraining: 1,
    } satisfies TrainingsPlan;

    const payload = buildTrainingsPlanExportPayload(plan, buildState());

    const expectedExportPlan = {
      id: 100,
      name: 'Meet Prep',
      trainings: {
        '1:1': 1,
      },
      trainingNames: {},
    } satisfies TrainingsPlan;

    expect(plan).toEqual(initialPlanSnapshot);
    expect(payload.trainingsPlan).toStrictEqual(expectedExportPlan);
  });
});
