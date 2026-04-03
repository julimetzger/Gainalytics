import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react-native';
import {PaperProvider} from 'react-native-paper';
import EditTraining from '../../../../app/components/Training/execute/EditTraining';
import {TrainingsState} from '../../../../app/models/TrainingsState';

const mockEditTrainingTimes = jest.fn();

global.setImmediate = ((callback: (...args: any[]) => void, ...args: any[]) => setTimeout(callback, 0, ...args)) as any;

jest.mock('../../../../app/redux/Training/dispatch/general/dispatchEditTrainingTimes', () => ({
  dispatchEditTrainingTimes: () => mockEditTrainingTimes,
}));

jest.mock('../../../../app/components/Training/execute/ExecuteTraining', () => 'ExecuteTraining');

jest.mock('../../../../app/components/picker/date/DatePicker', () => {
  const React = require('react');
  const {Text, TextInput, View} = require('react-native');
  const {formatTrainingTimeInput, getTrainingTimeInputError, parseTrainingTimeInput} = require('../../../../app/utils/training-times');

  return ({date, setDate, label, testID, onErrorChange}: {date: Date | number; setDate: (date: Date) => void; label?: string; testID?: string; onErrorChange?: (error: string | null) => void}) => (
    <View>
      {label ? <Text>{label}</Text> : null}
      <TextInput
        testID={testID}
        value={formatTrainingTimeInput(date)}
        onChangeText={(value) => {
          const nextError = getTrainingTimeInputError(value, date);
          onErrorChange?.(nextError);
          if (nextError) {
            return;
          }

          const nextDate = parseTrainingTimeInput(value, date);
          if (nextDate) {
            setDate(nextDate);
          }
        }}
      />
    </View>
  );
});

describe('EditTraining', () => {
  const isDisabled = (testID: string) => !!(screen.getByTestId(testID).props.accessibilityState?.disabled ?? screen.getByTestId(testID).props.disabled);

  const training = {
    id: 1,
    state: TrainingsState.FINISHED,
    exercises: [10],
    doneWorkoutIds: {10: 42},
    plannedWorkouts: {},
    start: new Date(2026, 3, 3, 10, 0),
    end: new Date(2026, 3, 3, 11, 0),
  };

  const chosenExercise = {
    id: 10,
    name: 'Squat',
  };

  beforeEach(() => {
    mockEditTrainingTimes.mockClear();
  });

  it('persists updated training times', () => {
    render(
      <PaperProvider>
        <EditTraining training={training as any} chosenExercise={chosenExercise as any} onSubmit={jest.fn()} />
      </PaperProvider>,
    );

    expect(screen.queryByTestId('edit-training-times-end')).toBeNull();

    fireEvent.press(screen.getByTestId('edit-training-open-times-modal'));
    expect(isDisabled('edit-training-times-save')).toBe(true);

    fireEvent.changeText(screen.getByTestId('edit-training-times-end'), '03/04/2026 12:30');
    fireEvent.press(screen.getByTestId('edit-training-times-save'));

    expect(mockEditTrainingTimes).toHaveBeenCalledWith(1, new Date(2026, 3, 3, 10, 0).getTime(), new Date(2026, 3, 3, 12, 30).getTime());
  });

  it('blocks saving when end is before start', () => {
    render(
      <PaperProvider>
        <EditTraining training={training as any} chosenExercise={chosenExercise as any} onSubmit={jest.fn()} />
      </PaperProvider>,
    );

    fireEvent.press(screen.getByTestId('edit-training-open-times-modal'));
    fireEvent.changeText(screen.getByTestId('edit-training-times-end'), '03/04/2026 09:30');

    expect(screen.getByText('End time cannot be before start time.')).toBeTruthy();
    expect(isDisabled('edit-training-times-save')).toBe(true);
    expect(mockEditTrainingTimes).not.toHaveBeenCalled();
  });
});
