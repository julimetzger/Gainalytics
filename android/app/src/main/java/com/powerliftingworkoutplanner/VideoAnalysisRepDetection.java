package com.powerliftingworkoutplanner;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

final class VideoAnalysisRepDetection {
    static final String REP_DETECTION_VERSION = "velocity-zero-crossing-v7";

    private static final int MIN_TRACKING_POINTS = 6;
    private static final int SMOOTHING_WINDOW = 5;
    private static final int MIN_CROSSING_GAP_MS = 350;
    private static final int MIN_PHASE_DURATION_MS = 500;
    private static final int MIN_REP_DURATION_MS = 2000;
    private static final double MIN_ZERO_CROSSING_SPEED_PX_PER_S = 12.0;
    private static final double ZERO_CROSSING_SPEED_RATIO = 0.08;
    private static final double MIN_CONCENTRIC_DISPLACEMENT_PX = 12.0;
    private static final double MIN_CONCENTRIC_DISPLACEMENT_RATIO = 0.12;
    // A bounce / sustained jitter at a turnaround shows up as a same-type crossing pair
    // bracketing an opposite-type blip. It is collapsed away when the whole excursion is
    // both short in time (well under a rep) and small in displacement, so the spurious
    // boundary never reaches the triplet matcher and cannot make the gates drop a real rep.
    // The displacement bound is RELATIVE to the recording's full bar-travel range, never
    // an absolute pixel value: in a far-away/small-scale video the whole bar travel can sit
    // below an absolute bound (e.g. ~30px travel vs a 36px bound), and two fast real reps
    // (their same-type turnaround pair under MAX_BOUNCE_EXCURSION_MS apart) would then be
    // collapsed into one. A real rep phase always displaces at least
    // MIN_CONCENTRIC_DISPLACEMENT_RATIO of the range, while observed pause jitter stays
    // around 2-5% of it, so the ratio itself is a safe cut between the two.
    private static final int MAX_BOUNCE_EXCURSION_MS = 1500;
    private static final double BOUNCE_EXCURSION_DISPLACEMENT_RATIO = MIN_CONCENTRIC_DISPLACEMENT_RATIO;
    private static final double MAX_PHASE_DISPLACEMENT_ASYMMETRY = 0.30;
    private static final double MIN_REP_DISPLACEMENT_VS_MAX = 0.50;
    // Rep boundaries are anchored at the y-extremum of the window between velocity
    // crossings, but that window also spans the standing pause between reps: rep N's
    // start and rep N-1's end share the same extremum, so a 5s standing pause used to
    // be counted into the rep phases (GH-378: "rep start set too early", concentric
    // times of 5-10s at absurdly low average speeds). The reported boundaries are
    // therefore snapped to the actual movement onset/stop: the start moves forward to
    // the last sample still resting within this tolerance of the start extremum, the
    // end moves back to the first sample that has settled within it. Like every other
    // displacement bound in this detector the tolerance is RELATIVE to the recording's
    // bar-travel range (observed pause jitter/drift stays around 2-5% of range, real
    // movement sweeps ≥12%), never an absolute pixel value. The accept/reject gates
    // still run on the raw extremum boundaries so snapping can never change WHICH reps
    // are detected — only where their boundaries are reported.
    private static final double REST_DISPLACEMENT_TOLERANCE_RATIO = 0.05;

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
        double restDisplacementTolerance = (maxY - minY) * REST_DISPLACEMENT_TOLERANCE_RATIO;

        List<Crossing> crossings = collectCrossings(timeMs, velocity, zeroCrossingThreshold);
        collapseBounceExcursions(
            crossings,
            yPositions,
            (maxY - minY) * BOUNCE_EXCURSION_DISPLACEMENT_RATIO,
            MAX_BOUNCE_EXCURSION_MS
        );
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
                recordRep(
                    result,
                    repDisplacements,
                    repIndex,
                    timeMs,
                    yPositions,
                    velocity,
                    zeroCrossingThreshold,
                    restDisplacementTolerance,
                    eccentricFirst,
                    startIdx,
                    turnaroundIdx,
                    endIdx,
                    second.index,
                    maxDisplacement
                );
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
                    recordRep(
                        result,
                        repDisplacements,
                        repIndex,
                        timeMs,
                        yPositions,
                        velocity,
                        zeroCrossingThreshold,
                        restDisplacementTolerance,
                        eccentricFirst,
                        startIdx,
                        turnaroundIdx,
                        endIdx,
                        second.index,
                        maxDisplacement
                    );
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

