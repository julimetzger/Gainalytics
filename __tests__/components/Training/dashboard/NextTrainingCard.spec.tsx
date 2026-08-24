import React from 'react';
import {act, fireEvent, render} from '@testing-library/react-native';
import {PaperProvider} from 'react-native-paper';
import NextTrainingCard, {formatElapsed} from '../../../../app/components/Training/dashboard/NextTrainingCard';
import {TrainingsState} from '../../../../app/models/TrainingsState';
import {TrainingsPlan} from '../../../../app/models/entities/TrainingsPlan';

// ---------------------------------------------------------------------------
// Shared mock state: exercises 1 (focus), 2, 3 (non-focus)
// ---------------------------------------------------------------------------
const MOCK_STATE = {
  exercises: {
    byId: {
      1: {id: 1, name: 'Focus Squat', isFocus: true},
      2: {id: 2, name: 'Bench Press', isFocus: false},
      3: {id: 3, name: 'Deadlift', isFocus: false},
    },
  },
  trainings: {byId: {}},
  workouts: {byId: {}},
};

jest.mock('react-redux', () => ({
  useSelector: (selector: (s: typeof MOCK_STATE) => unknown) => selector(MOCK_STATE),
}));

// Training with exercises [2, 3, 1] — focus exercise (1) is last in array.
// After prioritisation it must appear as exercise1.
const BASE_TRAINING = {
  id: 10,
  exercises: [2, 3, 1],
  doneWorkoutIds: {},
  plannedWorkouts: {},
};

// Mutable so individual tests can switch the training's state (GH-401).
let MOCK_TRAINING: Record<string, unknown> = {...BASE_TRAINING};

jest.mock('../../../../app/redux/Training/use/useTraining', () => ({
  useTraining: () => MOCK_TRAINING,
}));

jest.mock('../../../../app/redux/Exercises/use/useExercise', () => ({
  useExercise: (id?: number) => {
    const map: Record<number, {id: number; name: string; isFocus?: boolean}> = {
      1: {id: 1, name: 'Focus Squat', isFocus: true},
      2: {id: 2, name: 'Bench Press', isFocus: false},
      3: {id: 3, name: 'Deadlift', isFocus: false},
    };
    return id !== undefined ? map[id] : undefined;
  },
}));

jest.mock('../../../../app/redux/Training/use/usePlannedWorkoutInTraining', () => ({
  usePlannedWorkoutInTraining: () => undefined,
}));

jest.mock('../../../../app/redux/Training/trainingsPlanReducer', () => ({
  getLocalMicro: () => 1,
  getMesoForMicro: () => undefined,
  getMicroFromTrainingInMicroIndex: (k: string) => parseInt(k.split(',')[0], 10),
  getTrainingFromTrainingInMicroIndex: (k: string) => parseInt(k.split(',')[1], 10),
  trainingInMicroIndex: (m: number, t: number) => `${m},${t}`,
}));

const MOCK_PLAN: TrainingsPlan = {
  id: 1,
  name: 'Test Plan',
  trainings: {'1,1': 10},
  mesos: [],
  trainingNames: {'1': 'Day A'},
};

const mockNavigation = {navigate: jest.fn()} as unknown as Parameters<typeof NextTrainingCard>[0]['navigation'];

const renderCard = (props?: Partial<Parameters<typeof NextTrainingCard>[0]>) =>
  render(
    <PaperProvider>
      <NextTrainingCard
        plan={MOCK_PLAN}
        nextMicro={1}
        nextTrainingNum={1}
        isComplete={false}
        navigation={mockNavigation}
        {...props}
      />
    </PaperProvider>,
  );

beforeEach(() => {
  MOCK_TRAINING = {...BASE_TRAINING};
  jest.mocked(mockNavigation.navigate).mockClear();
});

