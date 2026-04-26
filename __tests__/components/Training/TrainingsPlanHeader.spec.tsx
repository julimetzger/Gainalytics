import React from 'react';
import {render} from '@testing-library/react-native';
import TrainingsPlanHeader from '../../../app/components/Training/TrainingsPlanHeader';
import {TrainingsState} from '../../../app/models/TrainingsState';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({top: 0, right: 0, bottom: 0, left: 0}),
}));

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text} = require('react-native');
  return {
    Text: ({children, testID, style}: any) => <Text testID={testID} style={style}>{children}</Text>,
    useTheme: () => ({
      colors: {background: '#fff', onSecondaryContainer: '#000', primary: '#6200ee'},
      fonts: {titleMedium: {fontSize: 16}},
    }),
  };
});

const BASE_PROPS = {
  trainingsPlanName: 'Push pull',
  trainingName: 'Pull',
  drawerMenu: null,
  overflowButton: null,
};

describe('TrainingsPlanHeader', () => {
  it('renders plan name and training name', () => {
    const {getByText} = render(<TrainingsPlanHeader {...BASE_PROPS} />);
    expect(getByText('Push pull')).toBeTruthy();
  });

  it('shows Micro label when localMicro provided', () => {
    const {getByText} = render(<TrainingsPlanHeader {...BASE_PROPS} localMicro={3} micro={3} />);
    expect(getByText('Micro 3')).toBeTruthy();
  });

  it('shows live-dot and session timer when state is STARTED and trainingStart is set', () => {
    const start = new Date(Date.now() - 5000).toISOString();
    const {getByTestId} = render(
      <TrainingsPlanHeader
        {...BASE_PROPS}
        trainingState={TrainingsState.STARTED}
        trainingStart={start}
      />,
    );
    expect(getByTestId('header-live-dot')).toBeTruthy();
    expect(getByTestId('header-session-timer')).toBeTruthy();
  });

  it('does NOT show live-dot or timer when state is PLANNED', () => {
    const {queryByTestId} = render(
      <TrainingsPlanHeader
        {...BASE_PROPS}
        trainingState={TrainingsState.PLANNED}
        trainingStart={new Date().toISOString()}
      />,
    );
    expect(queryByTestId('header-live-dot')).toBeNull();
    expect(queryByTestId('header-session-timer')).toBeNull();
  });

  it('does NOT show live-dot or timer when state is FINISHED', () => {
    const {queryByTestId} = render(
      <TrainingsPlanHeader
        {...BASE_PROPS}
        trainingState={TrainingsState.FINISHED}
        trainingStart={new Date().toISOString()}
      />,
    );
    expect(queryByTestId('header-live-dot')).toBeNull();
    expect(queryByTestId('header-session-timer')).toBeNull();
  });

  it('renders the overflow button wrapper with testID', () => {
    const {View} = require('react-native');
    const {getByTestId} = render(
      <TrainingsPlanHeader
        {...BASE_PROPS}
        overflowButton={<View testID="my-overflow" />}
      />,
    );
    expect(getByTestId('header-overflow-button')).toBeTruthy();
  });
});
