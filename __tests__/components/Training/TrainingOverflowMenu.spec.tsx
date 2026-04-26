import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import TrainingOverflowMenu from '../../../app/components/Training/TrainingOverflowMenu';
import {TrainingsState} from '../../../app/models/TrainingsState';

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TouchableOpacity, View} = require('react-native');
  return {
    Menu: Object.assign(
      ({visible, children}: any) => (visible ? <View>{children}</View> : null),
      {
        Item: ({title, onPress, testID, disabled}: any) => (
          <TouchableOpacity testID={testID} onPress={disabled ? undefined : onPress} disabled={!!disabled}>
            <Text>{typeof title === 'string' ? title : ''}</Text>
          </TouchableOpacity>
        ),
      },
    ),
    Text: ({children}: any) => <Text>{children}</Text>,
    useTheme: () => ({
      colors: {primary: '#6200ee'},
    }),
  };
});

const BASE = {
  visible: true,
  onDismiss: jest.fn(),
  onStart: jest.fn(),
  onFinish: jest.fn(),
  onEditTraining: jest.fn(),
  onDeleteTraining: jest.fn(),
};

describe('TrainingOverflowMenu', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders nothing when not visible', () => {
    const {queryByTestId} = render(<TrainingOverflowMenu {...BASE} visible={false} trainingState={TrainingsState.STARTED} />);
    expect(queryByTestId('overflow-finish')).toBeNull();
  });

  it('shows Start Training for PLANNED state', () => {
    const {getByTestId, queryByTestId} = render(<TrainingOverflowMenu {...BASE} trainingState={TrainingsState.PLANNED} />);
    expect(getByTestId('overflow-start')).toBeTruthy();
    expect(queryByTestId('overflow-finish')).toBeNull();
    expect(queryByTestId('overflow-pause')).toBeNull();
  });

  it('shows Finish Training and Pause (disabled) for STARTED state', () => {
    const {getByTestId, queryByTestId} = render(<TrainingOverflowMenu {...BASE} trainingState={TrainingsState.STARTED} />);
    expect(getByTestId('overflow-finish')).toBeTruthy();
    expect(getByTestId('overflow-pause')).toBeTruthy();
    expect(queryByTestId('overflow-start')).toBeNull();
  });

  it('shows Edit and Discard for all states', () => {
    for (const state of [TrainingsState.PLANNED, TrainingsState.STARTED, TrainingsState.FINISHED]) {
      const {getByTestId} = render(<TrainingOverflowMenu {...BASE} trainingState={state} />);
      expect(getByTestId('overflow-edit')).toBeTruthy();
      expect(getByTestId('overflow-discard')).toBeTruthy();
    }
  });

  it('does not show Start/Finish for FINISHED state', () => {
    const {queryByTestId} = render(<TrainingOverflowMenu {...BASE} trainingState={TrainingsState.FINISHED} />);
    expect(queryByTestId('overflow-start')).toBeNull();
    expect(queryByTestId('overflow-finish')).toBeNull();
    expect(queryByTestId('overflow-pause')).toBeNull();
  });

  it('calls onStart and onDismiss when Start Training pressed', () => {
    const onStart = jest.fn();
    const onDismiss = jest.fn();
    const {getByTestId} = render(<TrainingOverflowMenu {...BASE} onStart={onStart} onDismiss={onDismiss} trainingState={TrainingsState.PLANNED} />);
    fireEvent.press(getByTestId('overflow-start'));
    expect(onDismiss).toHaveBeenCalled();
    expect(onStart).toHaveBeenCalled();
  });

  it('calls onFinish and onDismiss when Finish Training pressed', () => {
    const onFinish = jest.fn();
    const onDismiss = jest.fn();
    const {getByTestId} = render(<TrainingOverflowMenu {...BASE} onFinish={onFinish} onDismiss={onDismiss} trainingState={TrainingsState.STARTED} />);
    fireEvent.press(getByTestId('overflow-finish'));
    expect(onDismiss).toHaveBeenCalled();
    expect(onFinish).toHaveBeenCalled();
  });

  it('calls onDeleteTraining when Discard pressed', () => {
    const onDeleteTraining = jest.fn();
    const onDismiss = jest.fn();
    const {getByTestId} = render(<TrainingOverflowMenu {...BASE} onDeleteTraining={onDeleteTraining} onDismiss={onDismiss} trainingState={TrainingsState.FINISHED} />);
    fireEvent.press(getByTestId('overflow-discard'));
    expect(onDeleteTraining).toHaveBeenCalled();
  });
});
