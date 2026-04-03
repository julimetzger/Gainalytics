import React from 'react';
import {fireEvent, render, screen} from '@testing-library/react-native';
import {PaperProvider} from 'react-native-paper';
import TrainingLengthEditDialog from '../../../app/components/analyse/TrainingLengthEditDialog';
import {AccumulationMode} from '../../../app/models/AccumulationMode';

const mockEditTrainingTimes = jest.fn();
const mockDatePickerValues: Record<string, string> = {};

global.setImmediate = ((callback: (...args: any[]) => void, ...args: any[]) => setTimeout(callback, 0, ...args)) as any;

jest.mock('../../../app/redux/Training/dispatch/general/dispatchEditTrainingTimes', () => ({
  dispatchEditTrainingTimes: () => mockEditTrainingTimes,
}));

jest.mock('../../../app/components/picker/date/DatePicker', () => {
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
        start: new Date('2026-04-03T10:00:00.000Z'),
        end: new Date('2026-04-03T11:00:00.000Z'),
        durationMinutes: 60,
      },
      {
        key: '2',
        trainingId: 2,
        start: new Date('2026-04-03T14:00:00.000Z'),
        end: new Date('2026-04-03T15:30:00.000Z'),
        durationMinutes: 90,
      },
    ],
  };

  beforeEach(() => {
    onDismiss.mockClear();
    mockEditTrainingTimes.mockClear();
    Object.keys(mockDatePickerValues).forEach((key) => delete mockDatePickerValues[key]);
  });

  it('updates the live average duration and saves changed times', () => {
    mockDatePickerValues['training-length-edit-2-end'] = '2026-04-03T16:00:00.000Z';

    render(
      <PaperProvider>
        <TrainingLengthEditDialog accumulationMode={AccumulationMode.SINGLE_DAY} bucket={bucket as any} onDismiss={onDismiss} trainingNameById={{1: 'Squat', 2: 'Bench'}} />
      </PaperProvider>,
    );

    expect(getTextContent('training-length-edit-average-duration')).toContain('Live average duration: 1 h 15 min');

    fireEvent.press(screen.getByTestId('training-length-edit-2-end'));

    expect(getTextContent('training-length-edit-average-duration')).toContain('Live average duration: 1 h 30 min');

    fireEvent.press(screen.getByText('Save'));

    expect(mockEditTrainingTimes).toHaveBeenCalledWith(
      2,
      new Date('2026-04-03T14:00:00.000Z').getTime(),
      new Date('2026-04-03T16:00:00.000Z').getTime(),
    );
    expect(onDismiss).toHaveBeenCalled();
  });
});
