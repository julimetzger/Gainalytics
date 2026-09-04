/**
 * Tests verifying that ExecuteTraining correctly delegates notification lifecycle
 * to the onScheduleNotification / onCancelNotification callbacks (GH-252).
 */
import React from 'react';
import {act, fireEvent, render} from '@testing-library/react-native';
import {TrainingsState} from '../../../../app/models/TrainingsState';

// ── heavy component mocks ────────────────────────────────────────────────────

// Capture the latest onSubmitSet callback so tests can trigger it directly.
let capturedOnSubmitSet: ((ws: any, context?: {isExistingSet: boolean}) => void) | undefined;
jest.mock('../../../../app/components/Workout/add/AddWorkout', () => {
  const {View} = require('react-native');
  return (props: any) => {
    capturedOnSubmitSet = props.onSubmitSet;
    return <View testID="add-workout-mock" />;
  };
});

jest.mock('../../../../app/components/Training/execute/RestTimerCard', () => {
  const {TouchableOpacity, Text, View} = require('react-native');
  return ({onReset, onSkip}: any) => (
    <View testID="rest-timer-card-mock">
      <TouchableOpacity testID="mock-reset" onPress={onReset}><Text>Reset</Text></TouchableOpacity>
      <TouchableOpacity testID="mock-skip" onPress={onSkip}><Text>Skip</Text></TouchableOpacity>
    </View>
  );
});

jest.mock('../../../../app/components/picker/date/DatePicker', () => {
  const {View} = require('react-native');
  return () => <View />;
});

jest.mock('../../../../app/components/exercise/show/ExerciseHistory', () => {
  const {View} = require('react-native');
  return () => <View />;
});

jest.mock('../../../../app/components/Workout/show/WorkoutSetView', () => {
  const {View} = require('react-native');
  return () => <View />;
});

jest.mock('../../../../app/components/Training/execute/Estimated1RmCard', () => {
  const {View} = require('react-native');
  return () => <View />;
});

// ── redux hook mocks ─────────────────────────────────────────────────────────

jest.mock('../../../../app/redux/Workout/use/useWorkoutById', () => ({
  useWorkoutById: jest.fn(() => undefined),
}));

jest.mock('../../../../app/redux/Training/use/useNextTrainingsId', () => ({
  useNextTrainingsId: jest.fn(() => 1),
}));

jest.mock('../../../../app/redux/Workout/use/useUnfinishedWorkout', () => ({
  useUnfinishedWorkout: jest.fn(() => undefined),
  usePersistedUnfinishedWorkout: jest.fn(() => undefined),
}));

jest.mock('../../../../app/redux/Workout/use/useAllTimeOneRepMax', () => ({
  useAllTimeOneRepMax: jest.fn(() => undefined),
}));

const mockStartRestTimer = jest.fn();
const mockResetRestTimer = jest.fn();
const mockDismissRestTimer = jest.fn();

jest.mock('../../../../app/redux/settings/use/useSettings', () => ({
  useSettings: jest.fn(() => ({
    restTimer: {
      active: {startedAt: Date.now(), targetSeconds: 90, exerciseId: 10},
      userDefaultSeconds: 90,
      defaultPerExercise: {},
    },
  })),
}));

jest.mock('../../../../app/redux/settings/dispatch/dispatchRestTimer', () => ({
  dispatchStartRestTimer: jest.fn(() => mockStartRestTimer),
  dispatchResetRestTimer: jest.fn(() => mockResetRestTimer),
  dispatchUpdateRestTimerTarget: jest.fn(() => jest.fn()),
  dispatchDismissRestTimer: jest.fn(() => mockDismissRestTimer),
  dispatchSetRestTimerExerciseDefault: jest.fn(() => jest.fn()),
}));

jest.mock('../../../../app/redux/Workout/use/useLastFinishedWorkoutsByExerciseIds', () => ({
  useLastFinishedWorkoutsByExerciseIds: jest.fn(() => []),
}));

// ── react-native-paper mock ──────────────────────────────────────────────────

