package com.powerliftingworkoutplanner;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

final class VideoAnalysisRepDetection {
    static final String REP_DETECTION_VERSION = "velocity-zero-crossing-v2";

    private static final int MIN_TRACKING_POINTS = 6;
    private static final int SMOOTHING_WINDOW = 5;
    private static final int MIN_CROSSING_GAP_MS = 350;
    private static final int MIN_PHASE_DURATION_MS = 500;
    private static final int MIN_REP_DURATION_MS = 2000;
    private static final double MIN_ZERO_CROSSING_SPEED_PX_PER_S = 12.0;
    private static final double ZERO_CROSSING_SPEED_RATIO = 0.08;
    private static final double MIN_CONCENTRIC_DISPLACEMENT_PX = 12.0;
    private static final double MIN_CONCENTRIC_DISPLACEMENT_RATIO = 0.12;

    private VideoAnalysisRepDetection() {
    }

    static JSONArray detectRepSegments(JSONArray barPathSeries, JSONArray repMetricsOut) throws Exception {
        JSONArray repSegments = new JSONArray();
        int sampleCount = barPathSeries.length();
        if (sampleCount < MIN_TRACKING_POINTS) {
            return repSegments;
        }

        int[] timeMs = new int[sampleCount];
        double[] yPositions = new double[sampleCount];
        for (int index = 0; index < sampleCount; index++) {
            JSONObject point = barPathSeries.getJSONObject(index);
            timeMs[index] = point.getInt("tMs");
            yPositions[index] = point.getDouble("y");
        }

        RepDetectionResult detectedReps = detectRepData(timeMs, yPositions);
        for (RepSegmentData segment : detectedReps.repSegments) {
            repSegments.put(
                new JSONObject()
                    .put("repIndex", segment.repIndex)
                    .put("startMs", segment.startMs)
                    .put("bottomMs", segment.bottomMs)
                    .put("endMs", segment.endMs)
            );
        }
        for (RepMetricData metric : detectedReps.repMetrics) {
            repMetricsOut.put(
                new JSONObject()
                    .put("repIndex", metric.repIndex)
                    .put("repTimeMs", metric.repTimeMs)
                    .put("averageConcentricSpeedPxPerS", roundTo3(metric.averageConcentricSpeedPxPerS))
                    .put("lowestConcentricSpeedPxPerS", roundTo3(metric.lowestConcentricSpeedPxPerS))
            );
        }

        return repSegments;
    }

