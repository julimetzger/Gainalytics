import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import {PaperProvider} from 'react-native-paper';
import MuscleHeatmap from '../../../../app/tabs/Analyse/dashboard/MuscleHeatmap';
import {
  buildMuscleWeekValues,
  calculateMuscleRadarStats,
  formatDelta,
  formatSets,
  niceMax,
} from '../../../../app/tabs/Analyse/dashboard/muscleRadarStats';
import {Muscles} from '../../../../app/models/Muscles';
import {Metric} from '../../../../app/models/Metric';
import {Comparison} from '../../../../app/components/analyse/MetricsOverviewForWorkouts';

type Week = {sets: number; lastSets?: number; volume: number; lastVolume?: number};

// Builds the DashboardTab `muscleMetricMap` shape: `difference` is undefined
// when there was no last week, like calculateMetricComparisonsForMuscle does.
const makeMap = (weeks: Partial<Record<Muscles, Week>>) =>
  new Map<Muscles, Map<Metric, Comparison>>(
    Object.entries(weeks).map(([muscle, week]) => [
      muscle as Muscles,
      new Map<Metric, Comparison>([
        [Metric.SETS, {value: week!.sets, difference: week!.lastSets === undefined ? undefined : week!.sets - week!.lastSets}],
        [Metric.VOLUME, {value: week!.volume, difference: week!.lastVolume === undefined ? undefined : week!.volume - week!.lastVolume}],
      ]),
    ]),
  );

// The mockup's week (GH-532 artboard A).
const DESIGN_WEEK = makeMap({
  [Muscles.BACK]: {sets: 14, lastSets: 16, volume: 6200, lastVolume: 7900},
  [Muscles.BICEPS]: {sets: 6, lastSets: 8, volume: 1100, lastVolume: 1600},
  [Muscles.CHEST]: {sets: 14, lastSets: 12, volume: 5400, lastVolume: 4900},
  [Muscles.CORE]: {sets: 4, lastSets: 6, volume: 5100, lastVolume: 15300},
  [Muscles.GLUTES]: {sets: 8, lastSets: 10, volume: 2400, lastVolume: 3500},
  [Muscles.HAMSTRINGS]: {sets: 5, lastSets: 8, volume: 1600, lastVolume: 2900},
  [Muscles.QUADS]: {sets: 10, lastSets: 12, volume: 4000, lastVolume: 6800},
  [Muscles.SHOULDERS]: {sets: 11, lastSets: 10, volume: 2600, lastVolume: 2300},
  [Muscles.TRICEPS]: {sets: 7, lastSets: 9, volume: 3100, lastVolume: 4100},
});

describe('muscle radar stats (GH-532)', () => {
  it('reads last week as value - difference and fills missing muscles with 0', () => {
    const values = buildMuscleWeekValues(makeMap({[Muscles.BACK]: {sets: 14, lastSets: 16, volume: 6200, lastVolume: 7900}}));

    expect(values.map((value) => value.muscle)).toEqual(Object.values(Muscles));
    expect(values[0]).toEqual({muscle: Muscles.BACK, sets: 14, lastSets: 16, volume: 6200, lastVolume: 7900});
    expect(values.find((value) => value.muscle === Muscles.CORE)).toEqual({muscle: Muscles.CORE, sets: 0, lastSets: 0, volume: 0, lastVolume: 0});
  });

  it('computes most trained, lagging and push : pull', () => {
    const stats = calculateMuscleRadarStats(buildMuscleWeekValues(DESIGN_WEEK));

    // Back and Chest tie at 14 — the first in axis order wins.
    expect(stats.mostTrained).toEqual({muscle: Muscles.BACK, sets: 14});
    expect(stats.lagging).toEqual({muscle: Muscles.CORE, sets: 4});
    // (14 + 11 + 7) : (14 + 6)
    expect(stats.pushPull).toEqual({push: 32, pull: 20, ratio: 1.6});
  });

  it('has no ratio without pull sets', () => {
    const stats = calculateMuscleRadarStats(buildMuscleWeekValues(makeMap({[Muscles.CHEST]: {sets: 3, volume: 900}})));

    expect(stats.pushPull).toEqual({push: 3, pull: 0, ratio: undefined});
    expect(stats.lagging?.sets).toBe(0);
  });

  it('returns no stats for an empty or all-zero week', () => {
    const empty = {mostTrained: undefined, lagging: undefined, pushPull: undefined};
    expect(calculateMuscleRadarStats(buildMuscleWeekValues(new Map()))).toEqual(empty);
    expect(calculateMuscleRadarStats(buildMuscleWeekValues(makeMap({[Muscles.BACK]: {sets: 0, lastSets: 12, volume: 0, lastVolume: 5000}})))).toEqual(empty);
  });

  it('rounds the scale up to a nice number', () => {
    expect(niceMax(16)).toBe(20);
    expect(niceMax(20)).toBe(20);
    expect(niceMax(7.9)).toBe(8);
    expect(niceMax(11.2)).toBe(15);
    expect(niceMax(15300)).toBe(20000);
    expect(niceMax(2.2)).toBe(2.5);
    expect(niceMax(0)).toBe(1);
  });

  it('formats sets and deltas', () => {
    expect(formatSets(14)).toBe('14');
    expect(formatSets(4.5)).toBe('4.5');
    expect(formatDelta(-2, Metric.SETS)).toBe('-2 sets');
    expect(formatDelta(2, Metric.SETS)).toBe('+2 sets');
    expect(formatDelta(0, Metric.SETS)).toBe('0 sets');
    expect(formatDelta(1, Metric.SETS)).toBe('+1 set');
    expect(formatDelta(-1700, Metric.VOLUME)).toBe('-1.7t');
  });
});

