import {BarPathPoint, RepMetric, RepSegment} from '../models/entities/VideoAnalysis';
import {calculateBarVerticalVelocitySeries, smoothBarPathSeries} from './video-analysis-signal';

interface MotionRun {
  direction: 1 | -1;
  startIndex: number;
  endIndex: number;
  sampleCount: number;
}

interface DetectedRepResult {
  repSegments: RepSegment[];
  repMetrics: RepMetric[];
}

const MIN_REP_INPUT_POINTS = 6;
const MIN_STRONG_VELOCITY_PX_PER_S = 24;
const STRONG_VELOCITY_THRESHOLD_RATIO = 0.18;
const MIN_REP_DISPLACEMENT_PX = 18;
const MIN_REP_DISPLACEMENT_RATIO = 0.12;
const MIN_RUN_SAMPLES = 2;
const MIN_REP_DURATION_MS = 500;
const MIN_CONCENTRIC_DURATION_MS = 200;

const EMPTY_RESULT: DetectedRepResult = {
  repSegments: [],
  repMetrics: [],
};

const roundTo3 = (value: number) => Math.round(value * 1000) / 1000;

const findExtremeIndex = (barPathSeries: BarPathPoint[], rawStartIndex: number, rawEndIndex: number, findMaximum: boolean) => {
  if (barPathSeries.length === 0) {
    return -1;
  }

  const startIndex = Math.max(0, Math.min(barPathSeries.length - 1, Math.min(rawStartIndex, rawEndIndex) - 1));
  const endIndex = Math.max(startIndex, Math.min(barPathSeries.length - 1, Math.max(rawStartIndex, rawEndIndex) + 1));
  let bestIndex = startIndex;

  for (let index = startIndex + 1; index <= endIndex; index += 1) {
    const candidateY = barPathSeries[index].y;
    const bestY = barPathSeries[bestIndex].y;

    if (findMaximum ? candidateY > bestY : candidateY < bestY) {
      bestIndex = index;
    }
  }

  return bestIndex;
};

const buildMotionRuns = (verticalVelocitySeries: number[], strongVelocityThreshold: number): MotionRun[] => {
  return verticalVelocitySeries.reduce<MotionRun[]>((runs, velocity, index) => {
    const direction = velocity >= strongVelocityThreshold ? 1 : velocity <= -strongVelocityThreshold ? -1 : 0;
    if (direction === 0) {
      return runs;
    }

    const previousRun = runs[runs.length - 1];
    if (previousRun && previousRun.direction === direction) {
      previousRun.endIndex = index;
      previousRun.sampleCount += 1;
      return runs;
    }

    runs.push({
      direction,
      startIndex: index,
      endIndex: index,
      sampleCount: 1,
    });
    return runs;
  }, []);
};

const findPreviousRun = (runs: MotionRun[], startIndexExclusive: number, direction: MotionRun['direction']) => {
  for (let runIndex = startIndexExclusive - 1; runIndex >= 0; runIndex -= 1) {
    const run = runs[runIndex];
    if (run.direction === direction && run.sampleCount >= MIN_RUN_SAMPLES) {
      return run;
    }
  }

  return undefined;
};

const findNextRun = (runs: MotionRun[], startIndexExclusive: number, direction: MotionRun['direction']) => {
  for (let runIndex = startIndexExclusive + 1; runIndex < runs.length; runIndex += 1) {
    const run = runs[runIndex];
    if (run.direction === direction && run.sampleCount >= MIN_RUN_SAMPLES) {
      return run;
    }
  }

  return undefined;
};

const calculateLowestConcentricSpeedPxPerS = (
  verticalVelocitySeries: number[],
  bottomIndex: number,
  endIndex: number,
  fallbackSpeed: number,
) => {
  let lowestPositiveVelocity: number | undefined;

  for (let index = bottomIndex; index <= endIndex && index < verticalVelocitySeries.length; index += 1) {
    const velocity = verticalVelocitySeries[index];
    if (velocity <= 0) {
      continue;
    }

    if (lowestPositiveVelocity === undefined || velocity < lowestPositiveVelocity) {
      lowestPositiveVelocity = velocity;
    }
  }

  return roundTo3(lowestPositiveVelocity ?? fallbackSpeed);
};

