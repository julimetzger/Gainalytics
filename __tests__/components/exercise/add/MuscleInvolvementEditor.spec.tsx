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

const layoutBar = (bar: any, width = 200) =>
  fireEvent(bar, 'layout', {
    nativeEvent: {layout: {x: 0, y: 0, width, height: 16}},
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

  describe('tap-to-set on the progress bar', () => {
    it('tapping at the 50% mark sets percent to 50 and the TextInput shows "50"', () => {
      const onChange = jest.fn();
      const {getByTestId, rerender} = render(
        <MuscleInvolvementEditor pairs={[]} onChange={onChange} />,
      );
      const bar = getByTestId(`muscle-bar-${Muscles.CHEST}`);
      layoutBar(bar, 200);
      fireEvent(bar, 'responderGrant', {nativeEvent: {locationX: 100}});
      expect(onChange).toHaveBeenCalledWith([{muscle: Muscles.CHEST, percent: 50}]);

      const next = onChange.mock.calls[onChange.mock.calls.length - 1][0];
      rerender(<MuscleInvolvementEditor pairs={next} onChange={onChange} />);
      expect(getByTestId(`muscle-input-${Muscles.CHEST}`).props.value).toBe('50');
    });

    it('typing in the TextInput updates the bar fill width', () => {
      const onChange = jest.fn();
      const {getByTestId, rerender} = render(
        <MuscleInvolvementEditor pairs={[]} onChange={onChange} />,
      );
      fireEvent.changeText(getByTestId(`muscle-input-${Muscles.CHEST}`), '70');
      const next = onChange.mock.calls[0][0];
      rerender(<MuscleInvolvementEditor pairs={next} onChange={onChange} />);
      const fill = getByTestId(`muscle-bar-fill-${Muscles.CHEST}`);
      expect(fill.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({width: '70%'})]),
      );
    });

    it('tap and TextInput share state — switching between them keeps the value consistent', () => {
      const onChange = jest.fn();
      const {getByTestId, rerender} = render(
        <MuscleInvolvementEditor pairs={[]} onChange={onChange} />,
      );
      const bar = getByTestId(`muscle-bar-${Muscles.CHEST}`);
      layoutBar(bar, 200);
      fireEvent(bar, 'responderGrant', {nativeEvent: {locationX: 60}}); // 30%
      let pairs = onChange.mock.calls[onChange.mock.calls.length - 1][0];
      rerender(<MuscleInvolvementEditor pairs={pairs} onChange={onChange} />);
      expect(getByTestId(`muscle-input-${Muscles.CHEST}`).props.value).toBe('30');

      fireEvent.changeText(getByTestId(`muscle-input-${Muscles.CHEST}`), '85');
      pairs = onChange.mock.calls[onChange.mock.calls.length - 1][0];
      rerender(<MuscleInvolvementEditor pairs={pairs} onChange={onChange} />);
      const fill = getByTestId(`muscle-bar-fill-${Muscles.CHEST}`);
      expect(fill.props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({width: '85%'})]),
      );
    });

    it('tapping at the very-left of the bar (x ~ 0) sets percent to 0 and removes the muscle', () => {
      const onChange = jest.fn();
      const {getByTestId} = render(
        <MuscleInvolvementEditor
          pairs={[{muscle: Muscles.CHEST, percent: 60}]}
          onChange={onChange}
        />,
      );
      const bar = getByTestId(`muscle-bar-${Muscles.CHEST}`);
      layoutBar(bar, 200);
      fireEvent(bar, 'responderGrant', {nativeEvent: {locationX: 0}});
      expect(onChange).toHaveBeenCalledWith([]);
    });

    it('tapping past the right edge clamps to 100', () => {
      const onChange = jest.fn();
      const {getByTestId} = render(
        <MuscleInvolvementEditor pairs={[]} onChange={onChange} />,
      );
      const bar = getByTestId(`muscle-bar-${Muscles.CHEST}`);
      layoutBar(bar, 200);
      fireEvent(bar, 'responderGrant', {nativeEvent: {locationX: 9999}});
      expect(onChange).toHaveBeenCalledWith([{muscle: Muscles.CHEST, percent: 100}]);
    });

    it('drag (responderMove) updates the percent live', () => {
      const onChange = jest.fn();
      const {getByTestId} = render(
        <MuscleInvolvementEditor pairs={[]} onChange={onChange} />,
      );
      const bar = getByTestId(`muscle-bar-${Muscles.CHEST}`);
      layoutBar(bar, 200);
      fireEvent(bar, 'responderGrant', {nativeEvent: {locationX: 20}}); // 10%
      fireEvent(bar, 'responderMove', {nativeEvent: {locationX: 80}}); // 40%
      fireEvent(bar, 'responderMove', {nativeEvent: {locationX: 160}}); // 80%
      const calls = onChange.mock.calls.map((c) => c[0]);
      const lastPercent = calls[calls.length - 1][0].percent;
      expect(lastPercent).toBe(80);
      expect(calls.length).toBeGreaterThanOrEqual(3);
    });

    it('tap on a not-yet-laid-out bar (width 0) is a no-op', () => {
      const onChange = jest.fn();
      const {getByTestId} = render(
        <MuscleInvolvementEditor pairs={[]} onChange={onChange} />,
      );
      const bar = getByTestId(`muscle-bar-${Muscles.CHEST}`);
      // No layout event fired yet.
      fireEvent(bar, 'responderGrant', {nativeEvent: {locationX: 100}});
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('accessibility — adjustable role with increment/decrement', () => {
    it('the bar is exposed as an adjustable with the current percent and steppable actions', () => {
      const {getByTestId} = render(
        <MuscleInvolvementEditor pairs={[{muscle: Muscles.CHEST, percent: 40}]} onChange={jest.fn()} />,
      );
      const bar = getByTestId(`muscle-bar-${Muscles.CHEST}`);
      expect(bar.props.accessibilityRole).toBe('adjustable');
      expect(bar.props.accessibilityValue).toEqual({min: 0, max: 100, now: 40});
      const actionNames = bar.props.accessibilityActions.map((a: any) => a.name);
      expect(actionNames).toEqual(expect.arrayContaining(['increment', 'decrement']));
    });

    it('increment action raises the percent by 5 (clamped at 100)', () => {
      const onChange = jest.fn();
      const {getByTestId, rerender} = render(
        <MuscleInvolvementEditor pairs={[{muscle: Muscles.CHEST, percent: 40}]} onChange={onChange} />,
      );
      const bar = getByTestId(`muscle-bar-${Muscles.CHEST}`);
      fireEvent(bar, 'accessibilityAction', {nativeEvent: {actionName: 'increment'}});
      expect(onChange).toHaveBeenCalledWith([{muscle: Muscles.CHEST, percent: 45}]);

      rerender(
        <MuscleInvolvementEditor pairs={[{muscle: Muscles.CHEST, percent: 98}]} onChange={onChange} />,
      );
      const bar98 = getByTestId(`muscle-bar-${Muscles.CHEST}`);
      onChange.mockClear();
      fireEvent(bar98, 'accessibilityAction', {nativeEvent: {actionName: 'increment'}});
      expect(onChange).toHaveBeenCalledWith([{muscle: Muscles.CHEST, percent: 100}]);
    });

    it('decrement action lowers the percent by 5 (clamped at 0)', () => {
      const onChange = jest.fn();
      const {getByTestId, rerender} = render(
        <MuscleInvolvementEditor pairs={[{muscle: Muscles.CHEST, percent: 40}]} onChange={onChange} />,
      );
      const bar = getByTestId(`muscle-bar-${Muscles.CHEST}`);
      fireEvent(bar, 'accessibilityAction', {nativeEvent: {actionName: 'decrement'}});
      expect(onChange).toHaveBeenCalledWith([{muscle: Muscles.CHEST, percent: 35}]);

      rerender(
        <MuscleInvolvementEditor pairs={[{muscle: Muscles.CHEST, percent: 3}]} onChange={onChange} />,
      );
      const bar3 = getByTestId(`muscle-bar-${Muscles.CHEST}`);
      onChange.mockClear();
      fireEvent(bar3, 'accessibilityAction', {nativeEvent: {actionName: 'decrement'}});
      // 3 - 5 = -2 → clamped to 0 → muscle removed
      expect(onChange).toHaveBeenCalledWith([]);
    });
  });
});
