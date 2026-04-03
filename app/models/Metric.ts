export enum Metric {
  VOLUME = 'Volume',
  ONE_RM = '1RM',
  SETS = 'Sets',
  REPS = 'Reps',
  MAX_INTENSITY = 'Max Intensity',
  AVERAGE_INTENSITY = 'Average Intensity',
}

export type MetricOverviewSection = 'muscles' | 'exercises';

export const ALL_METRICS = [Metric.VOLUME, Metric.ONE_RM, Metric.SETS, Metric.REPS, Metric.MAX_INTENSITY, Metric.AVERAGE_INTENSITY] satisfies Metric[];

export const DEFAULT_METRIC_OVERVIEW_SLOTS = {
  muscles: [Metric.VOLUME, Metric.SETS, Metric.REPS],
  exercises: [Metric.ONE_RM, Metric.REPS, Metric.MAX_INTENSITY],
} satisfies Record<MetricOverviewSection, Metric[]>;

export const resolveMetricOverviewSlots = (slots: Metric[] | undefined, section: MetricOverviewSection) => DEFAULT_METRIC_OVERVIEW_SLOTS[section].map((metric, index) => slots?.[index] ?? metric);
