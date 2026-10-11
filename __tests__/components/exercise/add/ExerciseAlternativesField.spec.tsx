import React, {useState} from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import ExerciseAlternativesField from '../../../../app/components/exercise/add/ExerciseAlternativesField';
import {useAlleExercises} from '../../../../app/redux/Exercises/use/useAllExercises';

jest.mock('../../../../app/redux/Exercises/use/useAllExercises', () => ({
  useAlleExercises: jest.fn(),
}));

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TouchableOpacity, TextInput, View} = require('react-native');
  const Checkbox = {
    Item: ({label, status, onPress, testID}: any) => (
      <TouchableOpacity testID={testID} onPress={onPress} accessibilityState={{checked: status === 'checked'}}>
        <Text>{label}</Text>
      </TouchableOpacity>
    ),
  };
  return {
    Button: ({children, onPress, testID}: any) => (
      <TouchableOpacity testID={testID} onPress={onPress}>
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
    Checkbox,
    Chip: ({children, onClose, testID}: any) => (
      <View testID={testID}>
        <Text>{children}</Text>
        <TouchableOpacity testID={`${testID}-close`} onPress={onClose} />
      </View>
    ),
    Searchbar: ({value, onChangeText, onFocus, onBlur, testID, placeholder}: any) => (
      <TextInput testID={testID} value={value} onChangeText={onChangeText} onFocus={onFocus} onBlur={onBlur} placeholder={placeholder} />
    ),
    Text: ({children, testID}: any) => <Text testID={testID}>{children}</Text>,
    useTheme: () => ({colors: {onSurfaceVariant: '#666'}}),
  };
});

const exercises = [
  {id: 1, name: 'Squat', muscles: []},
  {id: 2, name: 'deadlift', muscles: []},
  {id: 3, name: 'Bench press', muscles: []},
  {id: 4, name: 'Front squat', muscles: []},
  {id: 5, name: 'Bulgarian split squat', muscles: []},
  {id: 6, name: 'Arnold press', muscles: []},
];

const Harness = ({initial = [] as number[], onChangeSpy = jest.fn()}) => {
  const [ids, setIds] = useState<number[]>(initial);
  return (
    <ExerciseAlternativesField
      exerciseId={1}
      alternativeIds={ids}
      onChange={(next) => {
        onChangeSpy(next);
        setIds(next);
      }}
    />
  );
};

const rowLabels = (screen: ReturnType<typeof render>) =>
  screen.queryAllByTestId(/^exercise-alternative-row-/).map((row) => row.props.testID);

const isChecked = (screen: ReturnType<typeof render>, id: number) =>
  screen.getByTestId(`exercise-alternative-row-${id}`).props.accessibilityState.checked;

