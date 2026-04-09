import {useDispatch} from 'react-redux';
import {dispatchSuggestBasedOnPlanned} from '../../../app/redux/Training/dispatch/plan/dispatchSuggestBasedOnPlanned';
import {dispatchSuggestBasedOnTrained} from '../../../app/redux/Training/dispatch/plan/dispatchSuggestBasedOnTrained';
import {useNextTrainingsId} from '../../../app/redux/Training/use/useNextTrainingsId';
import {useLastTrainingInMicro} from '../../../app/redux/Training/use/useLastTrainingInMicro';
import {useNextWorkoutId} from '../../../app/redux/Workout/use/useNextWorkoutId';
import {useWorkoutsByIds} from '../../../app/redux/Workout/use/useWorkoutsByIds';
import {Workout} from '../../../app/models/entities/Workout';
import {TrainingsState} from '../../../app/models/TrainingsState';

jest.mock('react-redux', () => ({
  useDispatch: jest.fn(),
}));

jest.mock('../../../app/redux/Training/use/useNextTrainingsId', () => ({
  useNextTrainingsId: jest.fn(),
}));

jest.mock('../../../app/redux/Training/use/useLastTrainingInMicro', () => ({
  useLastTrainingInMicro: jest.fn(),
}));

jest.mock('../../../app/redux/Workout/use/useNextWorkoutId', () => ({
  useNextWorkoutId: jest.fn(),
}));

jest.mock('../../../app/redux/Workout/use/useWorkoutsByIds', () => ({
  useWorkoutsByIds: jest.fn(),
}));

const mockDispatch = jest.fn();
const mockedUseDispatch = jest.mocked(useDispatch);
const mockedUseNextTrainingsId = jest.mocked(useNextTrainingsId);
const mockedUseLastTrainingInMicro = jest.mocked(useLastTrainingInMicro);
const mockedUseNextWorkoutId = jest.mocked(useNextWorkoutId);
const mockedUseWorkoutsByIds = jest.mocked(useWorkoutsByIds);

describe('training suggestion dispatchers', () => {
  const sourceWorkout = {
    id: 200,
    exerciseId: 7,
    notes: '',
    sets: [{index: 1, reps: 5, rir: 2, weight: 100}],
  } satisfies Workout;

  beforeEach(() => {
    mockedUseDispatch.mockReturnValue(mockDispatch);
    mockedUseNextTrainingsId.mockReturnValue(55);
    mockedUseNextWorkoutId.mockReturnValue(80);
    mockDispatch.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('applies progression when suggesting from the last planned training', () => {
    mockedUseLastTrainingInMicro.mockReturnValue({
      id: 13,
      exercises: [7],
      plannedWorkouts: {7: 200},
      doneWorkoutIds: {},
      state: TrainingsState.FINISHED,
    });
    mockedUseWorkoutsByIds.mockReturnValue([sourceWorkout]);

    const suggestTraining = dispatchSuggestBasedOnPlanned(4, 2, 3, {
      rirDelta: 1,
      weightIncreasePercent: 5,
    });

    suggestTraining?.(4, 3, 2);

    expect(mockedUseLastTrainingInMicro).toHaveBeenCalledWith(4, 2, 3);
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SUGGEST_TRAINING',
      trainingsPlanId: 4,
      microNumber: 3,
      trainingInMicroNumber: 2,
      nextTrainingsId: 55,
      lastTrainingInMicro: {
        id: 13,
        exercises: [7],
        plannedWorkouts: {7: 200},
        doneWorkoutIds: {},
        state: TrainingsState.FINISHED,
      },
      workoutIdWorkoutMap: new Map([
        [
          80,
          {
            id: 200,
            exerciseId: 7,
            notes: '',
            sets: [{index: 1, reps: 5, rir: 1, weight: 108}],
          },
        ],
      ]),
    });
  });

  it('applies progression when suggesting from the last done training', () => {
    mockedUseLastTrainingInMicro.mockReturnValue({
      id: 21,
      exercises: [7],
      plannedWorkouts: {},
      doneWorkoutIds: {7: 200},
      state: TrainingsState.FINISHED,
    });
    mockedUseWorkoutsByIds.mockReturnValue([sourceWorkout]);

    const suggestTraining = dispatchSuggestBasedOnTrained(4, 2, 3, {
      rirDelta: 1,
      weightIncreasePercent: 5,
    });

    suggestTraining?.(4, 3, 2);

    expect(mockedUseLastTrainingInMicro).toHaveBeenCalledWith(4, 2, 3);
    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'SUGGEST_TRAINING',
      trainingsPlanId: 4,
      microNumber: 3,
      trainingInMicroNumber: 2,
      nextTrainingsId: 55,
      lastTrainingInMicro: {
        id: 21,
        exercises: [7],
        plannedWorkouts: {},
        doneWorkoutIds: {7: 200},
        state: TrainingsState.FINISHED,
      },
      workoutIdWorkoutMap: new Map([
        [
          80,
          {
            id: 200,
            exerciseId: 7,
            notes: '',
            sets: [{index: 1, reps: 5, rir: 1, weight: 108}],
          },
        ],
      ]),
    });
  });
});