    static RepDetectionResult detectRepData(int[] timeMs, double[] yPositions) {
        RepDetectionResult result = new RepDetectionResult();
        int sampleCount = Math.min(timeMs.length, yPositions.length);
        if (sampleCount < MIN_TRACKING_POINTS) {
            return result;
        }

        double minY = Double.POSITIVE_INFINITY;
        double maxY = Double.NEGATIVE_INFINITY;
        for (int index = 0; index < sampleCount; index++) {
            minY = Math.min(minY, yPositions[index]);
            maxY = Math.max(maxY, yPositions[index]);
        }

        double[] rawVelocity = new double[sampleCount];
        for (int index = 1; index < sampleCount - 1; index++) {
            double deltaTimeSeconds = Math.max(1, timeMs[index + 1] - timeMs[index - 1]) / 1000.0;
            rawVelocity[index] = (yPositions[index + 1] - yPositions[index - 1]) / deltaTimeSeconds;
        }

        double[] velocity = smoothDoubleArray(rawVelocity, SMOOTHING_WINDOW);
        double maxAbsoluteVelocity = 0.0;
        for (double sampleVelocity : velocity) {
            maxAbsoluteVelocity = Math.max(maxAbsoluteVelocity, Math.abs(sampleVelocity));
        }
        if (maxAbsoluteVelocity < MIN_ZERO_CROSSING_SPEED_PX_PER_S) {
            return result;
        }

        double zeroCrossingThreshold = Math.max(
            MIN_ZERO_CROSSING_SPEED_PX_PER_S,
            maxAbsoluteVelocity * ZERO_CROSSING_SPEED_RATIO
        );
        double minimumConcentricDisplacement = Math.max(
            MIN_CONCENTRIC_DISPLACEMENT_PX,
            (maxY - minY) * MIN_CONCENTRIC_DISPLACEMENT_RATIO
        );

        List<Crossing> crossings = collectCrossings(timeMs, velocity, zeroCrossingThreshold);
        if (crossings.isEmpty()) {
            return result;
        }

        int initialDirection = 0;
        for (double sampleVelocity : velocity) {
            int direction = toDirection(sampleVelocity, zeroCrossingThreshold);
            if (direction != 0) {
                initialDirection = direction;
                break;
            }
        }

        int startIndex = initialDirection > 0 ? 0 : -1;
        int bottomIndex = -1;
        int repIndex = 0;

        for (Crossing crossing : crossings) {
            if (crossing.type == CrossingType.BOTTOM) {
                if (startIndex < 0) {
                    continue;
                }
                int snappedBottomIndex = findMaximumIndex(yPositions, startIndex, crossing.index);
                if (bottomIndex < 0 || yPositions[snappedBottomIndex] >= yPositions[bottomIndex]) {
                    bottomIndex = snappedBottomIndex;
                }
                continue;
            }

            int nextStartIndex = crossing.index;
            if (startIndex >= 0 && bottomIndex >= 0) {
                nextStartIndex = findMinimumIndex(yPositions, bottomIndex, crossing.index);
                int repStartMs = timeMs[startIndex];
                int repBottomMs = timeMs[bottomIndex];
                int repEndMs = timeMs[nextStartIndex];
                int eccentricDurationMs = repBottomMs - repStartMs;
                int concentricDurationMs = repEndMs - repBottomMs;
                int repDurationMs = repEndMs - repStartMs;
                double concentricDisplacementPx = Math.abs(yPositions[bottomIndex] - yPositions[nextStartIndex]);

                if (
                    startIndex < bottomIndex &&
                    bottomIndex < nextStartIndex &&
                    eccentricDurationMs >= MIN_PHASE_DURATION_MS &&
                    concentricDurationMs >= MIN_PHASE_DURATION_MS &&
                    repDurationMs >= MIN_REP_DURATION_MS &&
                    concentricDisplacementPx >= minimumConcentricDisplacement
                ) {
                    result.repSegments.add(new RepSegmentData(repIndex, repStartMs, repBottomMs, repEndMs));

                    double concentricTimeSeconds = Math.max(0.001, concentricDurationMs / 1000.0);
                    double averageConcentricSpeedPxPerS = concentricDisplacementPx / concentricTimeSeconds;
                    double lowestConcentricSpeedPxPerS = 0.0;
                    double minimumObservedSpeed = Double.MAX_VALUE;
                    for (int sampleIndex = bottomIndex; sampleIndex <= nextStartIndex; sampleIndex++) {
                        double absoluteVelocity = Math.abs(velocity[sampleIndex]);
                        if (absoluteVelocity < zeroCrossingThreshold) {
                            continue;
                        }
                        minimumObservedSpeed = Math.min(minimumObservedSpeed, absoluteVelocity);
                    }
                    if (minimumObservedSpeed != Double.MAX_VALUE) {
                        lowestConcentricSpeedPxPerS = minimumObservedSpeed;
                    }

                    result.repMetrics.add(
                        new RepMetricData(repIndex, repDurationMs, averageConcentricSpeedPxPerS, lowestConcentricSpeedPxPerS)
                    );
                    repIndex += 1;
                }
            }

            if (bottomIndex < 0) {
                nextStartIndex = findMinimumIndex(yPositions, Math.max(0, startIndex), crossing.index);
            }
            startIndex = nextStartIndex;
            bottomIndex = -1;
        }

        return result;
    }

    private static List<Crossing> collectCrossings(int[] timeMs, double[] velocity, double zeroCrossingThreshold) {
        List<Crossing> crossings = new ArrayList<>();
        int previousDirection = 0;

        for (int index = 0; index < velocity.length; index++) {
            int direction = toDirection(velocity[index], zeroCrossingThreshold);
            if (direction == 0) {
                continue;
            }

            if (previousDirection == 0) {
                previousDirection = direction;
                continue;
            }

            if (direction == previousDirection) {
                continue;
            }

            CrossingType nextType = previousDirection > 0 ? CrossingType.BOTTOM : CrossingType.TOP;
            if (!crossings.isEmpty()) {
                Crossing lastCrossing = crossings.get(crossings.size() - 1);
                if (timeMs[index] - lastCrossing.timeMs < MIN_CROSSING_GAP_MS) {
                    if (
                        lastCrossing.type == nextType &&
                        Math.abs(velocity[index]) >= Math.abs(velocity[lastCrossing.index])
                    ) {
                        crossings.set(crossings.size() - 1, new Crossing(index, timeMs[index], nextType));
                    }
                    previousDirection = direction;
                    continue;
                }
            }

            crossings.add(new Crossing(index, timeMs[index], nextType));
            previousDirection = direction;
        }

        return crossings;
    }

