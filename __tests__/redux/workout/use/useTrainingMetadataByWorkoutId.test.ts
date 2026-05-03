import {TrainingsState} from '../../../../app/models/TrainingsState';
import {GlobalState} from '../../../../app/redux/rootReducer';
import {selectTrainingMetadataByWorkoutId} from '../../../../app/redux/Workout/use/useTrainingMetadataByWorkoutId';

function createState(overrides?: Partial<GlobalState>): GlobalState {
  const state = {
    exercises: {
      byId: {
        11: {id: 11, name: 'Back Squat'},
      },
      allIds: [11],
    },
    workouts: {
      byId: {
        101: {
          id: 101,
          exerciseId: 11,
          trainingsId: 201,
          sets: [],
          start: new Date('2026-04-01T18:00:00.000Z'),
          end: new Date('2026-04-01T18:45:00.000Z'),
        },
      },
      allIds: [101],
      byExerciseId: {11: [101]},
      plannedWorkouts: [],
    },
    trainingsPlan: {
      byId: {
        301: {
          id: 301,
          name: 'Competition Prep',
          trainings: {'7,2': 201},
          trainingNames: {2: 'Lower A'},
          mesos: [{id: 1, name: 'Meso 1', order: 1, startMicro: 1}],
        },
      },
      allIds: [301],
    },
    trainings: {
      byId: {
        201: {
          id: 201,
          doneWorkoutIds: {},
          plannedWorkouts: {},
          exercises: [11],
          start: new Date('2026-04-01T18:00:00.000Z'),
          end: new Date('2026-04-01T18:45:00.000Z'),
          state: TrainingsState.FINISHED,
        },
      },
      allIds: [201],
    },
    videoAnalyses: {
      byId: {},
      allIds: [],
    },
    settings: {
      mode: 'dark',
      palette: 'blue',
      videoAnalysisFiltersExpanded: false,
    },
    effects: {},
    aiChat: {
      messages: [],
      isLoading: false,
      error: null,
      seedContextJson: null,
      contextRange: null,
    },
    ...overrides,
  } satisfies GlobalState;

  return state;
}

describe('selectTrainingMetadataByWorkoutId', () => {
  it('returns training name and micro when the workout is linked into a plan', () => {
    expect(selectTrainingMetadataByWorkoutId(createState(), 101)).toEqual({
      trainingsId: 201,
      trainingsPlanId: 301,
      trainingName: 'Lower A',
      trainingInMicro: 2,
      micro: 7,
      start: new Date('2026-04-01T18:00:00.000Z'),
      end: new Date('2026-04-01T18:45:00.000Z'),
    });
  });

  it('falls back to raw training metadata when no trainings plan entry matches', () => {
    const state = createState({
      trainingsPlan: {
        byId: {},
        allIds: [],
      },
    });

    expect(selectTrainingMetadataByWorkoutId(state, 101)).toEqual({
      trainingsId: 201,
      start: new Date('2026-04-01T18:00:00.000Z'),
      end: new Date('2026-04-01T18:45:00.000Z'),
    });
  });

  it('returns undefined for orphaned analyses without a linked workout', () => {
    expect(selectTrainingMetadataByWorkoutId(createState(), undefined)).toEqual(undefined);
  });
});