export const detectRepResultsFromBarPathSeries = (barPathSeries: BarPathPoint[]): DetectedRepResult => {
  if (barPathSeries.length < MIN_REP_INPUT_POINTS) {
    return EMPTY_RESULT;
  }

  const smoothedBarPathSeries = smoothBarPathSeries(barPathSeries);
  const verticalVelocitySeries = calculateBarVerticalVelocitySeries(smoothedBarPathSeries);
  const yValues = smoothedBarPathSeries.map((point) => point.y);
  const ySpan = Math.max(...yValues) - Math.min(...yValues);
  const maxAbsoluteVelocity = Math.max(...verticalVelocitySeries.map((value) => Math.abs(value)));

  if (ySpan < MIN_REP_DISPLACEMENT_PX || maxAbsoluteVelocity < MIN_STRONG_VELOCITY_PX_PER_S) {
    return EMPTY_RESULT;
  }

  const strongVelocityThreshold = Math.max(MIN_STRONG_VELOCITY_PX_PER_S, maxAbsoluteVelocity * STRONG_VELOCITY_THRESHOLD_RATIO);
  const minDisplacementPx = Math.max(MIN_REP_DISPLACEMENT_PX, ySpan * MIN_REP_DISPLACEMENT_RATIO);
  const motionRuns = buildMotionRuns(verticalVelocitySeries, strongVelocityThreshold);
  if (motionRuns.length < 2) {
    return EMPTY_RESULT;
  }

  const repSegments: RepSegment[] = [];
  const repMetrics: RepMetric[] = [];
  let lastRepEndIndex = -1;

  motionRuns.forEach((concentricRun, runIndex) => {
    if (concentricRun.direction !== 1 || concentricRun.sampleCount < MIN_RUN_SAMPLES) {
      return;
    }

    const eccentricRun = findPreviousRun(motionRuns, runIndex, -1);
    if (!eccentricRun) {
      return;
    }

    const priorPositiveRun = findPreviousRun(motionRuns, motionRuns.indexOf(eccentricRun), 1);
    const nextNegativeRun = findNextRun(motionRuns, runIndex, -1);
    const startSearchStartIndex = Math.max(0, lastRepEndIndex);
    const startSearchFromRun = priorPositiveRun ? Math.max(startSearchStartIndex, priorPositiveRun.endIndex) : startSearchStartIndex;
    const startIndex = findExtremeIndex(smoothedBarPathSeries, startSearchFromRun, eccentricRun.startIndex, false);
    const bottomIndex = findExtremeIndex(smoothedBarPathSeries, eccentricRun.endIndex, concentricRun.startIndex, true);
    const endSearchStart = Math.max(bottomIndex, concentricRun.endIndex);
    const endSearchEnd = nextNegativeRun ? nextNegativeRun.startIndex : smoothedBarPathSeries.length - 1;
    const endIndex = findExtremeIndex(smoothedBarPathSeries, endSearchStart, endSearchEnd, false);

    if (startIndex < 0 || bottomIndex < 0 || endIndex < 0) {
      return;
    }
    if (!(startIndex < bottomIndex && bottomIndex < endIndex)) {
      return;
    }
    if (startIndex < lastRepEndIndex) {
      return;
    }

    const startPoint = smoothedBarPathSeries[startIndex];
    const bottomPoint = smoothedBarPathSeries[bottomIndex];
    const endPoint = smoothedBarPathSeries[endIndex];
    const eccentricDisplacementPx = bottomPoint.y - startPoint.y;
    const concentricDisplacementPx = bottomPoint.y - endPoint.y;
    const repTimeMs = Math.max(0, endPoint.tMs - startPoint.tMs);
    const concentricDurationMs = Math.max(0, endPoint.tMs - bottomPoint.tMs);

    if (eccentricDisplacementPx < minDisplacementPx || concentricDisplacementPx < minDisplacementPx) {
      return;
    }
    if (repTimeMs < MIN_REP_DURATION_MS || concentricDurationMs < MIN_CONCENTRIC_DURATION_MS) {
      return;
    }

    const averageConcentricSpeedPxPerS = roundTo3((concentricDisplacementPx * 1000) / Math.max(1, concentricDurationMs));
    if (averageConcentricSpeedPxPerS <= 0) {
      return;
    }

    const repIndex = repSegments.length + 1;
    repSegments.push({
      repIndex,
      startMs: startPoint.tMs,
      bottomMs: bottomPoint.tMs,
      endMs: endPoint.tMs,
    });
    repMetrics.push({
      repIndex,
      averageConcentricSpeedPxPerS,
      lowestConcentricSpeedPxPerS: calculateLowestConcentricSpeedPxPerS(
        verticalVelocitySeries,
        bottomIndex,
        endIndex,
        averageConcentricSpeedPxPerS,
      ),
      repTimeMs,
    });
    lastRepEndIndex = endIndex;
  });

  return {
    repSegments,
    repMetrics,
  };
};
