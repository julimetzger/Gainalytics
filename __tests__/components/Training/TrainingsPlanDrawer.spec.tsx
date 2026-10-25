import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';

const TrainingsPlanDrawer = require('../../../app/components/Training/TrainingsPlanDrawer').default;

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TextInput: RNTextInput, TouchableOpacity, View} = require('react-native');

  const MockTextInput = (props: Record<string, unknown>) => <RNTextInput {...props} />;

  return {
    Button: ({children, onPress, testID, mode}: {children: React.ReactNode; onPress?: () => void; testID?: string; mode?: string}) => (
      <TouchableOpacity testID={testID} onPress={onPress} accessibilityHint={mode}>
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
    Divider: () => <View />,
    IconButton: ({icon, onPress}: {icon: string; onPress?: () => void}) => (
      <TouchableOpacity onPress={onPress}>
        <Text>{icon}</Text>
      </TouchableOpacity>
    ),
    SegmentedButtons: ({buttons}: {buttons: Array<{label: string}>}) => (
      <View>
        {buttons.map((button) => (
          <Text key={button.label}>{button.label}</Text>
        ))}
      </View>
    ),
    Text,
    TextInput: MockTextInput,
    Tooltip: ({children}: {children: React.ReactNode}) => <>{children}</>,
    TouchableRipple: ({children, onPress, onLongPress}: {children: React.ReactNode; onPress?: () => void; onLongPress?: () => void}) => (
      <TouchableOpacity onPress={onPress} onLongPress={onLongPress}>
        {children}
      </TouchableOpacity>
    ),
    useTheme: () => ({colors: {outline: '#888', onSurfaceVariant: '#444'}}),
  };
});

const theme = {
  version: 3,
  isV3: true,
  colors: {
    tertiaryContainer: '#ccc',
  },
  fonts: {
    headlineSmall: {
      fontSize: 20,
    },
  },
};

const renderDrawer = (overrides: Record<string, unknown> = {}) =>
  render(
    <TrainingsPlanDrawer
      theme={theme}
      changeTrainingsName={jest.fn()}
      trainingsPlan={{
        id: 7,
        name: 'Plan',
        trainings: {},
        trainingNames: {1: 'Push'},
        mesos: [
          {id: 1, name: 'Meso 1', order: 1, startMicro: 1},
          {id: 2, name: 'Meso 2', order: 2, startMicro: 4},
        ],
      }}
      setTrainingInMicro={jest.fn()}
      setMicro={jest.fn()}
      setOpen={jest.fn()}
      showDone={false}
      setShowDone={jest.fn()}
      setShowHistory={jest.fn()}
      handleValueChange={jest.fn()}
      micro={4}
      onAddMeso={jest.fn()}
      onEditMeso={jest.fn()}
      onDeleteMeso={jest.fn()}
      {...overrides}
    />,
  );

describe('TrainingsPlanDrawer', () => {
  it('uses local micro numbering inside the current meso', () => {
    const {getByText, queryByText} = renderDrawer();

    expect(getByText('Micro 1')).toBeTruthy();
    expect(getByText('Micro 2')).toBeTruthy();
    expect(queryByText('Micro 3')).toBeNull();
    expect(queryByText('Micro 5')).toBeNull();
  });

  // GH-417 AC5: both switches moved into the analysis view's Plan | Train toggle.
  it('no longer offers the Planned Statistics and Muscle Map switches', () => {
    const {queryByText, queryByTestId} = renderDrawer();

    expect(queryByText('Enable Planning Mode')).toBeNull();
    expect(queryByText('Show muscle map')).toBeNull();
    expect(queryByText('Hide muscle map')).toBeNull();
    expect(queryByTestId('muscle-map-toggle')).toBeNull();
  });

  it('keeps the rest of the drawer intact', () => {
    const {getByText} = renderDrawer();

    expect(getByText('Mesos:')).toBeTruthy();
    expect(getByText('Trainings:')).toBeTruthy();
    expect(getByText('Overview')).toBeTruthy();
    expect(getByText('History')).toBeTruthy();
  });

  // GH-509: the lone "+" icons became labelled dashed buttons in the "Add Set" style.
  it('renders labelled dashed add buttons instead of plus icons', () => {
    const {getByTestId, getByText, queryByText} = renderDrawer();

    expect(getByText('Add Meso')).toBeTruthy();
    expect(getByText('Add Training')).toBeTruthy();
    expect(getByTestId('icon-plus-circle').props.accessibilityHint).toBe('outlined');
    expect(getByTestId('drawer-add-training-button').props.accessibilityHint).toBe('outlined');
    expect(queryByText('plus-circle')).toBeNull();
  });

  it('Add Meso still triggers onAddMeso', () => {
    const onAddMeso = jest.fn();
    const {getByText} = renderDrawer({onAddMeso});

    fireEvent.press(getByText('Add Meso'));

    expect(onAddMeso).toHaveBeenCalledTimes(1);
  });

  it('Add Training still appends the next numbered training', () => {
    const changeTrainingsName = jest.fn();
    const {getByText} = renderDrawer({changeTrainingsName});

    fireEvent.press(getByText('Add Training'));

    expect(changeTrainingsName).toHaveBeenCalledWith(7, 'Training 2', 2);
  });
});
