import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react-native';
import {PaperProvider} from 'react-native-paper';
import TrainingLengthEditDialog from '../../../app/components/analyse/TrainingLengthEditDialog';
import {AccumulationMode} from '../../../app/models/AccumulationMode';

const mockEditTrainingTimes = jest.fn();

global.setImmediate = ((callback: (...args: any[]) => void, ...args: any[]) => setTimeout(callback, 0, ...args)) as any;

jest.mock('../../../app/redux/Training/dispatch/general/dispatchEditTrainingTimes', () => ({
  dispatchEditTrainingTimes: () => mockEditTrainingTimes,
}));

jest.mock('../../../app/components/picker/date/DatePicker', () => {
  const React = require('react');
  const {Text, TextInput, View} = require('react-native');
  const {formatTrainingTimeInput, getTrainingTimeInputError, parseTrainingTimeInput} = require('../../../app/utils/training-times');

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

describe('TrainingLengthEditDialog', () => {
  const getTextContent = (testID: string) => {
    const children = screen.getByTestId(testID).props.children;
    return Array.isArray(children) ? children.join('') : String(children);
  };

  const onDismiss = jest.fn();
  const bucket = {
    key: '2026-04-03T00:00:00.000Z',
    startDate: new Date('2026-04-03T00:00:00.000Z'),
    x: 20547,
    averageDurationMinutes: 75,
    totalDurationMinutes: 150,
    trainingCount: 2,
    trainings: [
      {
        key: '1',
        trainingId: 1,
        start: new Date(2026, 3, 3, 10, 0),
        end: new Date(2026, 3, 3, 11, 0),
        durationMinutes: 60,
      },
      {
        key: '2',
        trainingId: 2,
        start: new Date(2026, 3, 3, 14, 0),
        end: new Date(2026, 3, 3, 15, 30),
        durationMinutes: 90,
      },
    ],
  };

  beforeEach(() => {
    onDismiss.mockClear();
    mockEditTrainingTimes.mockClear();
  });

  it('updates the live average duration and saves changed times', () => {
    render(
      <PaperProvider>
        <TrainingLengthEditDialog accumulationMode={AccumulationMode.SINGLE_DAY} bucket={bucket as any} onDismiss={onDismiss} trainingNameById={{1: 'Squat', 2: 'Bench'}} />
      </PaperProvider>,
    );

    expect(getTextContent('training-length-edit-average-duration')).toContain('Live average duration: 1 h 15 min');

    fireEvent.changeText(screen.getByTestId('training-length-edit-2-end'), '03/04/2026 16:00');

    expect(getTextContent('training-length-edit-average-duration')).toContain('Live average duration: 1 h 30 min');

    fireEvent.press(screen.getByText('Save'));

    expect(mockEditTrainingTimes).toHaveBeenCalledWith(2, new Date(2026, 3, 3, 14, 0).getTime(), new Date(2026, 3, 3, 16, 0).getTime());
    expect(onDismiss).toHaveBeenCalled();
  });
});
