import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import TrainingsBase from '../../../app/components/Training/TrainingsBase';
import {dispatchSuggestBasedOnTrained} from '../../../app/redux/Training/dispatch/plan/dispatchSuggestBasedOnTrained';
import {dispatchSuggestBasedOnPlanned} from '../../../app/redux/Training/dispatch/plan/dispatchSuggestBasedOnPlanned';
import {dispatchSuggestBasedOnLastMesoTraining} from '../../../app/redux/Training/dispatch/plan/dispatchSuggestBasedOnLastMesoTraining';

jest.mock('../../../app/redux/Training/dispatch/plan/dispatchSuggestBasedOnTrained', () => ({
  dispatchSuggestBasedOnTrained: jest.fn(),
}));

jest.mock('../../../app/redux/Training/dispatch/plan/dispatchSuggestBasedOnPlanned', () => ({
  dispatchSuggestBasedOnPlanned: jest.fn(),
}));

jest.mock('../../../app/redux/Training/dispatch/plan/dispatchSuggestBasedOnLastMesoTraining', () => ({
  dispatchSuggestBasedOnLastMesoTraining: jest.fn(),
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
const mockSuggestBasedOnLastMeso = jest.fn();
const mockedDispatchSuggestBasedOnTrained = jest.mocked(dispatchSuggestBasedOnTrained);
const mockedDispatchSuggestBasedOnPlanned = jest.mocked(dispatchSuggestBasedOnPlanned);
const mockedDispatchSuggestBasedOnLastMeso = jest.mocked(dispatchSuggestBasedOnLastMesoTraining);

describe('TrainingsBase', () => {
  beforeEach(() => {
    mockedDispatchSuggestBasedOnTrained.mockReturnValue(mockSuggestBasedOnTrained);
    mockedDispatchSuggestBasedOnPlanned.mockReturnValue(mockSuggestBasedOnPlanned);
    mockedDispatchSuggestBasedOnLastMeso.mockReturnValue(mockSuggestBasedOnLastMeso);
    mockSuggestBasedOnTrained.mockReset();
    mockSuggestBasedOnPlanned.mockReset();
    mockSuggestBasedOnLastMeso.mockReset();
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

    expect(mockedDispatchSuggestBasedOnTrained).toHaveBeenLastCalledWith(3, 1, 2, {
      rirDelta: 2,
      weightIncreasePercent: 5.5,
    });
    expect(mockedDispatchSuggestBasedOnPlanned).toHaveBeenLastCalledWith(3, 1, 2, {
      rirDelta: 2,
      weightIncreasePercent: 5.5,
    });
    expect(mockedDispatchSuggestBasedOnLastMeso).toHaveBeenLastCalledWith(3, 1, 2, {
      rirDelta: 2,
      weightIncreasePercent: 5.5,
    });
  });

  it('keeps all suggestion buttons disabled when no matching source training exists', () => {
    mockedDispatchSuggestBasedOnTrained.mockReturnValue(undefined);
    mockedDispatchSuggestBasedOnPlanned.mockReturnValue(undefined);
    mockedDispatchSuggestBasedOnLastMeso.mockReturnValue(undefined);
    const trainingsPlan = {
      id: 4,
      name: 'Pull',
      trainings: {},
      trainingNames: {},
    };

    const {getByTestId} = render(<TrainingsBase trainingsPlan={trainingsPlan} micro={2} trainingInMicro={1} />);

    expect(getByTestId('training-suggest-last-training-button').props.accessibilityState.disabled).toBe(true);
    expect(getByTestId('training-suggest-last-planned-training-button').props.accessibilityState.disabled).toBe(true);
    expect(getByTestId('training-suggest-last-meso-button').props.accessibilityState.disabled).toBe(true);
  });

  it('renders the "Suggest based on last Meso" button with the new GH-101 testID', () => {
    const trainingsPlan = {id: 3, name: 'Push pull', trainings: {}, trainingNames: {}};

    const {getByTestId, getByText} = render(<TrainingsBase trainingsPlan={trainingsPlan} micro={2} trainingInMicro={1} />);

    expect(getByTestId('training-suggest-last-meso-button')).toBeTruthy();
    expect(getByText('Suggest based on last Meso')).toBeTruthy();
  });

  it('enables the last-meso button and invokes the dispatcher on press with the current slot identity', () => {
    const trainingsPlan = {id: 7, name: 'Push pull', trainings: {}, trainingNames: {}};

    const {getByTestId} = render(<TrainingsBase trainingsPlan={trainingsPlan} micro={6} trainingInMicro={4} />);

    const button = getByTestId('training-suggest-last-meso-button');
    expect(button.props.accessibilityState.disabled).toBe(false);

    fireEvent.press(button);
    expect(mockSuggestBasedOnLastMeso).toHaveBeenCalledTimes(1);
    expect(mockSuggestBasedOnLastMeso).toHaveBeenCalledWith(7, 6, 4);
  });

  it('disables only the last-meso button when the current slot has no previous Meso, leaving the others enabled', () => {
    mockedDispatchSuggestBasedOnLastMeso.mockReturnValue(undefined);
    const trainingsPlan = {id: 9, name: 'Push pull', trainings: {}, trainingNames: {}};

    const {getByTestId} = render(<TrainingsBase trainingsPlan={trainingsPlan} micro={1} trainingInMicro={4} />);

    expect(getByTestId('training-suggest-last-meso-button').props.accessibilityState.disabled).toBe(true);
    expect(getByTestId('training-suggest-last-training-button').props.accessibilityState.disabled).toBe(false);
    expect(getByTestId('training-suggest-last-planned-training-button').props.accessibilityState.disabled).toBe(false);

    fireEvent.press(getByTestId('training-suggest-last-meso-button'));
    expect(mockSuggestBasedOnLastMeso).not.toHaveBeenCalled();
  });

  describe('GH-240 — plan-mode entry', () => {
    it('renders a Plan mode button when onEnterPlanMode is provided and triggers it on press', () => {
      const trainingsPlan = {id: 3, name: 'Push pull', trainings: {}, trainingNames: {}};
      const onEnterPlanMode = jest.fn();

      const {getByTestId} = render(
        <TrainingsBase trainingsPlan={trainingsPlan} micro={2} trainingInMicro={1} onEnterPlanMode={onEnterPlanMode} />,
      );

      const button = getByTestId('training-plan-mode-button');
      expect(button).toBeTruthy();
      fireEvent.press(button);
      expect(onEnterPlanMode).toHaveBeenCalledTimes(1);
    });

    it('does not render the Plan mode button when onEnterPlanMode is omitted (back-compat)', () => {
      const trainingsPlan = {id: 3, name: 'Push pull', trainings: {}, trainingNames: {}};

      const {queryByTestId} = render(<TrainingsBase trainingsPlan={trainingsPlan} micro={2} trainingInMicro={1} />);

      expect(queryByTestId('training-plan-mode-button')).toBeNull();
    });

    it('auto-routes into plan mode when no suggestion source produces output for the current micro', () => {
      mockedDispatchSuggestBasedOnTrained.mockReturnValue(undefined);
      mockedDispatchSuggestBasedOnPlanned.mockReturnValue(undefined);
      mockedDispatchSuggestBasedOnLastMeso.mockReturnValue(undefined);
      const trainingsPlan = {id: 5, name: 'Push pull', trainings: {}, trainingNames: {}};
      const onEnterPlanMode = jest.fn();

      render(<TrainingsBase trainingsPlan={trainingsPlan} micro={1} trainingInMicro={1} onEnterPlanMode={onEnterPlanMode} />);

      expect(onEnterPlanMode).toHaveBeenCalledTimes(1);
    });

    it('does NOT auto-route when at least one suggestion source is available', () => {
      mockedDispatchSuggestBasedOnTrained.mockReturnValue(mockSuggestBasedOnTrained);
      mockedDispatchSuggestBasedOnPlanned.mockReturnValue(undefined);
      mockedDispatchSuggestBasedOnLastMeso.mockReturnValue(undefined);
      const trainingsPlan = {id: 6, name: 'Push pull', trainings: {}, trainingNames: {}};
      const onEnterPlanMode = jest.fn();

      render(<TrainingsBase trainingsPlan={trainingsPlan} micro={2} trainingInMicro={1} onEnterPlanMode={onEnterPlanMode} />);

      expect(onEnterPlanMode).not.toHaveBeenCalled();
    });

    it('only auto-routes once even on subsequent re-renders with the same empty-suggestions state', () => {
      mockedDispatchSuggestBasedOnTrained.mockReturnValue(undefined);
      mockedDispatchSuggestBasedOnPlanned.mockReturnValue(undefined);
      mockedDispatchSuggestBasedOnLastMeso.mockReturnValue(undefined);
      const trainingsPlan = {id: 7, name: 'Push pull', trainings: {}, trainingNames: {}};
      const onEnterPlanMode = jest.fn();

      const {rerender} = render(
        <TrainingsBase trainingsPlan={trainingsPlan} micro={1} trainingInMicro={1} onEnterPlanMode={onEnterPlanMode} />,
      );
      rerender(<TrainingsBase trainingsPlan={trainingsPlan} micro={1} trainingInMicro={1} onEnterPlanMode={onEnterPlanMode} />);
      rerender(<TrainingsBase trainingsPlan={trainingsPlan} micro={1} trainingInMicro={1} onEnterPlanMode={onEnterPlanMode} />);

      expect(onEnterPlanMode).toHaveBeenCalledTimes(1);
    });
  });
});
