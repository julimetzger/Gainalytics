import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import TrainingOverflowMenu from '../../../app/components/Training/TrainingOverflowMenu';
import {TrainingsState} from '../../../app/models/TrainingsState';

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TouchableOpacity, View} = require('react-native');
  return {
    Divider: () => <View testID="menu-divider" />,
    Menu: Object.assign(
      ({visible, children}: any) => (visible ? <View>{children}</View> : null),
      {
        Item: ({title, onPress, testID, disabled}: any) => (
          <TouchableOpacity testID={testID} onPress={disabled ? undefined : onPress} disabled={!!disabled}>
            {typeof title === 'string' ? <Text>{title}</Text> : title}
          </TouchableOpacity>
        ),
      },
    ),
    Portal: ({children}: any) => <>{children}</>,
    Text: ({children}: any) => <Text>{children}</Text>,
    useTheme: () => ({
      colors: {primary: '#6200ee', error: '#b00020'},
    }),
  };
});

const BASE = {
  visible: true,
  onDismiss: jest.fn(),
  onStart: jest.fn(),
  onFinish: jest.fn(),
  onEditPlan: jest.fn(),
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

  it('shows Edit and Delete for all states', () => {
    for (const state of [TrainingsState.PLANNED, TrainingsState.STARTED, TrainingsState.FINISHED]) {
      const {getByTestId} = render(<TrainingOverflowMenu {...BASE} activeSubTab="train" trainingState={state} />);
      expect(getByTestId('overflow-edit')).toBeTruthy();
      expect(getByTestId('overflow-discard')).toBeTruthy();
    }
  });

  it('labels the delete menu item "Delete" (GH-323: renamed from Discard, since it actually deletes the training)', () => {
    const {getByTestId, getByText} = render(<TrainingOverflowMenu {...BASE} activeSubTab="train" trainingState={TrainingsState.FINISHED} />);
    expect(getByTestId('overflow-discard')).toBeTruthy();
    expect(getByText('Delete')).toBeTruthy();
  });

  it('labels the delete menu item "Delete this training" in the plan-mode menu', () => {
    const {getByText} = render(<TrainingOverflowMenu {...BASE} activeSubTab="plan" trainingState={TrainingsState.PLANNED} />);
    expect(getByText('Delete this training')).toBeTruthy();
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

  it('calls onDeleteTraining when Delete pressed', () => {
    const onDeleteTraining = jest.fn();
    const onDismiss = jest.fn();
    const {getByTestId} = render(<TrainingOverflowMenu {...BASE} onDeleteTraining={onDeleteTraining} onDismiss={onDismiss} trainingState={TrainingsState.FINISHED} />);
    fireEvent.press(getByTestId('overflow-discard'));
    expect(onDeleteTraining).toHaveBeenCalled();
  });

  it('shows Edit plan item only on the Plan sub-tab', () => {
    const onEditPlan = jest.fn();
    const {getByTestId, queryByTestId} = render(
      <TrainingOverflowMenu
        {...BASE}
        activeSubTab="plan"
        onEditPlan={onEditPlan}
        trainingState={TrainingsState.PLANNED}
      />,
    );
    expect(getByTestId('overflow-edit-plan')).toBeTruthy();
    expect(queryByTestId('overflow-edit')).toBeNull();
  });

  it('does not show Edit plan outside the planned Plan sub-tab state', () => {
    const {queryByTestId, rerender} = render(
      <TrainingOverflowMenu
        {...BASE}
        activeSubTab="plan"
        trainingState={TrainingsState.STARTED}
      />,
    );

    expect(queryByTestId('overflow-edit-plan')).toBeNull();

    rerender(
      <TrainingOverflowMenu
        {...BASE}
        activeSubTab="train"
        trainingState={TrainingsState.PLANNED}
      />,
    );

    expect(queryByTestId('overflow-edit-plan')).toBeNull();
  });

  it('shows Start Training on the Plan sub-tab once exercises are planned', () => {
    const onStart = jest.fn();
    const onDismiss = jest.fn();
    const {getByTestId} = render(
      <TrainingOverflowMenu
        {...BASE}
        activeSubTab="plan"
        trainingState={TrainingsState.PLANNED}
        hasExercises
        onStart={onStart}
        onDismiss={onDismiss}
      />,
    );
    expect(getByTestId('overflow-edit-plan')).toBeTruthy();
    fireEvent.press(getByTestId('overflow-start'));
    expect(onDismiss).toHaveBeenCalled();
    expect(onStart).toHaveBeenCalled();
  });

  it('hides Start Training on the Plan sub-tab while no exercises are planned', () => {
    const {getByTestId, queryByTestId} = render(
      <TrainingOverflowMenu
        {...BASE}
        activeSubTab="plan"
        trainingState={TrainingsState.PLANNED}
        hasExercises={false}
      />,
    );
    expect(getByTestId('overflow-edit-plan')).toBeTruthy();
    expect(queryByTestId('overflow-start')).toBeNull();
  });
});
