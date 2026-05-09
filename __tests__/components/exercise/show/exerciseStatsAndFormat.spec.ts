import {Record} from '../../../../app/models/entities/Exercise';
import {oneRmIncreaseDelta, previousBestOneRm, toFiniteNumber} from '../../../../app/components/exercise/show/exerciseStats';
import {formatTimeAgo} from '../../../../app/components/exercise/show/formatTimeAgo';

describe('toFiniteNumber', () => {
  it('coerces numeric strings stored by legacy reducers', () => {
    expect(toFiniteNumber('120.5')).toBeCloseTo(120.5);
  });
  it('rejects null / NaN / undefined', () => {
    expect(toFiniteNumber(null)).toBeUndefined();
    expect(toFiniteNumber(undefined)).toBeUndefined();
    expect(toFiniteNumber('abc')).toBeUndefined();
    expect(toFiniteNumber(NaN)).toBeUndefined();
  });
});

describe('previousBestOneRm + oneRmIncreaseDelta', () => {
  it('returns undefined when the exercise has fewer than two records', () => {
    const ex = {id: 1, name: 'X', records: {[Record.ONE_RM]: [{value: 100, workoutId: 1}]}};
    expect(previousBestOneRm(ex)).toBeUndefined();
    expect(oneRmIncreaseDelta(ex)).toBeUndefined();
  });
  it('computes a positive delta when the latest record is a new PR', () => {
    const ex = {
      id: 1,
      name: 'X',
      records: {
        [Record.ONE_RM]: [
          {value: 100, workoutId: 1},
          {value: 110, workoutId: 2},
          {value: 120, workoutId: 3},
        ],
      },
    };
    expect(previousBestOneRm(ex)).toBe(110);
    expect(oneRmIncreaseDelta(ex)).toBe(10);
  });
  it('computes a negative delta when the latest record falls below the prior best', () => {
    const ex = {
      id: 1,
      name: 'X',
      records: {
        [Record.ONE_RM]: [
          {value: 100, workoutId: 1},
          {value: 130, workoutId: 2},
          {value: 120, workoutId: 3},
        ],
      },
    };
    expect(oneRmIncreaseDelta(ex)).toBe(-10);
  });
});

describe('formatTimeAgo', () => {
  const now = new Date('2026-05-08T12:00:00Z').getTime();
  it('returns "today" for the same day', () => {
    expect(formatTimeAgo(new Date('2026-05-08T08:00:00Z'), now)).toBe('today');
  });
  it('returns "yesterday" 1d back', () => {
    expect(formatTimeAgo(new Date('2026-05-07T08:00:00Z'), now)).toBe('yesterday');
  });
  it('returns days when within a month', () => {
    expect(formatTimeAgo(new Date('2026-05-01T08:00:00Z'), now)).toBe('7d ago');
  });
  it('returns months for older entries', () => {
    expect(formatTimeAgo(new Date('2026-02-01T08:00:00Z'), now)).toMatch(/mo ago/);
  });
  it('uses calendar-day boundaries — 23:30 yesterday viewed at 08:00 today is "yesterday"', () => {
    // Use local-time constructors so the day boundary aligns with the runner's TZ.
    const yesterdayLate = new Date(2026, 4, 7, 23, 30).getTime();
    const todayMorning = new Date(2026, 4, 8, 8, 0).getTime();
    // Raw-ms diff is only ~8.5 hours (less than 24h), so the old impl would say
    // "today". Calendar-day diffing must say "yesterday".
    expect(formatTimeAgo(new Date(yesterdayLate), todayMorning)).toBe('yesterday');
  });
  it('returns "today" for a workout earlier the same calendar day', () => {
    const earlierToday = new Date(2026, 4, 8, 0, 30).getTime();
    const laterToday = new Date(2026, 4, 8, 23, 30).getTime();
    expect(formatTimeAgo(new Date(earlierToday), laterToday)).toBe('today');
  });
  it('handles undefined date gracefully', () => {
    expect(formatTimeAgo(undefined, now)).toBe('—');
  });
});