describe('ExerciseAlternativesField (GH-487)', () => {
  beforeEach(() => {
    jest.mocked(useAlleExercises).mockReturnValue(exercises as any);
  });

  it('lists the other exercises alphabetically (case-insensitive) and never the edited exercise itself', () => {
    const screen = render(<Harness />);
    fireEvent.press(screen.getByTestId('exercise-alternatives-open-button'));

    expect(rowLabels(screen)).toEqual([
      'exercise-alternative-row-6', // Arnold press
      'exercise-alternative-row-3', // Bench press
      'exercise-alternative-row-5', // Bulgarian split squat
      'exercise-alternative-row-2', // deadlift
      'exercise-alternative-row-4', // Front squat
    ]);
    expect(screen.queryByTestId('exercise-alternative-row-1')).toBeNull();
  });

  it('filters live by name, case-insensitively, and shows everything again when the search is cleared', () => {
    const screen = render(<Harness />);
    fireEvent.press(screen.getByTestId('exercise-alternatives-open-button'));

    fireEvent.changeText(screen.getByTestId('exercise-alternatives-search'), 'SQU');
    expect(rowLabels(screen)).toEqual(['exercise-alternative-row-5', 'exercise-alternative-row-4']);

    fireEvent.changeText(screen.getByTestId('exercise-alternatives-search'), 'xyz');
    expect(rowLabels(screen)).toEqual([]);
    expect(screen.getByTestId('exercise-alternatives-no-match')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('exercise-alternatives-search'), '');
    expect(rowLabels(screen)).toHaveLength(5);
  });

  it('keeps selections made in a filtered list after the search changes or is cleared', () => {
    const onChangeSpy = jest.fn();
    const screen = render(<Harness initial={[3]} onChangeSpy={onChangeSpy} />);
    fireEvent.press(screen.getByTestId('exercise-alternatives-open-button'));

    fireEvent.changeText(screen.getByTestId('exercise-alternatives-search'), 'front');
    fireEvent.press(screen.getByTestId('exercise-alternative-row-4'));
    expect(isChecked(screen, 4)).toBe(true);

    fireEvent.changeText(screen.getByTestId('exercise-alternatives-search'), 'dead');
    fireEvent.press(screen.getByTestId('exercise-alternative-row-2'));

    fireEvent.changeText(screen.getByTestId('exercise-alternatives-search'), '');
    expect(isChecked(screen, 3)).toBe(true);
    expect(isChecked(screen, 4)).toBe(true);
    expect(isChecked(screen, 2)).toBe(true);
    expect(isChecked(screen, 5)).toBe(false);
    expect(onChangeSpy).toHaveBeenLastCalledWith([3, 4, 2]);

    // chips stay visible and removable
    expect(screen.getByTestId('exercise-alternative-chip-4')).toBeTruthy();
    fireEvent.press(screen.getByTestId('exercise-alternative-chip-4-close'));
    expect(onChangeSpy).toHaveBeenLastCalledWith([3, 2]);
    expect(isChecked(screen, 4)).toBe(false);
  });

  it('resets the search when the list is closed', () => {
    const screen = render(<Harness />);
    fireEvent.press(screen.getByTestId('exercise-alternatives-open-button'));
    fireEvent.changeText(screen.getByTestId('exercise-alternatives-search'), 'front');
    fireEvent.press(screen.getByTestId('exercise-alternatives-open-button'));
    fireEvent.press(screen.getByTestId('exercise-alternatives-open-button'));

    expect(screen.getByTestId('exercise-alternatives-search').props.value).toBe('');
    expect(rowLabels(screen)).toHaveLength(5);
  });

  it('re-reports the search position while focused when picked chips wrap and push the search down', () => {
    const onSearchFocus = jest.fn();
    const onSearchBlur = jest.fn();
    const screen = render(
      <ExerciseAlternativesField exerciseId={1} alternativeIds={[]} onChange={jest.fn()} onSearchFocus={onSearchFocus} onSearchBlur={onSearchBlur} />,
    );
    fireEvent.press(screen.getByTestId('exercise-alternatives-open-button'));
    const layoutAt = (y: number) =>
      fireEvent(screen.getByTestId('exercise-alternatives-search-wrap'), 'layout', {nativeEvent: {layout: {y}}});

    layoutAt(80);
    expect(onSearchFocus).not.toHaveBeenCalled(); // not focused yet

    fireEvent(screen.getByTestId('exercise-alternatives-search'), 'focus');
    expect(onSearchFocus).toHaveBeenLastCalledWith(80);

    layoutAt(128); // second chip row
    expect(onSearchFocus).toHaveBeenLastCalledWith(128);
    layoutAt(176); // third chip row
    expect(onSearchFocus).toHaveBeenLastCalledWith(176);
    expect(onSearchFocus).toHaveBeenCalledTimes(3);

    fireEvent(screen.getByTestId('exercise-alternatives-search'), 'blur');
    expect(onSearchBlur).toHaveBeenCalledTimes(1);
    layoutAt(80);
    expect(onSearchFocus).toHaveBeenCalledTimes(3);
  });
});
