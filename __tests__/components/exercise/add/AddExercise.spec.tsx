import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import AddExercise from '../../../../app/components/exercise/add/AddExercise';

const mockDispatchAdd = jest.fn();
const mockDispatchEdit = jest.fn();
const mockDeleteExercise = jest.fn();

jest.mock('../../../../app/redux/Exercises/dispatch/dispatchAddExercise', () => ({
  useDispatchAddExercise: () => mockDispatchAdd,
}));

jest.mock('../../../../app/redux/Exercises/dispatch/dispatchEditExercise', () => ({
  dispatchEditExercise: () => mockDispatchEdit,
}));

jest.mock('../../../../app/redux/Exercises/dispatch/dispatchDeleteExercise', () => ({
  dispatchDeleteExercise: () => mockDeleteExercise,
}));

jest.mock('../../../../app/redux/Exercises/use/useExercise', () => ({
  useExercise: jest.fn(() => undefined),
}));

jest.mock('../../../../app/components/exercise/add/MuscleInvolvementEditor', () => () => null);
jest.mock('../../../../app/components/exercise/add/ExerciseAlternativesField', () => () => null);

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TouchableOpacity, View} = require('react-native');
  const Dialog = ({children, visible}: any) => (visible ? <View>{children}</View> : null);
  Dialog.Title = ({children}: any) => <Text>{children}</Text>;
  Dialog.Content = ({children}: any) => <View>{children}</View>;
  Dialog.Actions = ({children}: any) => <View>{children}</View>;
  const Portal = ({children}: any) => <>{children}</>;
  return {
    Button: ({children, onPress}: any) => (
      <TouchableOpacity onPress={onPress}>
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
    Checkbox: ({status, onPress, testID}: any) => (
      <TouchableOpacity testID={testID} onPress={onPress}>
        <Text>{status}</Text>
      </TouchableOpacity>
    ),
    Dialog,
    IconButton: ({onPress, testID}: any) => (
      <TouchableOpacity testID={testID} onPress={onPress}>
        <Text>icon</Text>
      </TouchableOpacity>
    ),
    Portal,
    Text: ({children, onPress}: any) => <Text onPress={onPress}>{children}</Text>,
    TextInput: ({value, onChangeText, label}: any) => {
      const {TextInput: RNInput} = require('react-native');
      return <RNInput value={value} onChangeText={onChangeText} placeholder={label} />;
    },
    useTheme: () => ({colors: {error: '#f00', tertiaryContainer: '#ccc', tertiary: '#999'}}),
  };
});

describe('AddExercise', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('dispatches isFocus=false by default when adding a new exercise', () => {
    const {getByTestId, getByText, getByPlaceholderText} = render(<AddExercise />);

    fireEvent.press(getByTestId('add-exercise-button'));
    fireEvent.changeText(getByPlaceholderText('Name of the Exercise'), 'New Exercise');
    fireEvent.press(getByText('Done'));

    expect(mockDispatchAdd).toHaveBeenCalledWith('New Exercise', [], [], false);
  });

  it('dispatches isFocus=true when Focus Exercise checkbox is checked before saving', () => {
    const {getByTestId, getByText, getByPlaceholderText} = render(<AddExercise />);

    fireEvent.press(getByTestId('add-exercise-button'));
    fireEvent.changeText(getByPlaceholderText('Name of the Exercise'), 'Focus Ex');
    fireEvent.press(getByTestId('focus-exercise-checkbox'));
    fireEvent.press(getByText('Done'));

    expect(mockDispatchAdd).toHaveBeenCalledWith('Focus Ex', [], [], true);
  });
});
