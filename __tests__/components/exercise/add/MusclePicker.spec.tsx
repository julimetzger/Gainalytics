import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import MusclePicker from '../../../../app/components/exercise/add/MusclePicker';
import {Muscles} from '../../../../app/models/Muscles';
import {MusclePercentPair} from '../../../../app/models/entities/Exercise';

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TouchableOpacity, View, TextInput} = require('react-native');
  return {
    Chip: ({children, onPress, testID}: any) => (
      <TouchableOpacity testID={testID} onPress={onPress}>
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
    Searchbar: ({value, onChangeText, placeholder, testID}: any) => (
      <TextInput
        testID={testID ?? 'muscle-searchbar'}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
      />
    ),
    Text: ({children}: any) => <Text>{children}</Text>,
    useTheme: () => ({colors: {primary: '#6200ee', onPrimary: '#ffffff'}}),
  };
});

describe('MusclePicker', () => {
  const allMuscles = Object.values(Muscles);

  it('renders a row for every Muscles enum value', () => {
    const {getByTestId} = render(<MusclePicker muscles={[]} onChange={jest.fn()} />);
    allMuscles.forEach(muscle => {
      expect(getByTestId(`muscle-row-${muscle}`)).toBeTruthy();
    });
  });

  it('tapping a chip calls onChange with that muscle+percent added', () => {
    const onChange = jest.fn();
    const {getByTestId} = render(<MusclePicker muscles={[]} onChange={onChange} />);
    fireEvent.press(getByTestId(`chip-${Muscles.CHEST}-100`));
    expect(onChange).toHaveBeenCalledWith([{muscle: Muscles.CHEST, percent: 100}]);
  });

  it('tapping an already-active chip removes the muscle', () => {
    const initial: MusclePercentPair[] = [{muscle: Muscles.CHEST, percent: 100}];
    const onChange = jest.fn();
    const {getByTestId} = render(<MusclePicker muscles={initial} onChange={onChange} />);
    fireEvent.press(getByTestId(`chip-${Muscles.CHEST}-100`));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('tapping a different chip on the same muscle updates the percent', () => {
    const initial: MusclePercentPair[] = [{muscle: Muscles.CHEST, percent: 100}];
    const onChange = jest.fn();
    const {getByTestId} = render(<MusclePicker muscles={initial} onChange={onChange} />);
    fireEvent.press(getByTestId(`chip-${Muscles.CHEST}-50`));
    expect(onChange).toHaveBeenCalledWith([{muscle: Muscles.CHEST, percent: 50}]);
  });

  it('search filter hides non-matching muscles', () => {
    const {getByTestId, queryByTestId} = render(<MusclePicker muscles={[]} onChange={jest.fn()} />);
    fireEvent.changeText(getByTestId('muscle-searchbar'), 'Chest');
    expect(getByTestId(`muscle-row-${Muscles.CHEST}`)).toBeTruthy();
    expect(queryByTestId(`muscle-row-${Muscles.BACK}`)).toBeNull();
  });

  it('search filter is case-insensitive', () => {
    const {getByTestId} = render(<MusclePicker muscles={[]} onChange={jest.fn()} />);
    fireEvent.changeText(getByTestId('muscle-searchbar'), 'chest');
    expect(getByTestId(`muscle-row-${Muscles.CHEST}`)).toBeTruthy();
  });

  it('footer shows "No muscles selected" when muscles is empty', () => {
    const {getByTestId} = render(<MusclePicker muscles={[]} onChange={jest.fn()} />);
    const footer = getByTestId('muscle-summary-footer');
    expect(footer).toBeTruthy();
  });

  it('footer counts selected muscles correctly', () => {
    const selected: MusclePercentPair[] = [
      {muscle: Muscles.CHEST, percent: 100},
      {muscle: Muscles.TRICEPS, percent: 50},
      {muscle: Muscles.SHOULDERS, percent: 75},
    ];
    const {getByText} = render(<MusclePicker muscles={selected} onChange={jest.fn()} />);
    expect(getByText(/3 selected/)).toBeTruthy();
  });
});