const renderCard = (map: Map<Muscles, Map<Metric, Comparison>>, onMusclePress = jest.fn()) =>
  render(
    <PaperProvider>
      <MuscleHeatmap muscleMetricMap={map} onMusclePress={onMusclePress} />
    </PaperProvider>,
  );

describe('MuscleHeatmap radar card (GH-532)', () => {
  it('labels every axis with the current sets and shows the stat tiles', () => {
    const {getByTestId, getByLabelText} = renderCard(DESIGN_WEEK);

    expect(getByLabelText('Back, 14 sets')).toBeTruthy();
    expect(getByLabelText('Core, 4 sets')).toBeTruthy();
    expect(getByTestId('muscle-radar-tile-most-trained-value')).toHaveTextContent('Back');
    expect(getByTestId('muscle-radar-tile-most-trained-detail')).toHaveTextContent('14 sets');
    expect(getByTestId('muscle-radar-tile-lagging-value')).toHaveTextContent('Core');
    expect(getByTestId('muscle-radar-tile-push-pull-value')).toHaveTextContent('1.6 : 1');
    expect(getByTestId('muscle-radar-tile-push-pull-detail')).toHaveTextContent('32 / 20 sets');
  });

  it('switches labels, chart and selection strip to volume', () => {
    const {getByTestId, getByLabelText} = renderCard(DESIGN_WEEK);

    fireEvent.press(getByTestId(`muscle-chip-${Muscles.BACK}`));
    expect(getByTestId('muscle-radar-selection-detail')).toHaveTextContent('14 sets · 6.2t · -2 sets vs last week');

    fireEvent.press(getByTestId('muscle-radar-metric-volume'));

    expect(getByLabelText('Back, 6.2t')).toBeTruthy();
    expect(getByTestId('muscle-radar-svg').props.accessibilityLabel).toContain('Radar chart of volume per muscle group');
    expect(getByTestId('muscle-radar-svg').props.accessibilityLabel).toContain('Core 5.1t (last week 15.3t)');
    expect(getByTestId('muscle-radar-selection-detail')).toHaveTextContent('14 sets · 6.2t · -1.7t vs last week');
  });

  it('calls onMusclePress only from the Details button', () => {
    const onMusclePress = jest.fn();
    const {getByTestId} = renderCard(DESIGN_WEEK, onMusclePress);

    fireEvent.press(getByTestId(`muscle-chip-${Muscles.CHEST}`));
    expect(onMusclePress).not.toHaveBeenCalled();
    expect(getByTestId('muscle-radar-selection-detail')).toHaveTextContent('+2 sets vs last week');

    fireEvent.press(getByTestId('muscle-radar-details-button'));
    expect(onMusclePress).toHaveBeenCalledWith(Muscles.CHEST);
  });

  it('renders an empty week with dashes and the last-week values', () => {
    const {getByTestId, getByLabelText} = renderCard(makeMap({[Muscles.BACK]: {sets: 0, lastSets: 12, volume: 0, lastVolume: 5000}}));

    expect(getByLabelText('Back, 0 sets')).toBeTruthy();
    expect(getByTestId('muscle-radar-svg').props.accessibilityLabel).toContain('Back 0 (last week 12)');
    expect(getByTestId('muscle-radar-tile-most-trained-value')).toHaveTextContent('–');
    expect(getByTestId('muscle-radar-tile-lagging-value')).toHaveTextContent('–');
    expect(getByTestId('muscle-radar-tile-push-pull-value')).toHaveTextContent('–');
  });

  it('does not crash on an empty map', () => {
    const {getByTestId} = renderCard(new Map());
    expect(getByTestId('muscle-heatmap-card')).toBeTruthy();
  });
});

describe('MuscleHeatmap with the user muscle list (GH-523)', () => {
  const {useSelector} = jest.requireMock('react-redux') as {useSelector: jest.Mock};
  const withMuscleSettings = (muscles: object) =>
    useSelector.mockImplementation((selector: (state: object) => unknown) => selector({settings: {muscles}}));

  afterEach(() => useSelector.mockImplementation(() => []));

  it('draws one axis per overview muscle: hidden and removed muscles leave, added ones join', () => {
    withMuscleSettings({custom: ['Calves'], removed: ['Core'], hiddenInOverviews: ['Biceps']});
    const map = new Map(DESIGN_WEEK);
    map.set('Calves', new Map<Metric, Comparison>([[Metric.SETS, {value: 3}], [Metric.VOLUME, {value: 900}]]));

    const {getAllByTestId} = renderCard(map);

    expect(getAllByTestId(/^muscle-chip-/).map((chip) => chip.props.accessibilityLabel)).toEqual([
      'Back, 14 sets',
      'Chest, 14 sets',
      'Glutes, 8 sets',
      'Hamstrings, 5 sets',
      'Quads, 10 sets',
      'Shoulders, 11 sets',
      'Triceps, 7 sets',
      'Calves, 3 sets',
    ]);
  });

  it('asks for more muscles instead of drawing a radar with fewer than three axes', () => {
    withMuscleSettings({hiddenInOverviews: ['Biceps', 'Chest', 'Core', 'Glutes', 'Hamstrings', 'Quads', 'Shoulders']});

    const {getByTestId, queryByTestId} = renderCard(DESIGN_WEEK);

    expect(queryByTestId('muscle-radar-chart')).toBeNull();
    expect(getByTestId('muscle-radar-too-few').props.children).toBe('The radar needs at least 3 muscles. Choose them in Settings → Muscles.');
  });
});
