export type MetricKey = 'volume' | 'sets' | 'time';

// MPAndroidChart takes valueTextSize in dp; an average digit/letter of the default
// font is ~0.6 of the text size wide. Used to decide whether a label fits its bar slot.
export const BAR_VALUE_TEXT_SIZE = 10;
const CHAR_WIDTH_DP = BAR_VALUE_TEXT_SIZE * 0.6;

// Headroom above the highest bar for its value label. MPAndroidChart 3.1 derives
// `spaceTop` from the data's min-max spread, so a single bar (or equal bars) got
// none and its label sat on the chart's top edge (GH-482).
const HEADROOM_FACTOR = 1.3;

export const formatBarValue = (metric: MetricKey, val: number): string => {
  if (metric === 'volume') return val.toLocaleString();
  if (metric === 'sets') return `${val}`;
  const h = Math.floor(val / 60);
  const m = val % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const formatCompactBarValue = (metric: MetricKey, val: number): string => {
  if (metric === 'volume' && val >= 1000) return `${Math.round(val / 1000)}k`;
  if (metric === 'time' && val >= 60) return `${Math.round(val / 60)}h`;
  return formatBarValue(metric, val);
};

const fits = (labels: string[], slotWidthDp: number): boolean => labels.every(l => l.length * CHAR_WIDTH_DP <= slotWidthDp * 0.9);

/**
 * Labels drawn above the bars. The full value is used when it fits the bar's slot,
 * otherwise a compact form (128k, 49h); if even that would collide with the
 * neighbouring labels only the current (last) micro keeps its value.
 */
export const barValueLabels = (metric: MetricKey, values: number[], chartWidthDp: number): string[] => {
  const slotWidthDp = values.length > 0 ? chartWidthDp / values.length : chartWidthDp;
  const full = values.map(v => formatBarValue(metric, v));
  if (fits(full, slotWidthDp)) return full;
  const compact = values.map(v => formatCompactBarValue(metric, v));
  if (fits(compact, slotWidthDp)) return compact;
  return compact.map((l, i) => (i === compact.length - 1 ? l : ''));
};

export const barAxisMaximum = (values: number[]): number => Math.max(...values, 1) * HEADROOM_FACTOR;
