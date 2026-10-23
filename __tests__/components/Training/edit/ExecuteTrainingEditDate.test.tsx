import React from 'react';
import {render} from '@testing-library/react-native';
import {Provider as ReduxProvider} from 'react-redux';
import {Provider as PaperProvider} from 'react-native-paper';
import ExecuteTraining from '../../../../app/components/Training/execute/ExecuteTraining';
import {TrainingsState} from '../../../../app/models/TrainingsState';
import {Training} from '../../../../app/models/entities/Training';
import {Exercise} from '../../../../app/models/entities/Exercise';
import {Workout} from '../../../../app/models/entities/Workout';

global.setImmediate = ((callback: (...args: any[]) => void, ...args: any[]) => setTimeout(callback, 0, ...args)) as any;

jest.mock('react-native-gesture-handler', () => ({}));

const mockStore = {
  getState: () => ({
    workout: {allIds: [], byId: {}},
    exercise: {allIds: [], byId: {}},
  }),
  subscribe: () => () => {},
  dispatch: jest.fn(),
};

const EXISTING_WORKOUT_START = new Date('2026-03-04T08:00:00Z');
const mockWorkoutsById: {[id: number]: Workout} = {
  1: {id: 1, exerciseId: 10, trainingsId: 7, start: EXISTING_WORKOUT_START, end: EXISTING_WORKOUT_START, sets: [], notes: ''},
};

jest.mock('../../../../app/redux/Workout/use/useWorkoutById', () => ({
  useWorkoutById: jest.fn((id?: number) => (id === undefined ? undefined : mockWorkoutsById[id])),
}));
jest.mock('../../../../app/redux/Training/use/useNextTrainingsId', () => ({
  useNextTrainingsId: jest.fn(() => 99),
}));
jest.mock('../../../../app/redux/Workout/use/useUnfinishedWorkout', () => ({
  useUnfinishedWorkout: jest.fn(() => undefined),
  usePersistedUnfinishedWorkout: jest.fn(() => undefined),
}));
jest.mock('../../../../app/redux/Workout/use/useAllTimeOneRepMax', () => ({
  useAllTimeOneRepMax: jest.fn(() => undefined),
}));
jest.mock('../../../../app/redux/Workout/use/useLastFinishedWorkoutsByExerciseIds', () => ({
  useLastFinishedWorkoutsByExerciseIds: jest.fn(() => []),
}));
jest.mock('../../../../app/redux/settings/use/useSettings', () => ({
  useSettings: jest.fn(() => ({toggles: {}})),
}));
jest.mock('../../../../app/components/exercise/show/ExerciseHistory', () => 'ExerciseHistory');
jest.mock('../../../../app/components/Workout/show/WorkoutSetView', () => 'WorkoutSetView');
jest.mock('../../../../app/components/Workout/add/AddWorkout', () => 'AddWorkout');
jest.mock('../../../../app/components/Training/execute/RestTimerCard', () => 'RestTimerCard');
jest.mock('../../../../app/components/Training/execute/Estimated1RmCard', () => 'Estimated1RmCard');
jest.mock('../../../../app/components/Training/execute/ExerciseRecordsModal', () => 'ExerciseRecordsModal');
jest.mock('../../../../app/components/Training/execute/PlannedSetTarget', () => ({
  __esModule: true,
  default: 'PlannedSetTarget',
  resolveNextSetNumber: jest.fn(() => undefined),
}));

const TODAY = new Date('2026-10-23T12:00:00Z');
const TRAINING_START = new Date('2026-03-04T07:30:00Z');
const TRAINING_END = new Date('2026-03-04T09:00:00Z');

const historicalTraining = (start: Date | number | undefined): Training => ({
  id: 7,
  state: TrainingsState.FINISHED,
  doneWorkoutIds: {10: 1},
  plannedWorkouts: {},
  exercises: [10, 20],
  start: start as Date | undefined,
  end: TRAINING_END,
});

const squat = {id: 10, name: 'Squat'} satisfies Exercise;
const newExercise = {id: 20, name: 'Bench Press'} satisfies Exercise;

const renderExecute = (training: Training, exercise: Exercise, editMode: boolean) => {
  const ui = (t: Training, e: Exercise) => (
    <ReduxProvider store={mockStore as any}>
      <PaperProvider>
        <ExecuteTraining training={t} chosenExercise={e} onSubmit={() => {}} editMode={editMode} />
      </PaperProvider>
    </ReduxProvider>
  );
  const result = render(ui(training, exercise));
  const addWorkoutDate = (): Date => result.UNSAFE_getByType('AddWorkout' as any).props.date;
  return {
    ...result,
    addWorkoutDate,
    rerenderWith: (t: Training, e: Exercise = exercise) => result.rerender(ui(t, e)),
  };
};

describe('ExecuteTraining date in edit mode (GH-542)', () => {
  beforeEach(() => {
    jest.useFakeTimers({now: TODAY});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('records a newly added exercise of a historical training on the training date, not today', () => {
    const {addWorkoutDate} = renderExecute(historicalTraining(TRAINING_START), newExercise, true);

    expect(addWorkoutDate()).toEqual(TRAINING_START);
  });

  it('follows Training Times changes for a newly added exercise', () => {
    const {addWorkoutDate, rerenderWith} = renderExecute(historicalTraining(TRAINING_START), newExercise, true);
    const movedStart = new Date('2026-02-11T18:15:00Z');

    // EDIT_TRAINING_TIMES stores epoch ms, not a Date
    rerenderWith(historicalTraining(movedStart.getTime()));

    expect(addWorkoutDate()).toEqual(movedStart);
  });

  it('falls back to the training end when the training has no start', () => {
    const {addWorkoutDate} = renderExecute(historicalTraining(undefined), newExercise, true);

    expect(addWorkoutDate()).toEqual(TRAINING_END);
  });

  it('keeps the own start of an existing workout, also after Training Times changes', () => {
    const {addWorkoutDate, rerenderWith} = renderExecute(historicalTraining(TRAINING_START), squat, true);

    expect(addWorkoutDate()).toEqual(EXISTING_WORKOUT_START);

    rerenderWith(historicalTraining(new Date('2026-02-11T18:15:00Z').getTime()));

    expect(addWorkoutDate()).toEqual(EXISTING_WORKOUT_START);
  });

  it('does not carry the date of the previously shown exercise over to a newly added one', () => {
    // Picking another exercise in the strip re-renders the same pane instead of remounting it.
    const {addWorkoutDate, rerenderWith} = renderExecute(historicalTraining(TRAINING_START), squat, true);

    rerenderWith(historicalTraining(TRAINING_START), newExercise);

    expect(addWorkoutDate()).toEqual(TRAINING_START);
  });

  it('still uses today for a new exercise outside edit mode', () => {
    const {addWorkoutDate} = renderExecute(historicalTraining(TRAINING_START), newExercise, false);

    expect(addWorkoutDate()).toEqual(TODAY);
  });
});
