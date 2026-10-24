import {countKpi, durationKpi, formatMicroDateRange, formatTimeRange, formatTrainingDate, setsKpi, volumeKpi} from '../../app/utils/overview-comparison';
import {buildCompareRows, formatMetricDiff, formatShare} from '../../app/utils/MuscleInvolvementUtils';
import {Muscles} from '../../app/models/Muscles';
import {TrainingsState} from '../../app/models/TrainingsState';

const workout = (n: number, reps = 5, weight = 100) => ({id: n, exerciseId: 1, sets: Array.from({length: n}, () => ({reps, weight}))}) as any;
const training = (start?: Date, end?: Date) => ({doneWorkoutIds: {}, plannedWorkouts: {}, exercises: [], state: TrainingsState.FINISHED, start, end}) as any;

describe('GH-526 overview-comparison', () => {
  it('formats the training date and time span', () => {
    expect(formatTrainingDate(new Date(2026, 9, 13, 18, 2))).toBe('Tue 13/10/2026');
    expect(formatTimeRange(new Date(2026, 9, 13, 18, 2), new Date(2026, 9, 13, 19, 25))).toBe('18:02 – 19:25');
    expect(formatTrainingDate(undefined)).toBeUndefined();
  });

  it('spans the micro from its first to its last dated training', () => {
    const range = formatMicroDateRange([training(new Date(2026, 9, 8, 18), new Date(2026, 9, 8, 19)), training(new Date(2026, 9, 6, 18), new Date(2026, 9, 6, 19)), training(new Date(2026, 9, 12, 9), new Date(2026, 9, 12, 10)), training()]);
    expect(range).toBe('06/10 – 12/10/2026');
    expect(formatMicroDateRange([training()])).toBeUndefined();
    expect(formatMicroDateRange([training(new Date(2025, 11, 30), new Date(2025, 11, 30)), training(new Date(2026, 0, 2), new Date(2026, 0, 2))])).toBe('30/12/2025 – 02/01/2026');
  });

  it('reads a KPI as value / reference with the delta and its percentage', () => {
    expect(setsKpi([workout(61)], [workout(57)])).toMatchObject({value: '61', reference: '57', delta: '+4 (+7%)', sign: 1});
    expect(volumeKpi([workout(10)], [workout(12)])).toMatchObject({value: '5.0t', reference: '6.0t', delta: '−1.0t (−17%)', sign: -1});
    expect(countKpi('trainings', 'Trainings', 4, 4)).toMatchObject({value: '4', reference: '4', delta: '±0 (±0%)', sign: 0});
  });

  it('reads a share KPI as the percentage of the reference', () => {
    expect(setsKpi([workout(12)], [workout(58)], 'share', 'Micro 2 plan')).toMatchObject({delta: '21% of Micro 2 plan', sign: 0});
  });

  it('shows own values only when there is no reference', () => {
    const kpi = setsKpi([workout(3)], undefined);
    expect(kpi.reference).toBeUndefined();
    expect(kpi.delta).toBeUndefined();
  });

  it('formats the duration delta in minutes', () => {
    expect(durationKpi(83 * 60000, 77 * 60000)).toMatchObject({value: '1h 23min', reference: '1h 17min', delta: '+6min', sign: 1});
  });
});

describe('GH-526 muscle map rows', () => {
  it('keeps a muscle only the reference carries — the biggest shortfall of all', () => {
    const rows = buildCompareRows(new Map([[Muscles.CHEST, 4]]), new Map([[Muscles.CHEST, 3], [Muscles.QUADS, 2]]));
    expect(rows.map((row) => [row.muscleGroupId, row.value, row.reference])).toEqual([
      [Muscles.CHEST, 4, 3],
      [Muscles.QUADS, 0, 2],
    ]);
  });

  it('lists only the subject\'s own muscles for a share', () => {
    const rows = buildCompareRows(new Map([[Muscles.CHEST, 4]]), new Map([[Muscles.CHEST, 8], [Muscles.QUADS, 2]]), {}, true);
    expect(rows.map((row) => row.muscleGroupId)).toEqual([Muscles.CHEST]);
  });

  it('formats only the delta for Diff and only the percentage for Share', () => {
    expect(formatMetricDiff(2, 'sets')).toBe('+2');
    expect(formatMetricDiff(-1.5, 'sets')).toBe('−1.5');
    expect(formatMetricDiff(0.01, 'sets')).toBe('±0');
    expect(formatMetricDiff(-2.84, 'volume')).toBe('−2.8t');
    expect(formatShare(3, 14)).toBe('21%');
    expect(formatShare(3, 0)).toBe('–');
  });
});
