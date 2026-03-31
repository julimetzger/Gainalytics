import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import TrainingsBase from '../../../app/components/Training/TrainingsBase';
import {dispatchSuggestBasedOnTrained} from '../../../app/redux/Training/dispatch/plan/dispatchSuggestBasedOnTrained';
import {dispatchSuggestBasedOnPlanned} from '../../../app/redux/Training/dispatch/plan/dispatchSuggestBasedOnPlanned';

jest.mock('../../../app/redux/Training/dispatch/plan/dispatchSuggestBasedOnTrained', () => ({
  dispatchSuggestBasedOnTrained: jest.fn(),
}));

jest.mock('../../../app/redux/Training/dispatch/plan/dispatchSuggestBasedOnPlanned', () => ({
  dispatchSuggestBasedOnPlanned: jest.fn(),
}));

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TextInput, TouchableOpacity} = require('react-native');

  return {
    Button: ({children, disabled, onPress, testID}: {children: React.ReactNode; disabled?: boolean; onPress?: () => void; testID?: string}) => (
      <TouchableOpacity
        testID={testID}
        accessibilityState={{disabled: !!disabled}}
        onPress={() => {
          if (!disabled && onPress) {
            onPress();
          }
        }}
      >
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
    Text: ({children}: {children: React.ReactNode}) => <Text>{children}</Text>,
    TextInput: ({label, value, onChangeText, testID}: {label: string; value?: string; onChangeText?: (value: string) => void; testID?: string}) => (
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} testID={testID} />
    ),
  };
});

const mockSuggestBasedOnTrained = jest.fn();
const mockSuggestBasedOnPlanned = jest.fn();
const mockedDispatchSuggestBasedOnTrained = jest.mocked(dispatchSuggestBasedOnTrained);
const mockedDispatchSuggestBasedOnPlanned = jest.mocked(dispatchSuggestBasedOnPlanned);

describe('TrainingsBase', () => {
  beforeEach(() => {
    mockedDispatchSuggestBasedOnTrained.mockReturnValue(mockSuggestBasedOnTrained);
    mockedDispatchSuggestBasedOnPlanned.mockReturnValue(mockSuggestBasedOnPlanned);
    mockSuggestBasedOnTrained.mockReset();
    mockSuggestBasedOnPlanned.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows default progression inputs and passes parsed values to both suggestion entry points', () => {
    const trainingsPlan = {
      id: 3,
      name: 'Push',
      trainings: {},
      trainingNames: {},
    };

    const {getByLabelText} = render(<TrainingsBase trainingsPlan={trainingsPlan} micro={2} trainingInMicro={1} />);

    expect(getByLabelText('RIR delta').props.value).toBe('1');
    expect(getByLabelText('Weight increase %').props.value).toBe('0');

    fireEvent.changeText(getByLabelText('RIR delta'), '2');
    fireEvent.changeText(getByLabelText('Weight increase %'), '5,5');

    expect(mockedDispatchSuggestBasedOnTrained).toHaveBeenLastCalledWith(3, 1, {
      rirDelta: 2,
      weightIncreasePercent: 5.5,
    });
    expect(mockedDispatchSuggestBasedOnPlanned).toHaveBeenLastCalledWith(3, 1, {
      rirDelta: 2,
      weightIncreasePercent: 5.5,
    });
  });

  it('keeps both suggestion buttons disabled when no matching source training exists', () => {
    mockedDispatchSuggestBasedOnTrained.mockReturnValue(undefined);
    mockedDispatchSuggestBasedOnPlanned.mockReturnValue(undefined);
    const trainingsPlan = {
      id: 4,
      name: 'Pull',
      trainings: {},
      trainingNames: {},
    };

    const {getByTestId} = render(<TrainingsBase trainingsPlan={trainingsPlan} micro={2} trainingInMicro={1} />);

    expect(getByTestId('training-suggest-last-training-button').props.accessibilityState.disabled).toBe(true);
    expect(getByTestId('training-suggest-last-planned-training-button').props.accessibilityState.disabled).toBe(true);
  });
});
