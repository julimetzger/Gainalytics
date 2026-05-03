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

describe('Estimated1RmCard (r6 layout)', () => {
  it('right block ALWAYS renders, even when there is no last training and no PR', () => {
    const {getByTestId} = render(
      <Estimated1RmCard sessionOneRm={0} lastTrainingOneRm={undefined} allTimePr={undefined} />,
    );
    expect(getByTestId('estimated-1rm-header')).toBeTruthy();
    expect(getByTestId('estimated-1rm-value').props.children).toBe('—');
    expect(getByTestId('estimated-1rm-vs-caption').props.children).toBe('vs last training');
    expect(getByTestId('estimated-1rm-last').props.children).toBe('last —');
    expect(getByTestId('estimated-1rm-delta').props.children).toBe('no history yet');
  });

  it('renders session 1RM and a positive delta vs last training', () => {
    // session 1RM = 127, lastTrainingOneRm = 119 → delta +8.0 kg
    const {getByTestId} = render(
      <Estimated1RmCard sessionOneRm={127} lastTrainingOneRm={119} allTimePr={225} />,
    );
    expect(getByTestId('estimated-1rm-value').props.children).toBe('127 kg');
    expect(getByTestId('estimated-1rm-last').props.children).toBe('last 119.0 kg');
    expect(getByTestId('estimated-1rm-delta').props.children).toBe('+8.0 kg');
    expect(getByTestId('estimated-1rm-pr').props.children).toBe('PR 225.0 kg');
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

  it('shows PR line directly under the hero value when session is empty but PR is known', () => {
    const {getByTestId} = render(
      <Estimated1RmCard sessionOneRm={0} lastTrainingOneRm={120} allTimePr={130} />,
    );
    expect(getByTestId('estimated-1rm-value').props.children).toBe('—');
    expect(getByTestId('estimated-1rm-pr').props.children).toBe('PR 130.0 kg');
    // Right block still renders — caption and last visible, delta empty (no session yet).
    expect(getByTestId('estimated-1rm-vs-caption').props.children).toBe('vs last training');
    expect(getByTestId('estimated-1rm-last').props.children).toBe('last 120.0 kg');
    expect(getByTestId('estimated-1rm-delta').props.children).toBe('');
  });

  it('shows negative delta in error tint', () => {
    const {getByTestId} = render(
      <Estimated1RmCard sessionOneRm={100} lastTrainingOneRm={120} allTimePr={130} />,
    );
    expect(getByTestId('estimated-1rm-delta').props.children).toBe('-20.0 kg');
  });
});
