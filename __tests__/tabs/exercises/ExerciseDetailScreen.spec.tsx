import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import ExerciseDetailScreen from '../../../app/tabs/exercises/ExerciseDetailScreen';
import {useExercise} from '../../../app/redux/Exercises/use/useExercise';

jest.mock('../../../app/redux/Exercises/use/useExercise', () => ({
  useExercise: jest.fn(() => ({id: 5, name: 'Front squat', isFocus: true})),
}));
jest.mock('../../../app/redux/Exercises/dispatch/dispatchEditExercise', () => ({
  dispatchEditExercise: () => jest.fn(),
}));
jest.mock('../../../app/components/exercise/show/ExerciseLogTab', () => () => {
  const {Text} = require('react-native');
  return <Text testID="log-content">log</Text>;
});
jest.mock('../../../app/components/exercise/show/ExerciseStatsTab', () => () => {
  const {Text} = require('react-native');
  return <Text testID="stats-content">stats</Text>;
});
jest.mock('../../../app/components/exercise/show/ExerciseHistoryTabContent', () => () => {
  const {Text} = require('react-native');
  return <Text testID="history-content">history</Text>;
});
jest.mock('../../../app/components/exercise/show/ExerciseGraphTab', () => () => {
  const {Text} = require('react-native');
  return <Text testID="graph-content">graph</Text>;
});
jest.mock('../../../app/components/exercise/show/ExerciseDetailHeaderCards', () => () => {
  const {Text} = require('react-native');
  return <Text testID="header-cards">header-cards</Text>;
});

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TouchableOpacity} = require('react-native');
  return {
    Icon: () => null,
    IconButton: ({onPress, testID}: any) => (
      <TouchableOpacity testID={testID} onPress={onPress}>
        <Text>icon</Text>
      </TouchableOpacity>
    ),
    Text: ({children}: any) => <Text>{children}</Text>,
    useTheme: () => ({
      colors: {
        background: '#fff',
        surfaceVariant: '#eee',
        primary: '#6200ee',
        onPrimary: '#fff',
        onSurfaceVariant: '#666',
      },
    }),
  };
});

const mockedUseExercise = jest.mocked(useExercise);

describe('ExerciseDetailScreen 4-tab structure', () => {
  beforeEach(() => {
    mockedUseExercise.mockReturnValue({id: 5, name: 'Front squat', isFocus: true});
  });

  const navigation = {setOptions: jest.fn(), navigate: jest.fn(), goBack: jest.fn(), canGoBack: jest.fn(() => true)} as any;
  const route = {params: {exercise: {id: 5, name: 'Front squat', isFocus: true}}} as any;

  it('renders 4 tab buttons (Log, Stats, History, Graph) and shows Log by default', () => {
    const {getByTestId} = render(<ExerciseDetailScreen navigation={navigation} route={route} />);
    expect(getByTestId('exercise-tab-log')).toBeTruthy();
    expect(getByTestId('exercise-tab-stats')).toBeTruthy();
    expect(getByTestId('exercise-tab-history')).toBeTruthy();
    expect(getByTestId('exercise-tab-graph')).toBeTruthy();
    expect(getByTestId('log-content')).toBeTruthy();
    expect(getByTestId('header-cards')).toBeTruthy();
  });

  it('switches to Stats tab when tab button pressed', () => {
    const {getByTestId, queryByTestId} = render(<ExerciseDetailScreen navigation={navigation} route={route} />);
    fireEvent.press(getByTestId('exercise-tab-stats'));
    expect(getByTestId('stats-content')).toBeTruthy();
    expect(queryByTestId('log-content')).toBeNull();
  });

  it('switches to Graph tab when tab button pressed', () => {
    const {getByTestId} = render(<ExerciseDetailScreen navigation={navigation} route={route} />);
    fireEvent.press(getByTestId('exercise-tab-graph'));
    expect(getByTestId('graph-content')).toBeTruthy();
  });

  it('renders header pencil-edit and focus-toggle buttons', () => {
    const setOptionsCalls: any[] = [];
    const nav = {setOptions: (o: any) => setOptionsCalls.push(o), navigate: jest.fn(), goBack: jest.fn(), canGoBack: jest.fn(() => true)} as any;
    render(<ExerciseDetailScreen navigation={nav} route={route} />);
    const headerOptions = setOptionsCalls[setOptionsCalls.length - 1];
    const headerRight = headerOptions.headerRight();
    const ids = headerRight.props.children.map((c: any) => c.props.testID);
    expect(ids).toEqual(expect.arrayContaining(['exercise-detail-focus-toggle', 'exercise-detail-edit-button']));
  });

  it('navigates back when the live exercise is deleted while the screen is open', () => {
    mockedUseExercise.mockReturnValue(undefined);
    const goBackMock = jest.fn();
    const nav = {setOptions: jest.fn(), navigate: jest.fn(), goBack: goBackMock, canGoBack: jest.fn(() => true)} as any;
    render(<ExerciseDetailScreen navigation={nav} route={route} />);
    expect(goBackMock).toHaveBeenCalled();
  });
});
