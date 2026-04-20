import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import FocusExercisesCard from '../../../../app/tabs/Analyse/dashboard/FocusExercisesCard';
import {Exercise} from '../../../../app/models/entities/Exercise';
import {Metric} from '../../../../app/models/Metric';
import {Comparison} from '../../../../app/components/analyse/MetricsOverviewForWorkouts';

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TouchableOpacity, View} = require('react-native');
  const Card = ({children, testID}: any) => <View testID={testID}>{children}</View>;
  Card.Title = ({title}: any) => <Text>{title}</Text>;
  Card.Content = ({children}: any) => <View>{children}</View>;
  return {
    Card,
    Icon: () => null,
    Text: ({children}: any) => <Text>{children}</Text>,
    useTheme: () => ({colors: {primary: '#000', error: '#f00', onSurface: '#333'}}),
  };
});

function makeMetrics(volume: number, oneRm?: number): Map<Metric, Comparison> {
  const m = new Map<Metric, Comparison>();
  m.set(Metric.VOLUME, {value: volume, difference: undefined} as any);
  if (oneRm !== undefined) {
    m.set(Metric.ONE_RM, {value: oneRm, difference: undefined} as any);
  }
  return m;
}

describe('FocusExercisesCard', () => {
  it('renders nothing when no focus exercises have data', () => {
    const focusExercise: Exercise = {id: 1, name: 'Bench Press', isFocus: true};
    const map = new Map<Exercise, Map<Metric, Comparison>>();
    map.set(focusExercise, makeMetrics(0));

    const {toJSON} = render(
      <FocusExercisesCard exerciseMetricMap={map} onExercisePress={jest.fn()} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders nothing when there are no focus exercises', () => {
    const exercise: Exercise = {id: 1, name: 'Bench Press', isFocus: false};
    const map = new Map<Exercise, Map<Metric, Comparison>>();
    map.set(exercise, makeMetrics(5000));

    const {toJSON} = render(
      <FocusExercisesCard exerciseMetricMap={map} onExercisePress={jest.fn()} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders focus exercises that have volume data', () => {
    const focusExercise: Exercise = {id: 1, name: 'Bench Press', isFocus: true};
    const nonFocusExercise: Exercise = {id: 2, name: 'Squat', isFocus: false};
    const map = new Map<Exercise, Map<Metric, Comparison>>();
    map.set(focusExercise, makeMetrics(10000));
    map.set(nonFocusExercise, makeMetrics(20000));

    const {getByText, queryByText} = render(
      <FocusExercisesCard exerciseMetricMap={map} onExercisePress={jest.fn()} />,
    );
    expect(getByText('Bench Press')).toBeTruthy();
    expect(queryByText('Squat')).toBeNull();
  });

  it('does not render focus exercises without data', () => {
    const withData: Exercise = {id: 1, name: 'Bench Press', isFocus: true};
    const withoutData: Exercise = {id: 2, name: 'Deadlift', isFocus: true};
    const map = new Map<Exercise, Map<Metric, Comparison>>();
    map.set(withData, makeMetrics(10000));
    map.set(withoutData, makeMetrics(0));

    const {getByText, queryByText} = render(
      <FocusExercisesCard exerciseMetricMap={map} onExercisePress={jest.fn()} />,
    );
    expect(getByText('Bench Press')).toBeTruthy();
    expect(queryByText('Deadlift')).toBeNull();
  });

  it('calls onExercisePress with the exercise when tapped', () => {
    const focusExercise: Exercise = {id: 1, name: 'Bench Press', isFocus: true};
    const map = new Map<Exercise, Map<Metric, Comparison>>();
    map.set(focusExercise, makeMetrics(10000));
    const onPress = jest.fn();

    const {getByTestId} = render(
      <FocusExercisesCard exerciseMetricMap={map} onExercisePress={onPress} />,
    );
    const row = getByTestId('focus-exercise-1');
    fireEvent.press(row);
    expect(onPress).toHaveBeenCalledWith(focusExercise);
  });
});
