package com.powerliftingworkoutplanner;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

final class VideoAnalysisRepDetection {
    static final String REP_DETECTION_VERSION = "velocity-zero-crossing-v3";

    private static final int MIN_TRACKING_POINTS = 6;
    private static final int SMOOTHING_WINDOW = 5;
    private static final int MIN_CROSSING_GAP_MS = 350;
    private static final int MIN_PHASE_DURATION_MS = 500;
    private static final int MIN_REP_DURATION_MS = 2000;
    private static final double MIN_ZERO_CROSSING_SPEED_PX_PER_S = 12.0;
    private static final double ZERO_CROSSING_SPEED_RATIO = 0.08;
    private static final double MIN_CONCENTRIC_DISPLACEMENT_PX = 12.0;
    private static final double MIN_CONCENTRIC_DISPLACEMENT_RATIO = 0.12;
    private static final double MAX_PHASE_DISPLACEMENT_ASYMMETRY = 0.30;
    private static final double MIN_REP_DISPLACEMENT_VS_MAX = 0.50;

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
                    .put("turnaroundMs", segment.turnaroundMs)
                    .put("endMs", segment.endMs)
            );
        }
        for (RepMetricData metric : detectedReps.repMetrics) {
            repMetricsOut.put(
                new JSONObject()
                    .put("repIndex", metric.repIndex)
                    .put("repTimeMs", metric.repTimeMs)
                    .put("concentricTimeMs", metric.concentricTimeMs)
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

        // Add a synthetic initial crossing so reps that begin before the first
        // real direction change are captured (e.g. a squat that starts descending
        // from frame 0). The synthetic type is the opposite of the first real
        // crossing: if the first real crossing is BOTTOM (bar was going down,
        // now goes up), the implicit prior state was TOP.
        Crossing firstReal = crossings.get(0);
        CrossingType syntheticType = firstReal.type == CrossingType.BOTTOM
            ? CrossingType.TOP : CrossingType.BOTTOM;
        crossings.add(0, new Crossing(0, timeMs[0], syntheticType));

        // Assemble reps from consecutive crossing triplets.
        // Squat/Bench pattern (eccentric-first): TOP → BOTTOM → TOP
        //   start at low y, descend to high y (bottom), ascend back to low y
        // Deadlift pattern (concentric-first): BOTTOM → TOP → BOTTOM
        //   start at high y, ascend to low y (top), descend back to high y
        // After a valid rep, advance by 2 so the end crossing becomes the start
        // of the next rep (no overlapping detections).
        int repIndex = 0;
        List<Double> repDisplacements = new ArrayList<>();
        int ci = 0;

        for (; ci + 2 < crossings.size();) {
            Crossing first = crossings.get(ci);
            Crossing second = crossings.get(ci + 1);
            Crossing third = crossings.get(ci + 2);

            if (first.type != third.type || first.type == second.type) {
                ci++;
                continue;
            }

            boolean eccentricFirst = first.type == CrossingType.TOP;

            int startIdx;
            int turnaroundIdx;
            int endIdx;

            if (eccentricFirst) {
                // TOP → BOTTOM → TOP: start at min-y before first, turnaround at max-y, end at min-y
                startIdx = ci > 0
                    ? findMinimumIndex(yPositions, crossings.get(ci - 1).index, first.index)
                    : findMinimumIndex(yPositions, 0, first.index);
                turnaroundIdx = findMaximumIndex(yPositions, first.index, second.index);
                endIdx = findMinimumIndex(yPositions, second.index, third.index);
            } else {
                // BOTTOM → TOP → BOTTOM: start at max-y before first, turnaround at min-y, end at max-y
                startIdx = ci > 0
                    ? findMaximumIndex(yPositions, crossings.get(ci - 1).index, first.index)
                    : findMaximumIndex(yPositions, 0, first.index);
                turnaroundIdx = findMinimumIndex(yPositions, first.index, second.index);
                endIdx = findMaximumIndex(yPositions, second.index, third.index);
            }

            int repStartMs = timeMs[startIdx];
            int turnaroundMs = timeMs[turnaroundIdx];
            int repEndMs = timeMs[endIdx];
            int firstPhaseDurationMs = turnaroundMs - repStartMs;
            int secondPhaseDurationMs = repEndMs - turnaroundMs;
            int repDurationMs = repEndMs - repStartMs;
            double firstPhaseDisplacement = Math.abs(yPositions[startIdx] - yPositions[turnaroundIdx]);
            double secondPhaseDisplacement = Math.abs(yPositions[turnaroundIdx] - yPositions[endIdx]);
            double maxDisplacement = Math.max(firstPhaseDisplacement, secondPhaseDisplacement);
            double displacementAsymmetry = maxDisplacement > 0
                ? Math.abs(firstPhaseDisplacement - secondPhaseDisplacement) / maxDisplacement
                : 1.0;

            if (
                startIdx < turnaroundIdx &&
                turnaroundIdx < endIdx &&
                firstPhaseDurationMs >= MIN_PHASE_DURATION_MS &&
                secondPhaseDurationMs >= MIN_PHASE_DURATION_MS &&
                repDurationMs >= MIN_REP_DURATION_MS &&
                firstPhaseDisplacement >= minimumConcentricDisplacement &&
                secondPhaseDisplacement >= minimumConcentricDisplacement &&
                displacementAsymmetry <= MAX_PHASE_DISPLACEMENT_ASYMMETRY
            ) {
                result.repSegments.add(new RepSegmentData(repIndex, repStartMs, turnaroundMs, repEndMs));

                // Concentric phase: the phase where the bar moves upward (y decreases)
                int concentricStartIdx;
                int concentricEndIdx;
                double concentricDurationMs;
                if (eccentricFirst) {
                    // Squat: concentric = turnaround → end
                    concentricStartIdx = turnaroundIdx;
                    concentricEndIdx = endIdx;
                    concentricDurationMs = secondPhaseDurationMs;
                } else {
                    // Deadlift: concentric = start → turnaround
                    concentricStartIdx = startIdx;
                    concentricEndIdx = turnaroundIdx;
                    concentricDurationMs = firstPhaseDurationMs;
                }

                double concentricTimeSeconds = Math.max(0.001, concentricDurationMs / 1000.0);
                double concentricDisplacementPx = Math.abs(
                    yPositions[concentricStartIdx] - yPositions[concentricEndIdx]
                );
                double averageConcentricSpeedPxPerS = concentricDisplacementPx / concentricTimeSeconds;
                double lowestConcentricSpeedPxPerS = 0.0;
                double minimumObservedSpeed = Double.MAX_VALUE;
                for (int si = concentricStartIdx; si <= concentricEndIdx; si++) {
                    double absoluteVelocity = Math.abs(velocity[si]);
                    if (absoluteVelocity < zeroCrossingThreshold) {
                        continue;
                    }
                    minimumObservedSpeed = Math.min(minimumObservedSpeed, absoluteVelocity);
                }
                if (minimumObservedSpeed != Double.MAX_VALUE) {
                    lowestConcentricSpeedPxPerS = minimumObservedSpeed;
                }

                result.repMetrics.add(
                    new RepMetricData(repIndex, repDurationMs, (int) concentricDurationMs, averageConcentricSpeedPxPerS, lowestConcentricSpeedPxPerS)
                );
                repDisplacements.add(maxDisplacement);
                repIndex += 1;
                ci += 2;
            } else {
                ci++;
            }
        }

        // Tail check: if exactly 2 unused crossings remain, try to close the last rep
        // using the end of the data as the third boundary point.
        if (ci + 1 < crossings.size() && ci + 2 >= crossings.size()) {
            Crossing first = crossings.get(ci);
            Crossing second = crossings.get(ci + 1);
            int lastSampleIdx = sampleCount - 1;

            if (first.type != second.type) {
                boolean eccentricFirst = first.type == CrossingType.TOP;

                int startIdx;
                int turnaroundIdx;
                int endIdx;

                if (eccentricFirst) {
                    startIdx = ci > 0
                        ? findMinimumIndex(yPositions, crossings.get(ci - 1).index, first.index)
                        : findMinimumIndex(yPositions, 0, first.index);
                    turnaroundIdx = findMaximumIndex(yPositions, first.index, second.index);
                    endIdx = findMinimumIndex(yPositions, second.index, lastSampleIdx);
                } else {
                    startIdx = ci > 0
                        ? findMaximumIndex(yPositions, crossings.get(ci - 1).index, first.index)
                        : findMaximumIndex(yPositions, 0, first.index);
                    turnaroundIdx = findMinimumIndex(yPositions, first.index, second.index);
                    endIdx = findMaximumIndex(yPositions, second.index, lastSampleIdx);
                }

                int repStartMs = timeMs[startIdx];
                int turnaroundMs = timeMs[turnaroundIdx];
                int repEndMs = timeMs[endIdx];
                int firstPhaseDurationMs = turnaroundMs - repStartMs;
                int secondPhaseDurationMs = repEndMs - turnaroundMs;
                int repDurationMs = repEndMs - repStartMs;
                double firstPhaseDisplacement = Math.abs(yPositions[startIdx] - yPositions[turnaroundIdx]);
                double secondPhaseDisplacement = Math.abs(yPositions[turnaroundIdx] - yPositions[endIdx]);
                double maxDisplacement = Math.max(firstPhaseDisplacement, secondPhaseDisplacement);
                double displacementAsymmetry = maxDisplacement > 0
                    ? Math.abs(firstPhaseDisplacement - secondPhaseDisplacement) / maxDisplacement
                    : 1.0;

                if (
                    startIdx < turnaroundIdx &&
                    turnaroundIdx < endIdx &&
                    firstPhaseDurationMs >= MIN_PHASE_DURATION_MS &&
                    secondPhaseDurationMs >= MIN_PHASE_DURATION_MS &&
                    repDurationMs >= MIN_REP_DURATION_MS &&
                    firstPhaseDisplacement >= minimumConcentricDisplacement &&
                    secondPhaseDisplacement >= minimumConcentricDisplacement &&
                    displacementAsymmetry <= MAX_PHASE_DISPLACEMENT_ASYMMETRY
                ) {
                    result.repSegments.add(new RepSegmentData(repIndex, repStartMs, turnaroundMs, repEndMs));

                    int concentricStartIdx;
                    int concentricEndIdx;
                    double concentricDurationMs;
                    if (eccentricFirst) {
                        concentricStartIdx = turnaroundIdx;
                        concentricEndIdx = endIdx;
                        concentricDurationMs = secondPhaseDurationMs;
                    } else {
                        concentricStartIdx = startIdx;
                        concentricEndIdx = turnaroundIdx;
                        concentricDurationMs = firstPhaseDurationMs;
                    }

                    double concentricTimeSeconds = Math.max(0.001, concentricDurationMs / 1000.0);
                    double concentricDisplacementPx = Math.abs(
                        yPositions[concentricStartIdx] - yPositions[concentricEndIdx]
                    );
                    double averageConcentricSpeedPxPerS = concentricDisplacementPx / concentricTimeSeconds;
                    double lowestConcentricSpeedPxPerS = 0.0;
                    double minimumObservedSpeed = Double.MAX_VALUE;
                    for (int si = concentricStartIdx; si <= concentricEndIdx; si++) {
                        double absoluteVelocity = Math.abs(velocity[si]);
                        if (absoluteVelocity < zeroCrossingThreshold) {
                            continue;
                        }
                        minimumObservedSpeed = Math.min(minimumObservedSpeed, absoluteVelocity);
                    }
                    if (minimumObservedSpeed != Double.MAX_VALUE) {
                        lowestConcentricSpeedPxPerS = minimumObservedSpeed;
                    }

                    result.repMetrics.add(
                        new RepMetricData(repIndex, repDurationMs, (int) concentricDurationMs, averageConcentricSpeedPxPerS, lowestConcentricSpeedPxPerS)
                    );
                    repDisplacements.add(maxDisplacement);
                    repIndex += 1;
                }
            }
        }

        // Post-filter: remove reps whose displacement is less than 50% of the largest rep.
        if (!repDisplacements.isEmpty()) {
            double largestDisplacement = 0.0;
            for (double d : repDisplacements) {
                largestDisplacement = Math.max(largestDisplacement, d);
            }
            double displacementThreshold = largestDisplacement * MIN_REP_DISPLACEMENT_VS_MAX;

            int writeIdx = 0;
            for (int ri = 0; ri < repDisplacements.size(); ri++) {
                if (repDisplacements.get(ri) >= displacementThreshold) {
                    if (writeIdx != ri) {
                        RepSegmentData seg = result.repSegments.get(ri);
                        result.repSegments.set(writeIdx, new RepSegmentData(writeIdx, seg.startMs, seg.turnaroundMs, seg.endMs));
                        RepMetricData met = result.repMetrics.get(ri);
                        result.repMetrics.set(writeIdx, new RepMetricData(writeIdx, met.repTimeMs, met.concentricTimeMs, met.averageConcentricSpeedPxPerS, met.lowestConcentricSpeedPxPerS));
                    }
                    writeIdx++;
                }
            }
            while (result.repSegments.size() > writeIdx) {
                result.repSegments.remove(result.repSegments.size() - 1);
                result.repMetrics.remove(result.repMetrics.size() - 1);
            }
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
        final int turnaroundMs;
        final int endMs;

        RepSegmentData(int repIndex, int startMs, int turnaroundMs, int endMs) {
            this.repIndex = repIndex;
            this.startMs = startMs;
            this.turnaroundMs = turnaroundMs;
            this.endMs = endMs;
        }
    }

    static final class RepMetricData {
        final int repIndex;
        final int repTimeMs;
        final int concentricTimeMs;
        final double averageConcentricSpeedPxPerS;
        final double lowestConcentricSpeedPxPerS;

        RepMetricData(
            int repIndex,
            int repTimeMs,
            int concentricTimeMs,
            double averageConcentricSpeedPxPerS,
            double lowestConcentricSpeedPxPerS
        ) {
            this.repIndex = repIndex;
            this.repTimeMs = repTimeMs;
            this.concentricTimeMs = concentricTimeMs;
            this.averageConcentricSpeedPxPerS = averageConcentricSpeedPxPerS;
            this.lowestConcentricSpeedPxPerS = lowestConcentricSpeedPxPerS;
        }
    }
}
