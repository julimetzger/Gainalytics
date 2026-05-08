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

const mockUseExerciseFn = jest.fn(() => undefined);
jest.mock('../../../app/redux/Exercises/use/useExercise', () => ({
  useExercise: (id: number | undefined) => mockUseExerciseFn(id),
}));

jest.mock('../../../app/redux/Workout/use/useWorkoutsByExerciseId', () => ({
  useWorkoutsByExerciseId: () => [{id: 1}, {id: 2}, {id: 3}],
}));

jest.mock('../../../app/components/exercise/add/ExerciseAlternativesField', () => () => null);

// Render the inline MuscleInvolvementEditor as a simple stub so tests can drive
// it via testIDs without going through the real chips/progress-bar layout.
jest.mock('../../../app/components/exercise/add/MuscleInvolvementEditor', () => {
  const React = require('react');
  const {View, TouchableOpacity, Text} = require('react-native');
  return ({pairs, onChange}: any) => (
    <View testID="muscle-involvement-editor">
      <TouchableOpacity
        testID="apply-pull-mix"
        onPress={() =>
          onChange([
            {muscle: 'BACK', percent: 100},
            {muscle: 'BICEPS', percent: 75},
          ])
        }
      >
        <Text>apply</Text>
      </TouchableOpacity>
      <Text testID="pairs-count">{pairs.length}</Text>
    </View>
  );
});

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TouchableOpacity, TextInput, View} = require('react-native');
  const Switch = ({value, onValueChange, testID}: any) => (
    <TouchableOpacity testID={testID} onPress={() => onValueChange(!value)}>
      <Text>{value ? 'on' : 'off'}</Text>
    </TouchableOpacity>
  );
  const Dialog = ({visible, children, testID}: any) => (visible ? <View testID={testID}>{children}</View> : null);
  Dialog.Title = ({children}: any) => <Text>{children}</Text>;
  Dialog.Content = ({children}: any) => <View>{children}</View>;
  Dialog.Actions = ({children}: any) => <View>{children}</View>;
  return {
    Button: ({children, onPress, disabled, testID}: any) => (
      <TouchableOpacity testID={testID} onPress={disabled ? undefined : onPress} accessibilityState={{disabled}}>
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
    Dialog,
    Icon: () => null,
    IconButton: ({onPress, testID}: any) => (
      <TouchableOpacity testID={testID} onPress={onPress}>
        <Text>icon</Text>
      </TouchableOpacity>
    ),
    Portal: ({children}: any) => <View>{children}</View>,
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
    mockUseExerciseFn.mockReturnValue(undefined as any);
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

  it('renders the MuscleInvolvementEditor inline (no popup) and accepts arbitrary percentages', () => {
    const {nav, setOptionsMock} = makeNavigation();
    const {getByTestId, queryByTestId} = render(<EditExerciseSheet navigation={nav as any} route={{params: {}} as any} />);

    // Inline: editor is visible from the start, no button to open it.
    expect(getByTestId('muscle-involvement-editor')).toBeTruthy();
    expect(queryByTestId('edit-exercise-muscle-button')).toBeNull();

    fireEvent.changeText(getByTestId('edit-exercise-name'), 'Pull');
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

  it('Delete asks for confirmation before dispatching DELETE_EXERCISE', () => {
    mockUseExerciseFn.mockReturnValue({id: 7, name: 'Bench', muscles: [], alternativeIds: [], isFocus: false} as any);
    const {nav, goBackMock} = makeNavigation();
    const {getByTestId, queryByTestId} = render(
      <EditExerciseSheet navigation={nav as any} route={{params: {exerciseId: 7}} as any} />,
    );

    // Step 1 — Delete button does NOT immediately dispatch.
    fireEvent.press(getByTestId('edit-exercise-delete'));
    expect(mockDeleteExercise).not.toHaveBeenCalled();
    expect(goBackMock).not.toHaveBeenCalled();

    // Confirmation dialog is now visible.
    expect(getByTestId('edit-exercise-delete-dialog')).toBeTruthy();

    // Step 2 — Cancel keeps the exercise.
    fireEvent.press(getByTestId('edit-exercise-delete-cancel'));
    expect(mockDeleteExercise).not.toHaveBeenCalled();
    expect(queryByTestId('edit-exercise-delete-dialog')).toBeNull();

    // Re-open and confirm.
    fireEvent.press(getByTestId('edit-exercise-delete'));
    fireEvent.press(getByTestId('edit-exercise-delete-confirm'));
    expect(mockDeleteExercise).toHaveBeenCalledWith(7);
    expect(goBackMock).toHaveBeenCalled();
  });
});
