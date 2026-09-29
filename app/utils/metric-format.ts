import {Metric, MetricOverviewSection} from '../models/Metric';

/**
 * GH-458 (H7): the Metrics Overview showed `104.40` Sets, `1078.55` Reps and a
 * bare `90937.50` for Volume — derived numbers with no unit, while the Dashboard
 * reports the same quantity in tonnes (`0.0t`).
 *
 * Column headers stay short: Sets, Reps and Frequency are self-explanatory and
 * carry no unit; Volume is `(t)`, intensity `(%1RM)`, 1RM `(kg)`. Volume is
 * reported in tonnes everywhere in the Analyse area, matching the Dashboard.
 *
 * `Sets`, `Reps` and `Frequency` are split proportionally across the muscles an
 * exercise trains, so in the muscle table they are *weighted* and legitimately
 * fractional — rounding them would turn two half sets into two whole ones and
 * make small shares vanish. Only the per-exercise counts, which are real counts,
 * are whole numbers.
 */

const VOLUME_KILOGRAMS_PER_TONNE = 1000;

export const getMetricUnit = (metric: Metric): string | undefined => {
  switch (metric) {
    case Metric.VOLUME:
      return 't';
    case Metric.ONE_RM:
      return 'kg';
    case Metric.MAX_INTENSITY:
    case Metric.AVERAGE_INTENSITY:
      return '%1RM';
    case Metric.SETS:
    case Metric.REPS:
    case Metric.FREQUENCY:
      return undefined;
  }
};

/** "Volume (t)" — the column header carries the unit; counts have none. */
export const getMetricHeaderLabel = (metric: Metric, section: MetricOverviewSection) => {
  const unit = getMetricUnit(metric);
  return unit ? `${metric} (${unit})` : metric;
};

/** Formats a metric value in the unit its header announces. */
export const formatMetricValue = (metric: Metric, value: number, section: MetricOverviewSection = 'exercises'): string => {
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
      // Per exercise these are real counts. Per muscle they are weighted shares
      // and keep their decimals (two half sets are 1.00, not 2 x "1").
      return section === 'muscles' ? value.toFixed(2) : Math.round(value).toString();
  }
};

/** Same scale as the value, with an explicit sign so a gain reads as a gain. */
export const formatMetricDelta = (metric: Metric, difference: number, section: MetricOverviewSection = 'exercises'): string => {
  const formatted = formatMetricValue(metric, Math.abs(difference), section);
  return `${difference >= 0 ? '+' : '−'}${formatted}`;
};

/** "vs. 01/09/25 to 30/11/25" — a delta is meaningless without its reference. */
export const describeComparisonPeriod = (comparisonRangeLabel: string) => `Δ vs. ${comparisonRangeLabel}`;
