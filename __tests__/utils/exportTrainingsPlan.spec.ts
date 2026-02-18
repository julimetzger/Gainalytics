jest.mock('react-native-fs', () => ({
  DownloadDirectoryPath: '/downloads',
  writeFile: jest.fn(),
}));


import {buildTrainingsPlanExportPayload} from '../../app/utils/exportTrainingsPlan';
import {TrainingsPlan} from '../../app/models/TrainingsPlan';
import {TrainingsState} from '../../app/models/TrainingsState';
import {GlobalState} from '../../app/redux/rootReducer';

const buildState = (): GlobalState =>
  ({
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
          id: 1,
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
        10: {id: 10, name: 'Bench', description: '', muscles: []},
        11: {id: 11, name: 'Squat', description: '', muscles: []},
        12: {id: 12, name: 'Deadlift', description: '', muscles: []},
        13: {id: 13, name: 'Deadlift', description: '', muscles: []},
      },
      allIds: [10, 11, 12],
    },
    workouts: {
      byId: {
        100: {id: 100, name: 'Bench 5x5', sets: []},
        101: {id: 101, name: 'Squat 5x5', sets: []},
        102: {id: 102, name: 'Deadlift 5x5', sets: []},
      },
      allIds: [100, 101, 102],
    },
  } as unknown as GlobalState);

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

    expect(payload.trainingsPlan).toEqual(plan);
    expect(payload.trainings).toHaveLength(2);
    expect(payload.trainings[0].id).toBe(1);
    expect(payload.trainings[0].exercises).toEqual([10, 11]);
    expect(payload.trainings[0].doneWorkoutIds).toEqual({});
    expect(payload.exercises.map((exercise) => exercise.id).sort()).toEqual([10, 11, 12]);
    expect(payload.workouts.map((workout) => workout.id).sort()).toEqual([100, 101,102]);
  });
});
