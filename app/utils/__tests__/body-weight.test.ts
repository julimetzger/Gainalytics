import {computeBodyWeightStats, draftToBodyWeightEntry, entriesInRange, formatWeightChangeKg, formatWeightKg, parseBodyWeightKg, validateBodyWeightDraft} from '../body-weight';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 5, 15, 12).getTime();
const TODAY = new Date(2026, 5, 15).getTime();

describe('body weight input', () => {
  it('parses weights with comma or dot', () => {
    expect(parseBodyWeightKg('82,5')).toBe(82.5);
    expect(parseBodyWeightKg('82.5')).toBe(82.5);
    expect(parseBodyWeightKg(' 82 ')).toBe(82);
    expect(parseBodyWeightKg('82,5,1')).toBeUndefined();
    expect(parseBodyWeightKg('abc')).toBeUndefined();
    expect(parseBodyWeightKg('-5')).toBeUndefined();
    expect(parseBodyWeightKg('')).toBeUndefined();
  });

  it('accepts a plausible draft, also with a comma and later the same day', () => {
    expect(validateBodyWeightDraft({date: NOW, weight: '82.5', note: ''}, NOW)).toEqual({});
    expect(validateBodyWeightDraft({date: TODAY + DAY - 1, weight: '82,5', note: ''}, NOW)).toEqual({});
  });

  it('flags implausible values, future dates and long notes', () => {
    expect(validateBodyWeightDraft({date: TODAY + DAY, weight: '5', note: 'x'.repeat(201)}, NOW)).toEqual({
      date: 'The date cannot be in the future',
      weight: 'Weight must be between 20 and 500 kg',
      note: 'Note can have at most 200 characters',
    });
    expect(validateBodyWeightDraft({date: TODAY, weight: '', note: ''}, NOW)).toEqual({
      weight: 'Enter the weight in kg, e.g. 82.5',
    });
  });

  it('builds an entry at the start of the picked day and omits an empty note', () => {
    expect(draftToBodyWeightEntry({date: NOW, weight: '82,54', note: '  '})).toEqual({date: TODAY, weightKg: 82.5});
    expect(draftToBodyWeightEntry({date: TODAY, weight: '82', note: ' fasted '})).toEqual({date: TODAY, weightKg: 82, note: 'fasted'});
  });
});

describe('body weight analysis', () => {
  const entries = [
    {id: 3, date: TODAY, weightKg: 80.5},
    {id: 1, date: TODAY - 20 * DAY, weightKg: 82},
    {id: 2, date: TODAY - 10 * DAY, weightKg: 81},
  ];

  it('filters to the range and sorts ascending', () => {
    expect(entriesInRange(entries, TODAY - 12 * DAY, NOW).map((entry) => entry.id)).toEqual([2, 3]);
    expect(entriesInRange(entries, TODAY, NOW).map((entry) => entry.id)).toEqual([3]);
    expect(entriesInRange(entries, TODAY + DAY, NOW + 2 * DAY)).toEqual([]);
  });

  it('computes current weight and change over the period', () => {
    expect(computeBodyWeightStats(entriesInRange(entries, 0, NOW))).toEqual({currentKg: 80.5, changeKg: -1.5, minKg: 80.5, maxKg: 82});
  });

  it('has no change for a single entry and no stats for none', () => {
    expect(computeBodyWeightStats([entries[0]])).toEqual({currentKg: 80.5, changeKg: undefined, minKg: 80.5, maxKg: 80.5});
    expect(computeBodyWeightStats([])).toBeUndefined();
  });

  it('formats weights like logged set weights: no trailing zeros, always a dot', () => {
    expect(formatWeightKg(80)).toBe('80 kg');
    expect(formatWeightKg(82.5)).toBe('82.5 kg');
    expect(formatWeightKg(81.96)).toBe('82 kg');
    expect(formatWeightKg(80.04)).toBe('80 kg');
  });

  it('formats changes with a sign in the same style', () => {
    expect(formatWeightChangeKg(-1.5)).toBe('-1.5 kg');
    expect(formatWeightChangeKg(-2)).toBe('-2 kg');
    expect(formatWeightChangeKg(0.24)).toBe('+0.2 kg');
    expect(formatWeightChangeKg(0.01)).toBe('0 kg');
  });
});
