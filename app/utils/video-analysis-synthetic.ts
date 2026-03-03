import {BarTrackingResult} from '../models/entities/VideoAnalysis';

interface BuildSyntheticBarTrackingResultOptions {
  fps?: number;
  frameCount?: number;
  qualityFlags?: string[];
}

const roundValue = (value: number) => Math.round(value * 1000) / 1000;
const TARGET_REP_DURATION_MS = 3750;

const estimateRepCount = (frameCount: number, fps: number) => {
  const durationMs = (frameCount * 1000) / Math.max(1, fps);
  return Math.max(1, Math.min(12, Math.round(durationMs / TARGET_REP_DURATION_MS)));
};

const buildRepSegments = (frameCount: number, fps: number, repCount: number) => {
  if (frameCount < 2) {
    return [];
  }

  const boundedRepCount = Math.max(1, repCount);
  const frameToTimeMs = (frameIndex: number) => Math.round((frameIndex * 1000) / fps);

  return Array.from({length: boundedRepCount}, (_, repIndex) => {
    const startFrame = Math.round((repIndex * (frameCount - 1)) / boundedRepCount);
    const bottomFrame = Math.round(((repIndex + 0.5) * (frameCount - 1)) / boundedRepCount);
    const endFrame = Math.round(((repIndex + 1) * (frameCount - 1)) / boundedRepCount);

    return {
      repIndex: repIndex + 1,
      startMs: frameToTimeMs(startFrame),
      bottomMs: frameToTimeMs(Math.max(startFrame, Math.min(bottomFrame, endFrame))),
      endMs: frameToTimeMs(Math.max(endFrame, startFrame)),
    };
  });
};

const findNearestBarPoint = (barPathSeries: {tMs: number; x: number; y: number}[], targetMs: number) => {
  if (barPathSeries.length === 0) {
    return undefined;
  }

  let nearestPoint = barPathSeries[0];
  let nearestDelta = Math.abs(targetMs - nearestPoint.tMs);
  for (let index = 1; index < barPathSeries.length; index++) {
    const point = barPathSeries[index];
    const delta = Math.abs(targetMs - point.tMs);
    if (delta < nearestDelta) {
      nearestPoint = point;
      nearestDelta = delta;
    }
  }
  return nearestPoint;
};

const calculateLowestConcentricSpeedPxPerS = (
  barPathSeries: {tMs: number; x: number; y: number}[],
  bottomMs: number,
  endMs: number,
  fallbackSpeed: number,
) => {
  let lowestSpeed: number | undefined;

  for (let index = 1; index < barPathSeries.length; index++) {
    const previousPoint = barPathSeries[index - 1];
    const nextPoint = barPathSeries[index];
    if (previousPoint.tMs < bottomMs || nextPoint.tMs > endMs) {
      continue;
    }

    const deltaMs = nextPoint.tMs - previousPoint.tMs;
    if (deltaMs <= 0) {
      continue;
    }

    const upwardSpeedPxPerS = ((previousPoint.y - nextPoint.y) * 1000) / deltaMs;
    if (upwardSpeedPxPerS <= 0) {
      continue;
    }

    if (lowestSpeed === undefined || upwardSpeedPxPerS < lowestSpeed) {
      lowestSpeed = upwardSpeedPxPerS;
    }
  }

  return roundValue(lowestSpeed ?? fallbackSpeed);
};

const buildRepMetrics = (
  barPathSeries: {tMs: number; x: number; y: number}[],
  repSegments: {repIndex: number; startMs: number; bottomMs: number; endMs: number}[],
) => {
  return repSegments.map((repSegment) => {
    const bottomPoint = findNearestBarPoint(barPathSeries, repSegment.bottomMs);
    const endPoint = findNearestBarPoint(barPathSeries, repSegment.endMs);
    const concentricDurationMs = Math.max(1, repSegment.endMs - repSegment.bottomMs);
    const repTimeMs = Math.max(0, repSegment.endMs - repSegment.startMs);

    const verticalDisplacementPx =
      bottomPoint && endPoint ? Math.max(0, bottomPoint.y - endPoint.y) : 0;
    const averageConcentricSpeedPxPerS = roundValue((verticalDisplacementPx * 1000) / concentricDurationMs);
    const lowestConcentricSpeedPxPerS = calculateLowestConcentricSpeedPxPerS(
      barPathSeries,
      repSegment.bottomMs,
      repSegment.endMs,
      averageConcentricSpeedPxPerS,
    );

    return {
      repIndex: repSegment.repIndex,
      averageConcentricSpeedPxPerS,
      lowestConcentricSpeedPxPerS,
      repTimeMs,
    };
  });
};

export const buildSyntheticBarTrackingResult = (
  analysisId: number,
  options: BuildSyntheticBarTrackingResultOptions = {},
): BarTrackingResult => {
  const fps = options.fps ?? 30;
  const frameCount = options.frameCount ?? 180;
  const repCount = estimateRepCount(frameCount, fps);
  const qualityFlags = options.qualityFlags ?? [
    'ANALYSIS_JS_FALLBACK_SYNTHETIC_BAR_PATH',
    `REP_ESTIMATION_DURATION_BASED:${TARGET_REP_DURATION_MS}ms`,
  ];

  const barPathSeries = Array.from({length: frameCount}, (_, frameIndex) => {
    const progress = frameCount > 1 ? frameIndex / (frameCount - 1) : 0;
    const cycles = progress * Math.PI * repCount * 2;

    return {
      tMs: Math.round((frameIndex * 1000) / fps),
      x: roundValue(620 + Math.sin(cycles) * 28 + progress * 10),
      y: roundValue(420 + (1 - Math.cos(cycles)) * 95),
    };
  });

  const confidenceSeries = Array.from({length: frameCount}, (_, frameIndex) => {
    const progress = frameCount > 1 ? frameIndex / (frameCount - 1) : 0;
    const oscillation = (Math.cos(progress * Math.PI * 3) + 1) * 0.5;

    return {
      tMs: Math.round((frameIndex * 1000) / fps),
      score: roundValue(0.84 + oscillation * 0.12),
    };
  });

  const averageConfidence =
    roundValue(
      confidenceSeries.reduce((confidenceSum, confidencePoint) => confidenceSum + confidencePoint.score, 0) /
        confidenceSeries.length,
    );
  const repSegments = buildRepSegments(frameCount, fps, repCount);
  const repMetrics = buildRepMetrics(barPathSeries, repSegments);

  return {
    analysisId,
    units: 'px/s',
    barPathSeries,
    confidenceSeries,
    repSegments,
    repMetrics,
    analysisMeta: {
      sourceFps: fps,
      analyzedFps: fps,
      frameCount,
      averageConfidence,
    },
    qualityFlags,
  };
};
