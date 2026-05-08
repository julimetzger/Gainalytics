import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import EditExerciseSheet from '../../../app/tabs/exercises/EditExerciseSheet';
import {Muscles} from '../../../app/models/Muscles';

const mockDispatchAdd = jest.fn();
const mockDispatchEdit = jest.fn();
const mockDeleteExercise = jest.fn();

jest.mock('../../../app/redux/Exercises/dispatch/dispatchAddExercise', () => ({
  useDispatchAddExercise: () => mockDispatchAdd,
}));

jest.mock('../../../app/redux/Exercises/dispatch/dispatchEditExercise', () => ({
  dispatchEditExercise: () => mockDispatchEdit,
}));

jest.mock('../../../app/redux/Exercises/dispatch/dispatchDeleteExercise', () => ({
  dispatchDeleteExercise: () => mockDeleteExercise,
}));

jest.mock('../../../app/redux/Exercises/use/useExercise', () => ({
  useExercise: jest.fn(() => undefined),
}));

jest.mock('../../../app/components/exercise/add/ExerciseAlternativesField', () => () => null);

// Render the GH-163 MuscleInvolvementEditor as a simple inline editor so tests
// can drive it via testIDs without going through paper Dialog/Portal.
jest.mock('../../../app/components/exercise/add/MuscleInvolvementEditor', () => {
  const React = require('react');
  const {View, TouchableOpacity, Text} = require('react-native');
  return ({visible, onApply, onDismiss, initialPairs}: any) => {
    if (!visible) return null;
    return (
      <View testID="muscle-involvement-editor">
        <TouchableOpacity
          testID="apply-pull-mix"
          onPress={() => {
            onApply([
              {muscle: 'BACK', percent: 100},
              {muscle: 'BICEPS', percent: 75},
            ]);
            onDismiss();
          }}
        >
          <Text>apply</Text>
        </TouchableOpacity>
        <Text testID="initial-count">{initialPairs.length}</Text>
      </View>
    );
  };
});

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TouchableOpacity, TextInput, View} = require('react-native');
  const Switch = ({value, onValueChange, testID}: any) => (
    <TouchableOpacity testID={testID} onPress={() => onValueChange(!value)}>
      <Text>{value ? 'on' : 'off'}</Text>
    </TouchableOpacity>
  );
  return {
    Button: ({children, onPress, disabled, testID}: any) => (
      <TouchableOpacity testID={testID} onPress={disabled ? undefined : onPress} accessibilityState={{disabled}}>
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
    Icon: () => null,
    IconButton: ({onPress, testID}: any) => (
      <TouchableOpacity testID={testID} onPress={onPress}>
        <Text>icon</Text>
      </TouchableOpacity>
    ),
    Switch,
    Text: ({children}: any) => <Text>{children}</Text>,
    TextInput: ({value, onChangeText, label, testID, placeholder}: any) => (
      <TextInput testID={testID} value={value} onChangeText={onChangeText} placeholder={placeholder ?? label} />
    ),
    useTheme: () => ({colors: {error: '#f00', primary: '#6200ee', onPrimary: '#fff', onSurface: '#000', onSurfaceVariant: '#666', background: '#fff'}}),
  };
});

const makeNavigation = () => {
  const setOptionsMock = jest.fn();
  const goBackMock = jest.fn();
  return {
    nav: {setOptions: setOptionsMock, goBack: goBackMock},
    setOptionsMock,
    goBackMock,
  };
};

describe('EditExerciseSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const lastHeaderRight = (setOptionsMock: jest.Mock) => {
    const lastCall = setOptionsMock.mock.calls[setOptionsMock.mock.calls.length - 1][0];
    return lastCall.headerRight();
  };

  it('Save button is disabled while name is empty', () => {
    const {nav, setOptionsMock} = makeNavigation();
    render(<EditExerciseSheet navigation={nav as any} route={{params: {}} as any} />);
    const headerRight = lastHeaderRight(setOptionsMock);
    expect(headerRight.props.disabled).toBe(true);
  });

  it('Save dispatches add and goes back when name is non-empty', () => {
    const {nav, setOptionsMock, goBackMock} = makeNavigation();
    const {getByTestId} = render(<EditExerciseSheet navigation={nav as any} route={{params: {}} as any} />);
    fireEvent.changeText(getByTestId('edit-exercise-name'), 'Front squat');

    const headerRight = lastHeaderRight(setOptionsMock);
    expect(headerRight.props.disabled).toBe(false);
    headerRight.props.onPress();

    expect(mockDispatchAdd).toHaveBeenCalledWith('Front squat', [], [], false);
    expect(goBackMock).toHaveBeenCalled();
  });

  it('embeds MuscleInvolvementEditor and accepts arbitrary muscle percentages without sum=100 validation', () => {
    const {nav, setOptionsMock} = makeNavigation();
    const {getByTestId, queryByTestId} = render(<EditExerciseSheet navigation={nav as any} route={{params: {}} as any} />);

    fireEvent.changeText(getByTestId('edit-exercise-name'), 'Pull');
    expect(queryByTestId('muscle-involvement-editor')).toBeNull();
    fireEvent.press(getByTestId('edit-exercise-muscle-button'));
    fireEvent.press(getByTestId('apply-pull-mix'));

    const headerRight = lastHeaderRight(setOptionsMock);
    headerRight.props.onPress();

    const dispatched = mockDispatchAdd.mock.calls[0];
    const dispatchedMuscles: {muscle: Muscles; percent: number}[] = dispatched[1];
    const sum = dispatchedMuscles.reduce((s, p) => s + p.percent, 0);
    expect(sum).toBe(175);
    expect(dispatched[0]).toBe('Pull');
    expect(dispatched[3]).toBe(false);
  });
});
