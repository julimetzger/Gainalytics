import {Metric} from '../../app/models/Metric';
import {describeComparisonPeriod, formatMetricDelta, formatMetricValue, getMetricHeaderLabel, getMetricUnit} from '../../app/utils/metric-format';

/**
 * GH-458 (H7): the Metrics Overview reported `104.40` Sets and `1078.55` Reps
 * for Biceps — counts that do not exist in the user's reality — plus a bare
 * `90937.50` for Volume while the Dashboard reports the same quantity as `0.0t`.
 */
describe('metric formatting (GH-458 H7)', () => {
  describe('counts are whole numbers', () => {
    it.each([
      [Metric.SETS, 104.4, '104'],
      [Metric.SETS, 104.6, '105'],
      [Metric.REPS, 1078.55, '1079'],
      [Metric.FREQUENCY, 12.4, '12'],
    ])('rounds %s %s to %s', (metric, value, expected) => {
      expect(formatMetricValue(metric, value)).toBe(expected);
    });

    it('never renders a fractional set or rep', () => {
      [Metric.SETS, Metric.REPS, Metric.FREQUENCY].forEach((metric) => {
        expect(formatMetricValue(metric, 104.4)).not.toContain('.');
      });
    });
  });

  describe('volume is reported in tonnes everywhere', () => {
    it('converts kilograms to tonnes with one decimal', () => {
      expect(formatMetricValue(Metric.VOLUME, 90937.5)).toBe('90.9');
    });

    it('matches the Dashboard rendering for an empty period', () => {
      expect(formatMetricValue(Metric.VOLUME, 0)).toBe('0.0');
    });

    it('announces the tonne unit in the header', () => {
      expect(getMetricHeaderLabel(Metric.VOLUME, 'muscles')).toBe('Volume (t)');
    });
  });

  describe('every column carries a unit', () => {
    it.each([
      [Metric.VOLUME, 'Volume (t)'],
      [Metric.ONE_RM, '1RM (kg)'],
      [Metric.SETS, 'Sets (sets)'],
      [Metric.REPS, 'Reps (reps)'],
      [Metric.MAX_INTENSITY, 'Max Intensity (%)'],
      [Metric.AVERAGE_INTENSITY, 'Average Intensity (%)'],
      [Metric.FREQUENCY, 'Frequency (workouts)'],
    ])('labels the exercise column for %s as %s', (metric, expected) => {
      expect(getMetricHeaderLabel(metric, 'exercises')).toBe(expected);
    });

    it('marks the proportionally split muscle counts as weighted', () => {
      expect(getMetricUnit(Metric.SETS, 'muscles')).toBe('sets, wtd.');
      expect(getMetricUnit(Metric.REPS, 'muscles')).toBe('reps, wtd.');
      expect(getMetricUnit(Metric.FREQUENCY, 'muscles')).toBe('workouts, wtd.');
    });

    it('leaves the per-exercise counts unmarked, because they are exact', () => {
      expect(getMetricUnit(Metric.SETS, 'exercises')).toBe('sets');
      expect(getMetricUnit(Metric.REPS, 'exercises')).toBe('reps');
    });
  });

  describe('deltas use the same scale as the value they sit under', () => {
    it('renders a volume delta in tonnes, signed', () => {
      expect(formatMetricDelta(Metric.VOLUME, -176680.58)).toBe('−176.7');
      expect(formatMetricDelta(Metric.VOLUME, 176680.58)).toBe('+176.7');
    });

    it('renders a set delta as a whole number', () => {
      expect(formatMetricDelta(Metric.SETS, -12.4)).toBe('−12');
    });

    it('treats an unchanged value as a zero gain', () => {
      expect(formatMetricDelta(Metric.SETS, 0)).toBe('+0');
    });
  });

  it('names the period a delta compares against', () => {
    expect(describeComparisonPeriod('01/09/25 to 30/11/25')).toBe('Δ vs. 01/09/25 to 30/11/25');
  });

  it('degrades gracefully on a non-finite value instead of printing NaN', () => {
    expect(formatMetricValue(Metric.ONE_RM, NaN)).toBe('–');
    expect(formatMetricValue(Metric.VOLUME, Infinity)).toBe('–');
  });
});
