import {Metric, MetricOverviewSection} from '../models/Metric';

/**
 * GH-458 (H7): the Metrics Overview showed `104.40` Sets, `1078.55` Reps and a
 * bare `90937.50` for Volume — derived numbers with no unit, while the Dashboard
 * reports the same quantity in tonnes (`0.0t`).
 *
 * Counts are whole things in the user's world, so they are rounded. Every value
 * carries its unit through the column header. Volume is reported in tonnes
 * everywhere in the Analyse area, matching the Dashboard.
 *
 * `Sets`, `Reps` and `Frequency` are split proportionally across the muscles an
 * exercise trains, so in the muscle table they are *weighted* counts, not raw
 * ones. That is what the `(wtd.)` marker says; per exercise the same metrics are
 * plain counts and carry no marker.
 */

const VOLUME_KILOGRAMS_PER_TONNE = 1000;

export const getMetricUnit = (metric: Metric, section: MetricOverviewSection): string => {
  switch (metric) {
    case Metric.VOLUME:
      return 't';
    case Metric.ONE_RM:
      return 'kg';
    case Metric.MAX_INTENSITY:
    case Metric.AVERAGE_INTENSITY:
      return '%';
    case Metric.SETS:
      return section === 'muscles' ? 'sets, wtd.' : 'sets';
    case Metric.REPS:
      return section === 'muscles' ? 'reps, wtd.' : 'reps';
    case Metric.FREQUENCY:
      return section === 'muscles' ? 'workouts, wtd.' : 'workouts';
  }
};

/** "Volume (t)" — the column header carries the unit for every value below it. */
export const getMetricHeaderLabel = (metric: Metric, section: MetricOverviewSection) => `${metric} (${getMetricUnit(metric, section)})`;

/** Formats a metric value in the unit its header announces. */
export const formatMetricValue = (metric: Metric, value: number): string => {
  if (!Number.isFinite(value)) {
    return '–';
  }

  switch (metric) {
    case Metric.VOLUME:
      return (value / VOLUME_KILOGRAMS_PER_TONNE).toFixed(1);
    case Metric.ONE_RM:
      return value.toFixed(1);
    case Metric.MAX_INTENSITY:
    case Metric.AVERAGE_INTENSITY:
      return value.toFixed(0);
    case Metric.SETS:
    case Metric.REPS:
    case Metric.FREQUENCY:
      // A count of 104.40 sets does not exist in the user's reality.
      return Math.round(value).toString();
  }
};

/** Same scale as the value, with an explicit sign so a gain reads as a gain. */
export const formatMetricDelta = (metric: Metric, difference: number): string => {
  const formatted = formatMetricValue(metric, Math.abs(difference));
  return `${difference >= 0 ? '+' : '−'}${formatted}`;
};

/** "vs. 01/09/25 to 30/11/25" — a delta is meaningless without its reference. */
export const describeComparisonPeriod = (comparisonRangeLabel: string) => `Δ vs. ${comparisonRangeLabel}`;
