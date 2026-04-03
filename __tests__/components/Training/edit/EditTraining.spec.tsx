import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react-native';
import {PaperProvider} from 'react-native-paper';
import EditTraining from '../../../../app/components/Training/execute/EditTraining';
import {TrainingsState} from '../../../../app/models/TrainingsState';

const mockEditTrainingTimes = jest.fn();
const mockDatePickerValues: Record<string, string> = {};

jest.mock('../../../../app/redux/Training/dispatch/general/dispatchEditTrainingTimes', () => ({
  dispatchEditTrainingTimes: () => mockEditTrainingTimes,
}));

jest.mock('../../../../app/components/Training/execute/ExecuteTraining', () => 'ExecuteTraining');

jest.mock('../../../../app/components/picker/date/DatePicker', () => {
  const React = require('react');
  const {Text, TouchableOpacity, View} = require('react-native');

  return ({date, setDate, label, testID}: {date: Date | number; setDate: (date: Date) => void; label?: string; testID?: string}) => (
    <TouchableOpacity
      testID={testID}
      onPress={() => {
        const nextValue = testID ? mockDatePickerValues[testID] : undefined;
        if (nextValue) {
          setDate(new Date(nextValue));
        }
      }}
    >
      <View>
        <Text>{label}</Text>
        <Text>{new Date(date).toISOString()}</Text>
      </View>
    </TouchableOpacity>
  );
});

describe('EditTraining', () => {
  const isDisabled = (testID: string) =>
    !!(screen.getByTestId(testID).props.accessibilityState?.disabled ?? screen.getByTestId(testID).props.disabled);

  const training = {
    id: 1,
    state: TrainingsState.FINISHED,
    exercises: [10],
    doneWorkoutIds: {10: 42},
    plannedWorkouts: {},
    start: new Date('2026-04-03T10:00:00.000Z'),
    end: new Date('2026-04-03T11:00:00.000Z'),
  };

  const chosenExercise = {
    id: 10,
    name: 'Squat',
  };

  beforeEach(() => {
    mockEditTrainingTimes.mockClear();
    Object.keys(mockDatePickerValues).forEach((key) => delete mockDatePickerValues[key]);
  });

  it('persists updated training times', () => {
    mockDatePickerValues['edit-training-times-end'] = '2026-04-03T12:30:00.000Z';

    render(
      <PaperProvider>
        <EditTraining training={training as any} chosenExercise={chosenExercise as any} onSubmit={jest.fn()} />
      </PaperProvider>,
    );

    expect(isDisabled('edit-training-times-save')).toBe(true);

    fireEvent.press(screen.getByTestId('edit-training-times-end'));
    fireEvent.press(screen.getByTestId('edit-training-times-save'));

    expect(mockEditTrainingTimes).toHaveBeenCalledWith(
      1,
      new Date('2026-04-03T10:00:00.000Z').getTime(),
      new Date('2026-04-03T12:30:00.000Z').getTime(),
    );
  });

  it('blocks saving when end is before start', () => {
    mockDatePickerValues['edit-training-times-end'] = '2026-04-03T09:30:00.000Z';

    render(
      <PaperProvider>
        <EditTraining training={training as any} chosenExercise={chosenExercise as any} onSubmit={jest.fn()} />
      </PaperProvider>,
    );

    fireEvent.press(screen.getByTestId('edit-training-times-end'));

    expect(screen.getByText('End time cannot be before start time.')).toBeTruthy();
    expect(isDisabled('edit-training-times-save')).toBe(true);
    expect(mockEditTrainingTimes).not.toHaveBeenCalled();
  });
});
