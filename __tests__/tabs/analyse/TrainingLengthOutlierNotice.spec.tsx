import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import {PaperProvider} from 'react-native-paper';
import TrainingLengthTab from '../../../app/tabs/Analyse/TrainingLengthTab';
import {useCompletedTrainingsIn} from '../../../app/redux/Training/use/useCompletedTrainingsIn';
import {useLastCompletedTrainingDate} from '../../../app/redux/Training/use/useLastCompletedTrainingDate';
import {useLastWorkoutDate} from '../../../app/redux/Workout/use/useLastWorkoutDate';
import {useAllTrainingsPlans} from '../../../app/redux/Training/use/useAllTrainingsPlans';
import {Training} from '../../../app/models/entities/Training';
import {TrainingsState} from '../../../app/models/TrainingsState';

jest.mock('../../../app/redux/Training/use/useCompletedTrainingsIn', () => ({useCompletedTrainingsIn: jest.fn()}));
jest.mock('../../../app/redux/Training/use/useLastCompletedTrainingDate', () => ({useLastCompletedTrainingDate: jest.fn(() => undefined)}));
jest.mock('../../../app/redux/Training/use/useAllTrainingsPlans', () => ({useAllTrainingsPlans: jest.fn()}));
jest.mock('../../../app/redux/Workout/use/useLastWorkoutDate', () => ({
  useLastWorkoutDate: jest.fn(() => undefined),
  useLastWorkoutDateForExercises: jest.fn(() => undefined),
}));

jest.mock('../../../app/components/analyse/TrainingLengthEditDialog', () => {
  const ReactLocal = require('react');
  const {Text} = require('react-native');
  return ({bucket}: {bucket: {key: string} | null}) => (bucket ? <Text testID="training-length-edit-dialog-marker">{bucket.key}</Text> : null);
});

jest.mock('../../../app/components/picker/date/DateRangePicker', () => {
  const ReactLocal = require('react');
  const {Text} = require('react-native');

  class Range {
    startDate: Date;
    endDate: Date;
    constructor(startDate: Date, endDate: Date) {
      this.startDate = new Date(startDate);
      this.endDate = new Date(endDate);
    }
  }

  return {__esModule: true, default: () => <Text>Mocked Range Picker</Text>, Range};
});

jest.mock('react-native-charts-wrapper', () => {
  const ReactLocal = require('react');
  const {Text, View} = require('react-native');

  return {
    BarChart: ({data}: {data: {dataSets?: Array<{values?: Array<{x: number; y: number}>}>}}) => {
      const values = data.dataSets?.[0]?.values ?? [];
      return (
        <View>
          <Text testID="mock-bar-chart-count">{`Bars: ${values.length}`}</Text>
          <Text testID="mock-bar-chart-max">{`Max: ${values.length > 0 ? Math.max(...values.map((value) => value.y)) : 0}`}</Text>
        </View>
      );
    },
  };
});

const makeTraining = (id: number, start: Date, end: Date): Training =>
  ({id, state: TrainingsState.FINISHED, start, end, workouts: []} as unknown as Training);

const NORMAL = [
  makeTraining(1, new Date(2026, 0, 5, 18, 0), new Date(2026, 0, 5, 19, 0)),
  makeTraining(2, new Date(2026, 0, 7, 18, 0), new Date(2026, 0, 7, 19, 30)),
];
const OUTLIER = makeTraining(4, new Date(2026, 0, 12, 22, 0), new Date(2026, 0, 14, 18, 27)); // 44 h 27 min

const renderTab = (trainings: Training[]) => {
  (useCompletedTrainingsIn as jest.Mock).mockReturnValue(trainings);
  (useAllTrainingsPlans as jest.Mock).mockReturnValue([]);

  return render(
    <PaperProvider>
      <TrainingLengthTab />
    </PaperProvider>,
  );
};

/**
 * GH-458 (H6): the only question this screen exists to answer — "how long do I
 * train?" — was unreadable because one unfinished 44 h session owned the scale.
 * Correcting it required a long press on its bar with no affordance at all.
 */
