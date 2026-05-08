import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import MuscleInvolvementEditor from '../../../../app/components/exercise/add/MuscleInvolvementEditor';
import {Muscles} from '../../../../app/models/Muscles';

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TextInput: RNInput, View} = require('react-native');
  const TextInput = ({value, onChangeText, testID}: any) => (
    <RNInput testID={testID} value={value} onChangeText={onChangeText} />
  );
  TextInput.Affix = ({text}: any) => <Text>{text}</Text>;
  TextInput.Icon = () => null;
  return {
    Text: ({children}: any) => <Text>{children}</Text>,
    TextInput,
    useTheme: () => ({
      colors: {
        primary: '#6200ee',
        onPrimary: '#fff',
        onSurface: '#000',
        onSurfaceVariant: '#666',
        outlineVariant: '#ccc',
        surfaceVariant: '#eee',
      },
    }),
    View,
  };
});

describe('MuscleInvolvementEditor (numeric input)', () => {
  it('renders inline without a Portal/Dialog wrapper', () => {
    const {getByTestId} = render(
      <MuscleInvolvementEditor pairs={[]} onChange={jest.fn()} />,
    );
    expect(getByTestId('muscle-involvement-editor')).toBeTruthy();
    const paper = require('react-native-paper');
    expect(paper.Portal).toBeUndefined();
    expect(paper.Dialog).toBeUndefined();
  });

  it('shows a numeric input per muscle (no quick-%-chips)', () => {
    const {getByTestId, queryByTestId} = render(
      <MuscleInvolvementEditor pairs={[]} onChange={jest.fn()} />,
    );
    expect(getByTestId(`muscle-input-${Muscles.CHEST}`)).toBeTruthy();
    expect(queryByTestId(`muscle-chip-${Muscles.CHEST}-25`)).toBeNull();
    expect(queryByTestId(`muscle-chip-${Muscles.CHEST}-50`)).toBeNull();
    expect(queryByTestId(`muscle-chip-${Muscles.CHEST}-75`)).toBeNull();
    expect(queryByTestId(`muscle-chip-${Muscles.CHEST}-100`)).toBeNull();
  });

  it('typing a number sets the percent for the muscle', () => {
    const onChange = jest.fn();
    const {getByTestId} = render(
      <MuscleInvolvementEditor pairs={[]} onChange={onChange} />,
    );
    fireEvent.changeText(getByTestId(`muscle-input-${Muscles.CHEST}`), '60');
    expect(onChange).toHaveBeenCalledWith([{muscle: Muscles.CHEST, percent: 60}]);
  });

  it('clearing the input removes the muscle from the pair list', () => {
    const onChange = jest.fn();
    const {getByTestId} = render(
      <MuscleInvolvementEditor
        pairs={[{muscle: Muscles.CHEST, percent: 60}]}
        onChange={onChange}
      />,
    );
    fireEvent.changeText(getByTestId(`muscle-input-${Muscles.CHEST}`), '');
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('typing a non-numeric character is a no-op (does not crash)', () => {
    const onChange = jest.fn();
    const {getByTestId} = render(
      <MuscleInvolvementEditor pairs={[]} onChange={onChange} />,
    );
    fireEvent.changeText(getByTestId(`muscle-input-${Muscles.CHEST}`), 'abc');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('typing a value > 100 clamps to 100', () => {
    const onChange = jest.fn();
    const {getByTestId} = render(
      <MuscleInvolvementEditor pairs={[]} onChange={onChange} />,
    );
    fireEvent.changeText(getByTestId(`muscle-input-${Muscles.CHEST}`), '250');
    expect(onChange).toHaveBeenCalledWith([{muscle: Muscles.CHEST, percent: 100}]);
  });

  it('progress-bar fill width matches the percent immediately when pairs change', () => {
    const {getByTestId, rerender} = render(
      <MuscleInvolvementEditor pairs={[{muscle: Muscles.CHEST, percent: 75}]} onChange={jest.fn()} />,
    );
    const fill = getByTestId(`muscle-bar-fill-${Muscles.CHEST}`);
    expect(fill.props.style).toEqual(expect.arrayContaining([expect.objectContaining({width: '75%'})]));

    rerender(<MuscleInvolvementEditor pairs={[{muscle: Muscles.CHEST, percent: 25}]} onChange={jest.fn()} />);
    const fill25 = getByTestId(`muscle-bar-fill-${Muscles.CHEST}`);
    expect(fill25.props.style).toEqual(expect.arrayContaining([expect.objectContaining({width: '25%'})]));
  });

  it('progress-bar fill is 0% when the muscle is unassigned', () => {
    const {getByTestId} = render(
      <MuscleInvolvementEditor pairs={[]} onChange={jest.fn()} />,
    );
    const fill = getByTestId(`muscle-bar-fill-${Muscles.QUADS}`);
    expect(fill.props.style).toEqual(expect.arrayContaining([expect.objectContaining({width: '0%'})]));
  });

  it('does NOT enforce sum=100 — multiple non-equal percentages are accepted', () => {
    const onChange = jest.fn();
    const {getByTestId, rerender} = render(
      <MuscleInvolvementEditor pairs={[{muscle: Muscles.CHEST, percent: 100}]} onChange={onChange} />,
    );
    fireEvent.changeText(getByTestId(`muscle-input-${Muscles.SHOULDERS}`), '75');
    const next = onChange.mock.calls[0][0];
    rerender(<MuscleInvolvementEditor pairs={next} onChange={onChange} />);
    const sum = next.reduce((s: number, p: {percent: number}) => s + p.percent, 0);
    expect(sum).toBe(175);
  });
});
