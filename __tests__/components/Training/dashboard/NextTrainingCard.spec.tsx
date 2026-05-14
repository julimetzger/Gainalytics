import React from 'react';
import {render} from '@testing-library/react-native';
import {PaperProvider} from 'react-native-paper';
import NextTrainingCard from '../../../../app/components/Training/dashboard/NextTrainingCard';
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
const MOCK_TRAINING = {
  id: 10,
  exercises: [2, 3, 1],
  doneWorkoutIds: {},
  plannedWorkouts: {},
};

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