describe('Training Length outlier handling (GH-458 H6)', () => {
  it('leaves the implausible session out of the scaling by default', () => {
    const {getByTestId} = renderTab([...NORMAL, OUTLIER]);

    expect(getByTestId('mock-bar-chart-count').props.children).toBe('Bars: 2');
    expect(getByTestId('mock-bar-chart-max').props.children).toBe('Max: 90');
  });

  it('states how many sessions are hidden and why', () => {
    const {getByTestId} = renderTab([...NORMAL, OUTLIER]);

    expect(getByTestId('training-length-outlier-count').props.children).toBe('1 training over 4 h hidden');
    expect(getByTestId('training-length-outlier-explanation')).toBeTruthy();
  });

  it('brings the session back into the chart on request, and hides it again', () => {
    const {getByTestId} = renderTab([...NORMAL, OUTLIER]);

    fireEvent.press(getByTestId('training-length-outlier-toggle'));
    expect(getByTestId('mock-bar-chart-count').props.children).toBe('Bars: 3');
    expect(getByTestId('mock-bar-chart-max').props.children).toBe('Max: 2667');
    expect(getByTestId('training-length-outlier-count').props.children).toBe('1 training over 4 h included');

    fireEvent.press(getByTestId('training-length-outlier-toggle'));
    expect(getByTestId('mock-bar-chart-count').props.children).toBe('Bars: 2');
  });

  /**
   * The audit's core complaint was the hidden long press. A visible button has
   * to reach the same editor.
   */
  it('opens the editor for the outlier from a visible control', () => {
    const {getByTestId, queryByTestId} = renderTab([...NORMAL, OUTLIER]);

    expect(queryByTestId('training-length-edit-dialog-marker')).toBeNull();

    fireEvent.press(getByTestId('training-length-outlier-correct-4'));

    expect(getByTestId('training-length-edit-dialog-marker')).toBeTruthy();
  });

  it('names the outlier on its button so the user knows which session it means', () => {
    // Paper's Button puts the testID on the touchable and the label on a child
    // Text node exposed as `${testID}-text`.
    const {getByTestId} = renderTab([...NORMAL, OUTLIER]);

    expect(getByTestId('training-length-outlier-correct-4-text').props.children).toBe('Correct 12 Jan 2026 (44 h 27 min)');
  });

  it('shows no notice at all when every session is plausible', () => {
    const {queryByTestId} = renderTab(NORMAL);

    expect(queryByTestId('training-length-outlier-notice')).toBeNull();
  });
});

/**
 * GH-458 round 3 (review #5): a range whose only trainings are hidden outliers
 * used to read "No completed trainings in this range" — untrue, and it hid the
 * way to see them.
 */
describe('Training Length with only hidden outliers (GH-458 round 3)', () => {
  it('says only outliers exist instead of "No completed trainings"', () => {
    const {getByTestId, queryByTestId} = renderTab([OUTLIER]);

    expect(getByTestId('training-length-only-outliers-state')).toBeTruthy();
    expect(queryByTestId('training-length-empty-state')).toBeNull();
  });

  it('offers to show them, which puts the bar back on the chart', () => {
    const {getByTestId, queryByTestId} = renderTab([OUTLIER]);

    fireEvent.press(getByTestId('training-length-only-outliers-show'));

    expect(queryByTestId('training-length-only-outliers-state')).toBeNull();
    expect(getByTestId('mock-bar-chart-count').props.children).toBe('Bars: 1');
  });

  it('keeps the plain empty state for a range with no trainings at all', () => {
    const {getByTestId, queryByTestId} = renderTab([]);

    expect(getByTestId('training-length-empty-state')).toBeTruthy();
    expect(queryByTestId('training-length-only-outliers-state')).toBeNull();
  });
});

/**
 * GH-458 round 3 (review): the screen charts finished trainings, so its stale
 * banner must name the newest finished training — not the newest workout, which
 * can be a later, unfinished session the chart never shows.
 */
describe('Training Length stale banner source (GH-458 round 3)', () => {
  afterEach(() => {
    (useLastCompletedTrainingDate as jest.Mock).mockReturnValue(undefined);
    (useLastWorkoutDate as jest.Mock).mockReturnValue(undefined);
  });

  it('points at the last finished training, not the last workout', () => {
    (useLastCompletedTrainingDate as jest.Mock).mockReturnValue(new Date(2026, 1, 27, 21, 0));
    (useLastWorkoutDate as jest.Mock).mockReturnValue(new Date(2026, 2, 20, 17, 0));

    const {getByTestId} = renderTab([]);

    expect(getByTestId('training-length-stale-range-banner-text').props.children).toContain('27/02/26');
  });

  it('stays hidden when there is no finished training at all', () => {
    (useLastWorkoutDate as jest.Mock).mockReturnValue(new Date(2026, 2, 20, 17, 0));

    const {queryByTestId} = renderTab([]);

    expect(queryByTestId('training-length-stale-range-banner')).toBeNull();
  });
});