jest.mock('react-native-paper', () => {
  const {View, Text, TouchableOpacity} = require('react-native');
  const Dialog = Object.assign(
    ({visible, children}: any) => (visible ? <View>{children}</View> : null),
    {
      Title: ({children}: any) => <Text>{children}</Text>,
      Content: ({children}: any) => <View>{children}</View>,
      Actions: ({children}: any) => <View>{children}</View>,
    },
  );
  return {
    Text: ({children, testID, style}: any) => <Text testID={testID} style={style}>{children}</Text>,
    Icon: () => <View />,
    IconButton: ({onPress, icon, testID}: any) => (
      <TouchableOpacity testID={testID} onPress={onPress}><Text>{icon}</Text></TouchableOpacity>
    ),
    Tooltip: ({children}: any) => <>{children}</>,
    Portal: ({children}: any) => <>{children}</>,
    Dialog,
    useTheme: () => ({
      colors: {
        primary: '#0066ff', error: '#ff0000', onSurface: '#000',
        onSurfaceVariant: '#666', surface: '#fff', surfaceVariant: '#eee',
      },
    }),
  };
});

// ── subject ──────────────────────────────────────────────────────────────────

import ExecuteTraining from '../../../../app/components/Training/execute/ExecuteTraining';

const TRAINING = {
  id: 1,
  doneWorkoutIds: {},
  plannedWorkouts: {},
  exercises: [10],
  state: TrainingsState.STARTED,
};

const EXERCISE = {id: 10, name: 'Squat'};

// ── tests ────────────────────────────────────────────────────────────────────

describe('ExecuteTraining — notification scheduling (GH-252)', () => {
  beforeEach(() => {
    capturedOnSubmitSet = undefined;
    mockStartRestTimer.mockClear();
    mockResetRestTimer.mockClear();
    mockDismissRestTimer.mockClear();
  });

  it('calls onScheduleNotification with resolvedRestDefault (exercise default) when a set is submitted', () => {
    const onScheduleNotification = jest.fn();
    render(
      <ExecuteTraining
        training={TRAINING as any}
        chosenExercise={EXERCISE as any}
        onSubmit={jest.fn()}
        onScheduleNotification={onScheduleNotification}
      />,
    );
    act(() => {
      capturedOnSubmitSet?.({index: 0, reps: 5, rir: 1, weight: 100});
    });
    // resolvedRestDefault = exerciseDefaultRest ?? userDefaultRest ?? 90
    // useSettings returns userDefaultSeconds: 90, no per-exercise override → 90
    expect(onScheduleNotification).toHaveBeenCalledTimes(1);
    expect(onScheduleNotification).toHaveBeenCalledWith(90);
  });

  it('calls onCancelNotification when Reset is pressed', () => {
    const onCancelNotification = jest.fn();
    const {getByTestId} = render(
      <ExecuteTraining
        training={TRAINING as any}
        chosenExercise={EXERCISE as any}
        onSubmit={jest.fn()}
        onCancelNotification={onCancelNotification}
      />,
    );
    fireEvent.press(getByTestId('mock-reset'));
    expect(onCancelNotification).toHaveBeenCalledTimes(1);
    expect(mockResetRestTimer).toHaveBeenCalledTimes(1);
  });

  it('calls onCancelNotification when Skip is pressed', () => {
    const onCancelNotification = jest.fn();
    const {getByTestId} = render(
      <ExecuteTraining
        training={TRAINING as any}
        chosenExercise={EXERCISE as any}
        onSubmit={jest.fn()}
        onCancelNotification={onCancelNotification}
      />,
    );
    fireEvent.press(getByTestId('mock-skip'));
    expect(onCancelNotification).toHaveBeenCalledTimes(1);
    expect(mockDismissRestTimer).toHaveBeenCalledTimes(1);
  });

  it('per-exercise default overrides user default in the scheduled notification seconds', () => {
    const {useSettings} = require('../../../../app/redux/settings/use/useSettings');
    (useSettings as jest.Mock).mockReturnValueOnce({
      restTimer: {
        active: {startedAt: Date.now(), targetSeconds: 60, exerciseId: 10},
        userDefaultSeconds: 90,
        defaultPerExercise: {10: 60},
      },
    });

    const onScheduleNotification = jest.fn();
    render(
      <ExecuteTraining
        training={TRAINING as any}
        chosenExercise={EXERCISE as any}
        onSubmit={jest.fn()}
        onScheduleNotification={onScheduleNotification}
      />,
    );
    act(() => {
      capturedOnSubmitSet?.({index: 0, reps: 5, rir: 1, weight: 100});
    });
    // exerciseDefaultRest for id=10 is 60 → wins over userDefaultSeconds=90
    expect(onScheduleNotification).toHaveBeenCalledWith(60);
  });
});

