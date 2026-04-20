import {filterTrainingsByDateRange} from '../../../app/utils/ai/filterTrainingsByDateRange';
import {Training} from '../../../app/models/entities/Training';
import {TrainingsState} from '../../../app/models/TrainingsState';

function makeTraining(endIso: string, state: TrainingsState = TrainingsState.FINISHED): Training {
  return {
    doneWorkoutIds: {},
    plannedWorkouts: {},
    exercises: [],
    state,
    end: new Date(endIso) as any,
    start: new Date(endIso) as any,
  };
}

describe('filterTrainingsByDateRange', () => {
  const t1 = makeTraining('2024-01-05T12:00:00.000Z'); // within range
  const t2 = makeTraining('2024-01-15T12:00:00.000Z'); // within range
  const t3 = makeTraining('2024-01-25T12:00:00.000Z'); // within range
  const t4 = makeTraining('2024-01-30T12:00:00.000Z'); // outside range (after)
  const t5 = makeTraining('2023-12-31T12:00:00.000Z'); // outside range (before)

  const start = new Date('2024-01-01T00:00:00.000Z');
  const end = new Date('2024-01-28T23:59:59.000Z');

  it('returns trainings within [startDate, endDate]', () => {
    const result = filterTrainingsByDateRange([t1, t2, t3, t4, t5], start, end);
    expect(result).toHaveLength(3);
    expect(result).toContain(t1);
    expect(result).toContain(t2);
    expect(result).toContain(t3);
  });

  it('excludes trainings outside the range', () => {
    const result = filterTrainingsByDateRange([t1, t2, t3, t4, t5], start, end);
    expect(result).not.toContain(t4);
    expect(result).not.toContain(t5);
  });

  it('returns empty array when no trainings match', () => {
    const future = new Date('2030-01-01T00:00:00.000Z');
    const futureEnd = new Date('2030-12-31T00:00:00.000Z');
    expect(filterTrainingsByDateRange([t1, t2], future, futureEnd)).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    expect(filterTrainingsByDateRange([], start, end)).toHaveLength(0);
  });

  it('excludes non-FINISHED trainings', () => {
    const started = makeTraining('2024-01-10T12:00:00.000Z', TrainingsState.STARTED);
    const planned = makeTraining('2024-01-10T12:00:00.000Z', TrainingsState.PLANNED);
    const result = filterTrainingsByDateRange([started, planned, t1], start, end);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(t1);
  });

  it('excludes trainings without an end date', () => {
    const noEnd: Training = {
      doneWorkoutIds: {},
      plannedWorkouts: {},
      exercises: [],
      state: TrainingsState.FINISHED,
    };
    const result = filterTrainingsByDateRange([noEnd, t1], start, end);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(t1);
  });

  it('includes training exactly on startDate boundary', () => {
    const onStart = makeTraining('2024-01-01T00:00:00.000Z');
    const result = filterTrainingsByDateRange([onStart], start, end);
    expect(result).toHaveLength(1);
  });

  it('includes training exactly on endDate boundary', () => {
    const onEnd = makeTraining('2024-01-28T23:59:59.000Z');
    const result = filterTrainingsByDateRange([onEnd], start, end);
    expect(result).toHaveLength(1);
  });

  it('re-serialization: filter returns different subsets for different ranges', () => {
    const all = [t1, t2, t3, t4, t5];
    const shortStart = new Date('2024-01-10T00:00:00.000Z');
    const shortEnd = new Date('2024-01-20T23:59:59.000Z');
    const shortResult = filterTrainingsByDateRange(all, shortStart, shortEnd);
    const longResult = filterTrainingsByDateRange(all, start, end);
    expect(shortResult.length).toBeLessThan(longResult.length);
    expect(shortResult).toContain(t2);
    expect(shortResult).not.toContain(t1);
  });

  it('default 28d range fallback: returns trainings in last 28 days', () => {
    const now = new Date();
    const recent = makeTraining(new Date(now.getTime() - 3 * 24 * 3600 * 1000).toISOString());
    const old = makeTraining(new Date(now.getTime() - 60 * 24 * 3600 * 1000).toISOString());
    const rangeStart = new Date(now.getTime() - 28 * 24 * 3600 * 1000);
    const result = filterTrainingsByDateRange([recent, old], rangeStart, now);
    expect(result).toContain(recent);
    expect(result).not.toContain(old);
  });
});