describe('NextTrainingCard — focus exercise prioritisation', () => {
  it('shows the isFocus exercise as the first listed exercise', () => {
    const {getByTestId, queryByTestId} = renderCard();
    // target-1 is rendered for exerciseId1 which must be the focus exercise (id=1)
    // The planned workout is undefined so target text is not shown, but we can
    // verify the exercise name appears somewhere before "Bench Press".
    expect(queryByTestId('next-training-target-1')).toBeNull(); // no planned workout → no target text
    expect(queryByTestId('next-training-target-2')).toBeNull();
    // Both exercise names appear
    const {getAllByText} = renderCard();
    const focusNames = getAllByText('Focus Squat');
    const otherNames = getAllByText('Bench Press');
    expect(focusNames.length).toBeGreaterThan(0);
    expect(otherNames.length).toBeGreaterThan(0);
  });

  it('places the isFocus exercise before non-focus exercises (order in rendered output)', () => {
    const {queryAllByText, getAllByText} = renderCard();
    // Focus Squat (id=1) must be exerciseId1 even though it is index 2 in training.exercises.
    // Deadlift (id=3) is at index 1 in the array but is non-focus, so it must NOT appear:
    // Focus Squat (focus) + Bench Press (non-focus[0]) fill the 2 slots.
    expect(queryAllByText('Deadlift')).toHaveLength(0);
    expect(getAllByText('Focus Squat').length).toBeGreaterThan(0);
    expect(getAllByText('Bench Press').length).toBeGreaterThan(0);
  });
});

// ── GH-401 ───────────────────────────────────────────────────────────────────

describe('formatElapsed', () => {
  it('renders MM:SS below an hour and H:MM:SS above it', () => {
    expect(formatElapsed(0)).toBe('00:00');
    expect(formatElapsed(64_000)).toBe('01:04');
    expect(formatElapsed(3_784_000)).toBe('1:03:04');
  });

  it('clamps a start timestamp in the future to zero instead of rendering a negative time', () => {
    expect(formatElapsed(-5_000)).toBe('00:00');
  });
});

describe('NextTrainingCard — GH-401 H1: the card navigates, it never starts', () => {
  it('labels the button "Next Training" and opens the Train tab of that training', () => {
    const {getByTestId, getAllByText, queryByText} = renderCard();

    expect(getByTestId('next-training-status-label').props.children).toBe('Next Training');
    // The audit's core complaint: the app's most prominent button said
    // "Start Training" and did not start a training.
    expect(queryByText('Start Training')).toBeNull();
    // status label + button
    expect(getAllByText('Next Training')).toHaveLength(2);

    fireEvent.press(getByTestId('next-training-start-button'));

    expect(mockNavigation.navigate).toHaveBeenCalledWith({
      name: 'TrainingPlan',
      params: {trainingsPlan: MOCK_PLAN, micro: 1, training: 1, subTab: 'train'},
    });
  });

  it('shows no elapsed time while the training has not been started', () => {
    const {queryByTestId} = renderCard();
    expect(queryByTestId('next-training-elapsed')).toBeNull();
  });
});

describe('NextTrainingCard — GH-401 H4: a running session reads as running', () => {
  const START = new Date('2026-08-24T10:00:00.000Z');

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(START.getTime() + 3 * 60_000 + 4_000));
    MOCK_TRAINING = {...BASE_TRAINING, state: TrainingsState.STARTED, start: START.toISOString()};
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('labels the session running, shows the elapsed time and offers "Continue Training"', () => {
    const {getByTestId, queryByText} = renderCard();

    expect(getByTestId('next-training-status-label').props.children).toBe('Training running');
    expect(getByTestId('next-training-elapsed').props.children).toBe('03:04');
    expect(queryByText('Continue Training')).toBeTruthy();
    expect(queryByText('Next Training')).toBeNull();
  });

  it('keeps the elapsed time ticking', () => {
    const {getByTestId} = renderCard();
    expect(getByTestId('next-training-elapsed').props.children).toBe('03:04');

    act(() => {
      jest.advanceTimersByTime(2_000);
    });

    expect(getByTestId('next-training-elapsed').props.children).toBe('03:06');
  });

  it('still only navigates — continuing must not restart the session', () => {
    const {getByTestId} = renderCard();
    fireEvent.press(getByTestId('next-training-start-button'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith({
      name: 'TrainingPlan',
      params: {trainingsPlan: MOCK_PLAN, micro: 1, training: 1, subTab: 'train'},
    });
  });
});