/**
 * GH-443: the rest is the time since the last set was LOGGED. Correcting a set
 * that is already in the log goes through the very same submit path (an edited
 * row auto-submits on blur), and used to restart the clock and the pause
 * notification — so a 40 s rest jumped back to the full target.
 */
describe('ExecuteTraining — correcting a logged set must not restart the rest (GH-443)', () => {
  beforeEach(() => {
    capturedOnSubmitSet = undefined;
    mockStartRestTimer.mockClear();
    mockResetRestTimer.mockClear();
    mockDismissRestTimer.mockClear();
  });

  const renderScreen = (onScheduleNotification = jest.fn()) => {
    render(
      <ExecuteTraining
        training={TRAINING as any}
        chosenExercise={EXERCISE as any}
        onSubmit={jest.fn()}
        onScheduleNotification={onScheduleNotification}
      />,
    );
    return onScheduleNotification;
  };

  it('does not restart the timer or reschedule the notification when an existing set is corrected', () => {
    const onScheduleNotification = renderScreen();

    act(() => {
      capturedOnSubmitSet?.({index: 2, reps: 5, rir: 1, weight: 105}, {isExistingSet: true});
    });

    expect(mockStartRestTimer).not.toHaveBeenCalled();
    expect(onScheduleNotification).not.toHaveBeenCalled();
  });

  it('still starts the timer from scratch when a new set is added', () => {
    const onScheduleNotification = renderScreen();

    act(() => {
      capturedOnSubmitSet?.({index: 3, reps: 5, rir: 1, weight: 100}, {isExistingSet: false});
    });

    expect(mockStartRestTimer).toHaveBeenCalledTimes(1);
    expect(mockStartRestTimer).toHaveBeenCalledWith(
      expect.objectContaining({targetSeconds: 90, exerciseId: 10, setIndex: 3}),
    );
    expect(onScheduleNotification).toHaveBeenCalledWith(90);
  });

  it('correcting the LAST logged set is treated the same as any other correction', () => {
    const onScheduleNotification = renderScreen();

    act(() => {
      capturedOnSubmitSet?.({index: 3, reps: 5, rir: 1, weight: 100}, {isExistingSet: false});
    });
    mockStartRestTimer.mockClear();
    onScheduleNotification.mockClear();

    // …the user immediately fixes the weight of that very set.
    act(() => {
      capturedOnSubmitSet?.({index: 3, reps: 5, rir: 1, weight: 102.5}, {isExistingSet: true});
    });

    expect(mockStartRestTimer).not.toHaveBeenCalled();
    expect(onScheduleNotification).not.toHaveBeenCalled();
  });

  it('the explicit Reset button still restarts the timer', () => {
    const onCancelNotification = jest.fn();
    const {getByTestId} = render(
      <ExecuteTraining
        training={TRAINING as any}
        chosenExercise={EXERCISE as any}
        onSubmit={jest.fn()}
        onCancelNotification={onCancelNotification}
      />,
    );

    act(() => {
      capturedOnSubmitSet?.({index: 1, reps: 5, rir: 1, weight: 100}, {isExistingSet: true});
    });
    expect(mockResetRestTimer).not.toHaveBeenCalled();

    fireEvent.press(getByTestId('mock-reset'));
    expect(mockResetRestTimer).toHaveBeenCalledTimes(1);
  });
});
