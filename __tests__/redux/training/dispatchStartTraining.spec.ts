import {useDispatch} from 'react-redux';
import {dispatchStartTraining} from '../../../app/redux/Training/dispatch/plan/dispatchStartTraining';
import {useTraining} from '../../../app/redux/Training/use/useTraining';
import {TrainingsState} from '../../../app/models/TrainingsState';

jest.mock('react-redux', () => ({
  useDispatch: jest.fn(),
}));

jest.mock('../../../app/redux/Training/use/useTraining', () => ({
  useTraining: jest.fn(),
}));

const mockDispatch = jest.fn();
const mockedUseDispatch = jest.mocked(useDispatch);
const mockedUseTraining = jest.mocked(useTraining);

describe('dispatchStartTraining', () => {
  beforeEach(() => {
    mockedUseDispatch.mockReturnValue(mockDispatch);
    mockDispatch.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('dismisses a stale rest timer when a PLANNED training actually starts (GH-364)', () => {
    mockedUseTraining.mockReturnValue({
      id: 3,
      exercises: [],
      plannedWorkouts: {},
      doneWorkoutIds: {},
      state: TrainingsState.PLANNED,
    });

    const startTraining = dispatchStartTraining(3);
    startTraining();

    expect(mockDispatch).toHaveBeenCalledTimes(2);
    expect(mockDispatch).toHaveBeenNthCalledWith(1, {type: 'DISMISS_REST_TIMER'});
    expect(mockDispatch).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({type: 'START_TRAINING', trainingsId: 3}),
    );
  });

  it('does NOT dismiss the rest timer when re-entering an already-STARTED training', () => {
    mockedUseTraining.mockReturnValue({
      id: 3,
      exercises: [],
      plannedWorkouts: {},
      doneWorkoutIds: {},
      state: TrainingsState.STARTED,
    });

    const startTraining = dispatchStartTraining(3);
    startTraining();

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({type: 'START_TRAINING', trainingsId: 3}));
    expect(mockDispatch).not.toHaveBeenCalledWith({type: 'DISMISS_REST_TIMER'});
  });
});
