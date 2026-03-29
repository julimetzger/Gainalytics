import {BarPathPoint} from '../models/entities/VideoAnalysis';

export const DEFAULT_BAR_PATH_SMOOTHING_WINDOW = 5;
export const DEFAULT_VELOCITY_SMOOTHING_WINDOW = 5;

export const smoothNumberSeries = (values: number[], windowSize: number): number[] => {
  if (values.length === 0 || windowSize <= 1) {
    return values;
  }

  const halfWindow = Math.floor(windowSize / 2);
  return values.map((_, index) => {
    const start = Math.max(0, index - halfWindow);
    const end = Math.min(values.length - 1, index + halfWindow);
    let sum = 0;
    let count = 0;

    for (let cursor = start; cursor <= end; cursor += 1) {
      sum += values[cursor];
      count += 1;
    }

    return count > 0 ? sum / count : 0;
  });
};

export const smoothBarPathSeries = (
  barPathSeries: BarPathPoint[],
  windowSize = DEFAULT_BAR_PATH_SMOOTHING_WINDOW,
): BarPathPoint[] => {
  if (barPathSeries.length < 3 || windowSize <= 1) {
    return barPathSeries;
  }

  const smoothedX = smoothNumberSeries(
    barPathSeries.map((point) => point.x),
    windowSize,
  );
  const smoothedY = smoothNumberSeries(
    barPathSeries.map((point) => point.y),
    windowSize,
  );

  return barPathSeries.map((point, index) => ({
    ...point,
    x: smoothedX[index],
    y: smoothedY[index],
  }));
};

export const calculateBarVerticalVelocitySeries = (
  barPathSeries: BarPathPoint[],
  smoothingWindow = DEFAULT_VELOCITY_SMOOTHING_WINDOW,
): number[] => {
  if (barPathSeries.length === 0) {
    return [];
  }

  const rawVerticalVelocities = barPathSeries.map((_, index) => {
    const previous = barPathSeries[Math.max(0, index - 1)];
    const next = barPathSeries[Math.min(barPathSeries.length - 1, index + 1)];
    const deltaTimeMs = Math.max(1, next.tMs - previous.tMs);
    const deltaTimeSeconds = deltaTimeMs / 1000;

    // Screen-space y increases downward; expose physics-friendly sign:
    // downward movement => negative v_y, upward movement => positive v_y.
    return (previous.y - next.y) / deltaTimeSeconds;
  });

  return smoothNumberSeries(rawVerticalVelocities, smoothingWindow);
};
