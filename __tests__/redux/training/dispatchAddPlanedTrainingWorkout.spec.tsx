import {renderHook} from '@testing-library/react-native';
import {useDispatch} from 'react-redux';
import {dispatchAddPlanedTrainingWorkout} from '../../../app/redux/Training/dispatch/plan/dispatchAddPlanedTrainingWorkout';
import {useNextTrainingsId} from '../../../app/redux/Training/use/useNextTrainingsId';
import {useNextWorkoutId} from '../../../app/redux/Workout/use/useNextWorkoutId';

// GH-324 P1 regression: leaving full edit commits one still-unblurred pending
// set per exercise in a synchronous loop (PlanTab.commitValidPendingSets).
// Each new-workout allocation used to read the SAME `useNextWorkoutId()`
// value (only refreshed on the next render), so two exercises without an
// existing planned workout ended up dispatching ADD_PLANED_TRAINING_WORKOUT
// with an IDENTICAL nextWorkoutId — the second dispatch's reducer write then
// clobbered the first exercise's workout slot in `workoutState.byId`.

jest.mock('react-redux', () => ({useDispatch: jest.fn()}));

jest.mock('../../../app/redux/Training/use/useNextTrainingsId', () => ({
  useNextTrainingsId: jest.fn(),
}));

jest.mock('../../../app/redux/Workout/use/useNextWorkoutId', () => ({
  useNextWorkoutId: jest.fn(),
}));

const mockDispatch = jest.fn();
const mockedUseDispatch = jest.mocked(useDispatch);
const mockedUseNextTrainingsId = jest.mocked(useNextTrainingsId);
const mockedUseNextWorkoutId = jest.mocked(useNextWorkoutId);

describe('dispatchAddPlanedTrainingWorkout', () => {
  beforeEach(() => {
    mockedUseDispatch.mockReturnValue(mockDispatch);
    mockedUseNextTrainingsId.mockReturnValue(900);
    mockedUseNextWorkoutId.mockReturnValue(5);
    mockDispatch.mockReset();
  });

  it('allocates a unique, incrementing workout id per call when invoked twice for different exercises within the same render (GH-324 P1)', () => {
    const {result} = renderHook(() => dispatchAddPlanedTrainingWorkout());
    const addPlannedWorkout = result.current;

    addPlannedWorkout(1, 1, 1, 11, {exerciseId: 11, sets: [], notes: '', start: new Date()}, 900);
    addPlannedWorkout(1, 1, 1, 22, {exerciseId: 22, sets: [], notes: '', start: new Date()}, 900);

    expect(mockDispatch).toHaveBeenCalledTimes(2);
    const firstAction = mockDispatch.mock.calls[0][0];
    const secondAction = mockDispatch.mock.calls[1][0];

    expect(firstAction.exerciseId).toBe(11);
    expect(secondAction.exerciseId).toBe(22);
    expect(firstAction.nextWorkoutId).toBe(5);
    // Must differ from the first call's id — otherwise the second exercise's
    // workout is written to the same `workoutState.byId` slot as the first,
    // and both exercises end up pointing at one shared (wrong) workout.
    expect(secondAction.nextWorkoutId).toBe(6);
  });

  it('does not allocate a new id when the workout already has one', () => {
    const {result} = renderHook(() => dispatchAddPlanedTrainingWorkout());
    const addPlannedWorkout = result.current;

    addPlannedWorkout(1, 1, 1, 11, {id: 42, exerciseId: 11, sets: [], notes: '', start: new Date()}, 900);

    expect(mockDispatch.mock.calls[0][0].nextWorkoutId).toBe(42);
  });
});
