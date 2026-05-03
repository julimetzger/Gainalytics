import React from 'react';
import {render} from '@testing-library/react-native';
import Estimated1RmCard from '../../../../app/components/Training/execute/Estimated1RmCard';

jest.mock('react-native-paper', () => {
  const {Text, View} = require('react-native');
  return {
    Icon: ({source}: any) => <Text>{source}</Text>,
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
  it('shows dash and no reference when session is empty and no PR/last known', () => {
    const {getByTestId, queryByTestId} = render(
      <Estimated1RmCard sessionOneRm={0} lastTrainingOneRm={undefined} allTimePr={undefined} />,
    );
    expect(getByTestId('estimated-1rm-header')).toBeTruthy();
    expect(getByTestId('estimated-1rm-value').props.children).toBe('—');
    expect(queryByTestId('estimated-1rm-last')).toBeNull();
    expect(queryByTestId('estimated-1rm-delta')).toBeNull();
    expect(queryByTestId('estimated-1rm-pr')).toBeNull();
  });

  it('renders session 1RM and a positive delta vs last training', () => {
    // session 1RM = 127, lastTrainingOneRm = 120 → delta +7.0 kg
    const {getByTestId} = render(
      <Estimated1RmCard sessionOneRm={127} lastTrainingOneRm={120} allTimePr={130} />,
    );
    expect(getByTestId('estimated-1rm-value').props.children).toBe('127 kg');
    expect(getByTestId('estimated-1rm-last').props.children).toBe('last 120.0 kg');
    expect(getByTestId('estimated-1rm-delta').props.children).toBe('+7.0 kg');
    expect(getByTestId('estimated-1rm-pr').props.children).toBe('PR 130.0 kg');
  });

  it('shows NEW PR badge when session value beats the all-time PR', () => {
    const {getByTestId} = render(
      <Estimated1RmCard sessionOneRm={140} lastTrainingOneRm={120} allTimePr={130} />,
    );
    expect(getByTestId('estimated-1rm-pr').props.children).toBe('🏆 NEW PR');
  });

  it('shows "= 0.0 kg" when delta is zero', () => {
    const {getByTestId} = render(
      <Estimated1RmCard sessionOneRm={120} lastTrainingOneRm={120} allTimePr={130} />,
    );
    expect(getByTestId('estimated-1rm-delta').props.children).toBe('= 0.0 kg');
  });

  it('shows PR line even when session is empty', () => {
    // PR is always visible per spec
    const {getByTestId, queryByTestId} = render(
      <Estimated1RmCard sessionOneRm={0} lastTrainingOneRm={120} allTimePr={130} />,
    );
    expect(getByTestId('estimated-1rm-value').props.children).toBe('—');
    expect(getByTestId('estimated-1rm-pr').props.children).toBe('PR 130.0 kg');
    // No delta when session is empty
    expect(queryByTestId('estimated-1rm-delta')).toBeNull();
  });

  it('shows negative delta in error tint', () => {
    // session 1RM 100 < last 120 → delta -20.0 kg
    const {getByTestId} = render(
      <Estimated1RmCard sessionOneRm={100} lastTrainingOneRm={120} allTimePr={130} />,
    );
    expect(getByTestId('estimated-1rm-delta').props.children).toBe('-20.0 kg');
  });
});
