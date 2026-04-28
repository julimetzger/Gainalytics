import React from 'react';
import {render} from '@testing-library/react-native';
import Estimated1RmCard from '../../../../app/components/Training/execute/Estimated1RmCard';

jest.mock('react-native-paper', () => {
  const {Text, View} = require('react-native');
  return {
    Text: ({children, testID, style}: any) => (
      <Text testID={testID} style={style}>
        {children}
      </Text>
    ),
    useTheme: () => ({
      colors: {
        primary: '#0066ff',
        error: '#ff0000',
        onSurface: '#000',
        onSurfaceVariant: '#666',
        surface: '#fff',
        surfaceVariant: '#eee',
      },
    }),
  };
});

describe('Estimated1RmCard', () => {
  it('shows only the big number when no last training and no PR are known', () => {
    const {getByTestId, queryByTestId} = render(
      <Estimated1RmCard reps={0} rir={0} weight={0} lastTrainingOneRm={undefined} allTimePr={undefined} />,
    );
    expect(getByTestId('estimated-1rm-header')).toBeTruthy();
    expect(getByTestId('estimated-1rm-value').props.children).toBe('— kg');
    expect(queryByTestId('estimated-1rm-last')).toBeNull();
    expect(queryByTestId('estimated-1rm-delta')).toBeNull();
    expect(queryByTestId('estimated-1rm-pr')).toBeNull();
  });

  it('renders live 1RM and a positive delta vs last training', () => {
    // weight=95, reps=8, rir=2 → 1RM ≈ 95 * (1 + 10/30) = 126.666 → 127 kg
    const {getByTestId} = render(
      <Estimated1RmCard reps={8} rir={2} weight={95} lastTrainingOneRm={120} allTimePr={130} />,
    );
    expect(getByTestId('estimated-1rm-value').props.children).toBe('127 kg');
    expect(getByTestId('estimated-1rm-last').props.children).toEqual(['last training: ', '120 kg']);
    expect(getByTestId('estimated-1rm-delta').props.children).toBe('▲ +7 kg vs last');
    expect(getByTestId('estimated-1rm-pr').props.children).toEqual([' · ', 'PR 130 kg']);
  });

  it('shows NEW PR badge when typed value beats the all-time PR', () => {
    // weight=140, reps=1, rir=0 → 1RM = 140 kg, beats PR=130
    const {getByTestId} = render(
      <Estimated1RmCard reps={1} rir={0} weight={140} lastTrainingOneRm={120} allTimePr={130} />,
    );
    expect(getByTestId('estimated-1rm-pr').props.children).toEqual([' · ', '🏆 NEW PR']);
  });

  it('shows "= same as last" when delta is zero', () => {
    // weight=100, reps=5, rir=2 → 1RM ≈ 100 * (1+7/30) = 123.33 → round to 123
    const {getByTestId} = render(
      <Estimated1RmCard reps={5} rir={2} weight={100} lastTrainingOneRm={123} allTimePr={130} />,
    );
    expect(getByTestId('estimated-1rm-delta').props.children).toBe('same as last');
  });
});