    // Emits an accepted rep with its boundaries snapped to movement onset/stop (see
    // REST_DISPLACEMENT_TOLERANCE_RATIO). The gates have already accepted the rep on
    // the raw extremum boundaries when this runs, so snapping only refines the
    // reported times and metrics — it can never change which reps are detected.
    private static void recordRep(
        RepDetectionResult result,
        List<Double> repDisplacements,
        int repIndex,
        int[] timeMs,
        double[] yPositions,
        double[] velocity,
        double zeroCrossingThreshold,
        double restDisplacementTolerance,
        boolean eccentricFirst,
        int startIdx,
        int turnaroundIdx,
        int endIdx,
        int endWindowStartIdx,
        double maxDisplacement
    ) {
        int snappedStartIdx = snapStartToMovementOnset(
            yPositions, startIdx, turnaroundIdx, restDisplacementTolerance
        );
        int snappedEndIdx = snapEndToMovementStop(
            yPositions, endWindowStartIdx, turnaroundIdx, endIdx, restDisplacementTolerance
        );

        int repStartMs = timeMs[snappedStartIdx];
        int turnaroundMs = timeMs[turnaroundIdx];
        int repEndMs = timeMs[snappedEndIdx];
        result.repSegments.add(new RepSegmentData(repIndex, repStartMs, turnaroundMs, repEndMs));

        // Concentric phase: the phase where the bar moves upward (y decreases)
        int concentricStartIdx;
        int concentricEndIdx;
        int concentricDurationMs;
        if (eccentricFirst) {
            // Squat/Bench: concentric = turnaround → end
            concentricStartIdx = turnaroundIdx;
            concentricEndIdx = snappedEndIdx;
            concentricDurationMs = repEndMs - turnaroundMs;
        } else {
            // Deadlift: concentric = start → turnaround
            concentricStartIdx = snappedStartIdx;
            concentricEndIdx = turnaroundIdx;
            concentricDurationMs = turnaroundMs - repStartMs;
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
            new RepMetricData(
                repIndex,
                repEndMs - repStartMs,
                concentricDurationMs,
                averageConcentricSpeedPxPerS,
                lowestConcentricSpeedPxPerS
            )
        );
        repDisplacements.add(maxDisplacement);
    }

    // Last sample before the turnaround that still rests within tolerance of the
    // start extremum — i.e. the actual movement onset. A jitter spike that leaves
    // the band early only makes the snap conservative (closer to the raw extremum).
    private static int snapStartToMovementOnset(
        double[] yPositions,
        int startIdx,
        int turnaroundIdx,
        double tolerance
    ) {
        double restY = yPositions[startIdx];
        int snapped = startIdx;
        for (int index = startIdx + 1; index < turnaroundIdx; index++) {
            if (Math.abs(yPositions[index] - restY) > tolerance) {
                break;
            }
            snapped = index;
        }
        return snapped;
    }

    // First sample after the turnaround that has settled within tolerance of the end
    // extremum — i.e. where the movement actually stops, before the post-rep pause.
    private static int snapEndToMovementStop(
        double[] yPositions,
        int endWindowStartIdx,
        int turnaroundIdx,
        int endIdx,
        double tolerance
    ) {
        double restY = yPositions[endIdx];
        for (int index = Math.max(endWindowStartIdx, turnaroundIdx + 1); index < endIdx; index++) {
            if (Math.abs(yPositions[index] - restY) <= tolerance) {
                return index;
            }
        }
        return endIdx;
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
                    if (lastCrossing.type == nextType) {
                        if (Math.abs(velocity[index]) >= Math.abs(velocity[lastCrossing.index])) {
                            crossings.set(crossings.size() - 1, new Crossing(index, timeMs[index], nextType));
                        }
                        previousDirection = direction;
                    }
                    // An opposite-type flip inside the gap window is ignored without
                    // updating previousDirection: the crossing list must stay strictly
                    // alternating (TOP/BOTTOM), otherwise the triplet matcher can never
                    // assemble a rep. A real direction change re-triggers immediately
                    // after the gap; short jitter never reaches the list.
                    continue;
                }
            }

            crossings.add(new Crossing(index, timeMs[index], nextType));
            previousDirection = direction;
        }

        return crossings;
    }

    // Removes bounce / sustained-jitter artefacts from the (already alternating) crossing
    // list. collectCrossings debounces a near opposite flip but deliberately keeps
    // previousDirection tied to the last committed crossing so a real move that resumes
    // right after the gap window still registers (this is what lets the noisy squat-3reps
    // recording detect all three reps). The downside is that a plate bounce or a standing
    // pause that keeps wobbling can, on the first sample past the window, plant a spurious
    // opposite crossing at the turnaround. Such an artefact is always a short, small
    // excursion: a same-type pair (a, b) around an opposite blip (m). We collapse it into
    // the more extreme of the two same-type crossings. The duration gate alone cannot
    // separate jitter from reps: two fast back-to-back reps put their same-type turnaround
    // crossings under MAX_BOUNCE_EXCURSION_MS apart. What does separate them is relative
    // displacement — a real rep phase sweeps most of the recording's bar-travel range,
    // while pause jitter wobbles at a few percent of it. Hence the displacement bound is a
    // fraction of the full range (no absolute floor), which keeps small-amplitude/far-away
    // recordings safe: their real reps are small in pixels but still large relative to range.
    private static void collapseBounceExcursions(
        List<Crossing> crossings,
        double[] yPositions,
        double maxExcursionDisplacement,
        int maxExcursionMs
    ) {
        boolean changed = true;
        while (changed) {
            changed = false;
            for (int i = 1; i + 1 < crossings.size(); i++) {
                Crossing before = crossings.get(i - 1);
                Crossing middle = crossings.get(i);
                Crossing after = crossings.get(i + 1);
                if (before.type != after.type || before.type == middle.type) {
                    continue;
                }
                double leftDisplacement = Math.abs(yPositions[before.index] - yPositions[middle.index]);
                double rightDisplacement = Math.abs(yPositions[middle.index] - yPositions[after.index]);
                int excursionMs = after.timeMs - before.timeMs;
                if (
                    leftDisplacement < maxExcursionDisplacement &&
                    rightDisplacement < maxExcursionDisplacement &&
                    excursionMs < maxExcursionMs
                ) {
                    // Keep the earlier outer crossing, drop the blip and the later outer.
                    // Keeping the earlier one preserves the boundary that a following rep
                    // (or the end-of-data tail check) relies on, so real rep timings never
                    // shift — only the spurious blip is removed.
                    crossings.remove(i + 1);
                    crossings.remove(i);
                    changed = true;
                    break;
                }
            }
        }
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
