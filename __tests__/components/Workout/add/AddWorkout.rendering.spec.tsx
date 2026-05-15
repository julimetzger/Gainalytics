import React from 'react';
import {act, render} from '@testing-library/react-native';
import {Provider} from 'react-redux';
import {AnyAction, createStore} from 'redux';
import AddWorkout from '../../../../app/components/Workout/add/AddWorkout';
import rootReducer, {GlobalState} from '../../../../app/redux/rootReducer';
import {NormalizedWorkoutState} from '../../../../app/redux/normalizedWorkoutState';
import {Exercise} from '../../../../app/models/entities/Exercise';
import {Workout} from '../../../../app/models/entities/Workout';
import {WorkoutSet} from '../../../../app/models/entities/WorkoutSet';

jest.mock('react-redux', () => jest.requireActual('react-redux'));

let mockAddWorkoutSetRenderCount = 0;

jest.mock('../../../../app/components/Workout/add/AddWorkoutSet', () => {
  const React = require('react');
  const {Text, View} = require('react-native');

  return () => {
    mockAddWorkoutSetRenderCount += 1;
    return (
      <View testID="mock-add-workout-set">
        <Text>AddWorkoutSet</Text>
      </View>
    );
  };
});

jest.mock('../../../../app/components/Workout/add/SetRow', () => {
  const React = require('react');
  const {Text, View} = require('react-native');

  return ({workoutSet}: {workoutSet: WorkoutSet}) => (
    <View testID={`mock-set-row-${workoutSet.index}`}>
      <Text>Set {workoutSet.index}</Text>
    </View>
  );
});

jest.mock('../../../../app/components/video/VideoSelectionModal', () => () => null);

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TouchableOpacity} = require('react-native');

  return {
    Button: ({children, disabled, onPress, testID}: {children: React.ReactNode; disabled?: boolean; onPress?: () => void; testID?: string}) => (
      <TouchableOpacity
        testID={testID}
        accessibilityState={{disabled: !!disabled}}
        onPress={() => {
          if (!disabled) {
            onPress?.();
          }
        }}
      >
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
    Icon: () => null,
    Text: ({children}: {children: React.ReactNode}) => <Text>{children}</Text>,
    useTheme: () => ({
      colors: {
        primary: '#000000',
        onPrimary: '#ffffff',
        secondary: '#222222',
      },
    }),
  };
});

const TEST_DATE = new Date('2024-05-01T00:00:00.000Z');

const baseGlobalState = {
  exercises: {byId: {}, allIds: []},
  workouts: {byId: {}, allIds: [], byExerciseId: {}, plannedWorkouts: []},
  trainingsPlan: {byId: {}, allIds: []},
  trainings: {byId: {}, allIds: []},
  videoAnalyses: {byId: {}, allIds: []},
  settings: {mode: 'dark'},
  effects: {},
  aiChat: {messages: [], isLoading: false, error: null, seedContextJson: null, contextRange: null},
} satisfies GlobalState;

const buildState = (workouts: NormalizedWorkoutState<Workout>): GlobalState => ({
  ...baseGlobalState,
  workouts,
});

const testReducer = (state: GlobalState | undefined, action: AnyAction): GlobalState => rootReducer(state ?? baseGlobalState, action);

const unfinishedSet = {
  index: 1,
  reps: 5,
  rir: 1,
  weight: 100,
  date: TEST_DATE,
} satisfies WorkoutSet;

const suggestedSet = {
  index: 2,
  reps: 5,
  rir: 1,
  weight: 102.5,
} satisfies WorkoutSet;

const unfinishedWorkout = {
  id: 101,
  exerciseId: 7,
  notes: '',
  start: TEST_DATE,
  sets: [unfinishedSet],
} satisfies Workout;

const suggestedWorkout = {
  exerciseId: 7,
  notes: '',
  sets: [suggestedSet],
} satisfies Workout;

const workoutState = {
  byId: {
    101: unfinishedWorkout,
  },
  allIds: [101],
  byExerciseId: {
    7: [101],
  },
  notFinishedWorkouts: {
    7: 101,
  },
  suggestedWorkouts: {
    7: suggestedWorkout,
  },
  plannedWorkouts: [],
} satisfies NormalizedWorkoutState<Workout>;

describe('AddWorkout selector rendering', () => {
  const exercise = {
    id: 7,
    name: 'Bench Press',
  } satisfies Exercise;

  beforeEach(() => {
    mockAddWorkoutSetRenderCount = 0;
  });

  it('does not re-render on unrelated redux dispatches', () => {
    const store = createStore(testReducer, buildState(workoutState));

    const {getByTestId} = render(
      <Provider store={store}>
        <AddWorkout exercise={exercise} onSubmit={jest.fn()} trainingsId={3} date={TEST_DATE} />
      </Provider>,
    );
    expect(getByTestId('mock-add-workout-set')).toBeTruthy();
    const renderCountAfterMount = mockAddWorkoutSetRenderCount;

    act(() => {
      store.dispatch({type: 'TOGGLE_MODE'});
    });

    expect(mockAddWorkoutSetRenderCount).toBe(renderCountAfterMount);
  });
});
