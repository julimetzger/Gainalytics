/**
 * GH-458 round 2 (review #1): the empty state used to gate on
 * `muscleMetricMap`/`exerciseMetricMap`, which are built from the selected
 * period AND the comparison period combined — so a selected period with zero
 * sets still rendered a full table of zeros whenever the comparison period had
 * data. Whether the empty state shows must depend only on the selected
 * period's own sets.
 */
import React from 'react';
import {render} from '@testing-library/react-native';
import {PaperProvider, Text} from 'react-native-paper';
import MetricsOverviewForWorkouts from '../../../app/components/analyse/MetricsOverviewForWorkouts';
import {Workout} from '../../../app/models/entities/Workout';

const EMPTY_STATE = <Text testID="the-empty-state">No sets in this period</Text>;

const workoutWithSets = (id: number) => ({id, exerciseId: 1, sets: [{reps: 5, weight: 100, rir: 1}]} as unknown as Workout);
const workoutWithNoSets = (id: number) => ({id, exerciseId: 1, sets: []} as unknown as Workout);

const renderOverview = (trainingsWorkouts: Workout[], previousWorkouts: Workout[]) =>
  render(
    <PaperProvider>
      <MetricsOverviewForWorkouts trainingsWorkouts={trainingsWorkouts} previousWorkouts={previousWorkouts} emptyState={EMPTY_STATE} />
    </PaperProvider>,
  );

describe('MetricsOverviewForWorkouts empty state (GH-458 round 2, review #1)', () => {
  it('shows the empty state when the selected period has no sets, even though the comparison period does', () => {
    const {getByTestId, queryByText} = renderOverview([workoutWithNoSets(1)], [workoutWithSets(2)]);

    expect(getByTestId('the-empty-state')).toBeTruthy();
    expect(queryByText('Muscle Overview')).toBeNull();
  });

  it('shows the empty state when the selected period has a workout with zero sets logged (not just zero workouts)', () => {
    const {getByTestId} = renderOverview([workoutWithNoSets(1)], []);

    expect(getByTestId('the-empty-state')).toBeTruthy();
  });

  it('shows the empty state when the selected period is empty and the comparison period is also empty', () => {
    const {getByTestId} = renderOverview([], []);

    expect(getByTestId('the-empty-state')).toBeTruthy();
  });

  it('renders the table, not the empty state, once the selected period has its own sets', () => {
    const {queryByTestId, getByText} = renderOverview([workoutWithSets(1)], []);

    expect(queryByTestId('the-empty-state')).toBeNull();
    expect(getByText('Muscle Overview')).toBeTruthy();
  });
});