    private static int toDirection(double velocity, double zeroCrossingThreshold) {
        if (velocity >= zeroCrossingThreshold) {
            return 1;
        }
        if (velocity <= -zeroCrossingThreshold) {
            return -1;
        }
        return 0;
    }

    private static double[] smoothDoubleArray(double[] values, int windowSize) {
        if (values.length == 0 || windowSize <= 1) {
            return values;
        }

        int halfWindow = windowSize / 2;
        double[] smoothed = new double[values.length];
        for (int index = 0; index < values.length; index++) {
            int start = Math.max(0, index - halfWindow);
            int end = Math.min(values.length - 1, index + halfWindow);
            double sum = 0.0;
            int count = 0;
            for (int cursor = start; cursor <= end; cursor++) {
                sum += values[cursor];
                count += 1;
            }
            smoothed[index] = count > 0 ? sum / count : 0.0;
        }
        return smoothed;
    }

    private static int findMinimumIndex(double[] values, int startIndex, int endIndex) {
        int clampedStart = Math.max(0, Math.min(startIndex, values.length - 1));
        int clampedEnd = Math.max(clampedStart, Math.min(endIndex, values.length - 1));
        int minimumIndex = clampedStart;
        double minimumValue = values[clampedStart];
        for (int index = clampedStart + 1; index <= clampedEnd; index++) {
            if (values[index] < minimumValue) {
                minimumValue = values[index];
                minimumIndex = index;
            }
        }
        return minimumIndex;
    }

    private static int findMaximumIndex(double[] values, int startIndex, int endIndex) {
        int clampedStart = Math.max(0, Math.min(startIndex, values.length - 1));
        int clampedEnd = Math.max(clampedStart, Math.min(endIndex, values.length - 1));
        int maximumIndex = clampedStart;
        double maximumValue = values[clampedStart];
        for (int index = clampedStart + 1; index <= clampedEnd; index++) {
            if (values[index] > maximumValue) {
                maximumValue = values[index];
                maximumIndex = index;
            }
        }
        return maximumIndex;
    }

    private static double roundTo3(double value) {
        return Math.round(value * 1000.0) / 1000.0;
    }

    private enum CrossingType {
        TOP,
        BOTTOM
    }

    private static final class Crossing {
        final int index;
        final int timeMs;
        final CrossingType type;

        Crossing(int index, int timeMs, CrossingType type) {
            this.index = index;
            this.timeMs = timeMs;
            this.type = type;
        }
    }

    static final class RepDetectionResult {
        final List<RepSegmentData> repSegments = new ArrayList<>();
        final List<RepMetricData> repMetrics = new ArrayList<>();
    }

    static final class RepSegmentData {
        final int repIndex;
        final int startMs;
        final int bottomMs;
        final int endMs;

        RepSegmentData(int repIndex, int startMs, int bottomMs, int endMs) {
            this.repIndex = repIndex;
            this.startMs = startMs;
            this.bottomMs = bottomMs;
            this.endMs = endMs;
        }
    }

    static final class RepMetricData {
        final int repIndex;
        final int repTimeMs;
        final double averageConcentricSpeedPxPerS;
        final double lowestConcentricSpeedPxPerS;

        RepMetricData(
            int repIndex,
            int repTimeMs,
            double averageConcentricSpeedPxPerS,
            double lowestConcentricSpeedPxPerS
        ) {
            this.repIndex = repIndex;
            this.repTimeMs = repTimeMs;
            this.averageConcentricSpeedPxPerS = averageConcentricSpeedPxPerS;
            this.lowestConcentricSpeedPxPerS = lowestConcentricSpeedPxPerS;
        }
    }
}
