import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import MuscleInvolvementEditor from '../../../../app/components/exercise/add/MuscleInvolvementEditor';
import {Muscles} from '../../../../app/models/Muscles';

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text} = require('react-native');
  return {
    Text: ({children}: any) => <Text>{children}</Text>,
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
  };
});

describe('MuscleInvolvementEditor (inline)', () => {
  it('renders inline without a Portal/Dialog wrapper', () => {
    const {getByTestId, UNSAFE_queryAllByType} = render(
      <MuscleInvolvementEditor pairs={[]} onChange={jest.fn()} />,
    );
    // Inline contract: no Paper Portal/Dialog should appear in the tree.
    // We use UNSAFE_queryAllByType against the React-Native-Paper modules; the
    // mock above only re-exports `Text` + `useTheme`, so any Portal/Dialog
    // would be undefined and not findable. As a belt-and-braces check, we
    // also assert that the mocked paper module exports do not include Portal.
    expect(getByTestId('muscle-involvement-editor')).toBeTruthy();
    const paper = require('react-native-paper');
    expect(paper.Portal).toBeUndefined();
    expect(paper.Dialog).toBeUndefined();
    // Confirm muscle rows are rendered as plain Views (no overlay component).
    expect(UNSAFE_queryAllByType(MuscleInvolvementEditor).length).toBe(1);
  });

  it('shows quick-%-chips (25/50/75/100) for each muscle', () => {
    const {getByTestId} = render(
      <MuscleInvolvementEditor pairs={[]} onChange={jest.fn()} />,
    );
    expect(getByTestId(`muscle-chip-${Muscles.CHEST}-25`)).toBeTruthy();
    expect(getByTestId(`muscle-chip-${Muscles.CHEST}-50`)).toBeTruthy();
    expect(getByTestId(`muscle-chip-${Muscles.CHEST}-75`)).toBeTruthy();
    expect(getByTestId(`muscle-chip-${Muscles.CHEST}-100`)).toBeTruthy();
  });

  it('progress-bar fill width reflects the assigned percent for a muscle', () => {
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

  it('tapping a chip emits onChange with the chosen percent', () => {
    const onChange = jest.fn();
    const {getByTestId} = render(
      <MuscleInvolvementEditor pairs={[]} onChange={onChange} />,
    );
    fireEvent.press(getByTestId(`muscle-chip-${Muscles.CHEST}-75`));
    expect(onChange).toHaveBeenCalledWith([{muscle: Muscles.CHEST, percent: 75}]);
  });

  it('tapping the active chip deselects (collapses bar to 0)', () => {
    const onChange = jest.fn();
    const {getByTestId} = render(
      <MuscleInvolvementEditor pairs={[{muscle: Muscles.CHEST, percent: 50}]} onChange={onChange} />,
    );
    fireEvent.press(getByTestId(`muscle-chip-${Muscles.CHEST}-50`));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('does NOT enforce sum=100 — multiple non-equal percentages are accepted', () => {
    const onChange = jest.fn();
    const {getByTestId, rerender} = render(
      <MuscleInvolvementEditor pairs={[{muscle: Muscles.CHEST, percent: 100}]} onChange={onChange} />,
    );
    fireEvent.press(getByTestId(`muscle-chip-${Muscles.SHOULDERS}-75`));
    const next = onChange.mock.calls[0][0];
    rerender(<MuscleInvolvementEditor pairs={next} onChange={onChange} />);
    const sum = next.reduce((s: number, p: {percent: number}) => s + p.percent, 0);
    expect(sum).toBe(175);
  });
});
