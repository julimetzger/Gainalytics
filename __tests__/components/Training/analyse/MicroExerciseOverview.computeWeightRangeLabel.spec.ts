import {computeWeightRangeLabel} from '../../../../app/components/Training/analyse/MicroExerciseOverview';

describe('computeWeightRangeLabel', () => {
  it('returns empty string for an empty set list', () => {
    expect(computeWeightRangeLabel([])).toBe('');
  });

  it('returns the single value for a single set', () => {
    expect(computeWeightRangeLabel([{weight: 80}])).toBe('80');
  });

  it('returns a single value when min === max across multiple sets', () => {
    expect(
      computeWeightRangeLabel([{weight: 100}, {weight: 100}, {weight: 100}]),
    ).toBe('100');
  });

  it('returns "min-max" range when weights differ', () => {
    expect(
      computeWeightRangeLabel([{weight: 80}, {weight: 100}, {weight: 90}]),
    ).toBe('80-100');
  });

  it('preserves fractional weights via formatPlanNumber', () => {
    expect(
      computeWeightRangeLabel([{weight: 32.5}, {weight: 40}]),
    ).toBe('32.5-40');
  });

  it('trims trailing zeros consistently for both bounds', () => {
    expect(
      computeWeightRangeLabel([{weight: 50.0}, {weight: 60.0}]),
    ).toBe('50-60');
  });
});
