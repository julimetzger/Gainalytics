package com.powerliftingworkoutplanner;

import org.junit.Test;

import static org.junit.Assert.assertEquals;

public class VideoAnalysisRepDetectionTest {

    @Test
    public void detectRepSegmentsReturnsExpectedSegmentsAndMetrics() {
        VideoAnalysisRepDetection.RepDetectionResult detectedReps = VideoAnalysisRepDetection.detectRepData(
            new int[] {0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000, 7500, 8000},
            new double[] {100, 180, 260, 300, 260, 180, 100, 100, 180, 260, 300, 260, 180, 100, 100, 180, 260}
        );

        assertEquals(
            "[segment(0,0,1500,3000), segment(1,3000,5000,6500)]",
            describeSegments(detectedReps)
        );
        assertEquals(
            "[metric(0,3000,133.333,24.0), metric(1,3500,133.333,24.0)]",
            describeMetrics(detectedReps)
        );
    }

    @Test
    public void detectRepSegmentsHandlesConcentricFirstPattern() {
        // Deadlift pattern: bar starts at bottom (high y), moves up (low y), returns to bottom
        // y: 300→220→140→100→140→220→300→300→220→140→100→140→220→300→300→220→140
        VideoAnalysisRepDetection.RepDetectionResult detectedReps = VideoAnalysisRepDetection.detectRepData(
            new int[] {0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000, 7500, 8000},
            new double[] {300, 220, 140, 100, 140, 220, 300, 300, 220, 140, 100, 140, 220, 300, 300, 220, 140}
        );

        assertEquals(
            "[segment(0,0,1500,3000), segment(1,3000,5000,6500)]",
            describeSegments(detectedReps)
        );
        // Concentric phase is start→turnaround (first phase) for deadlift
        assertEquals(2, detectedReps.repMetrics.size());
        for (VideoAnalysisRepDetection.RepMetricData metric : detectedReps.repMetrics) {
            assert metric.averageConcentricSpeedPxPerS > 0;
        }
    }

    @Test
    public void detectRepSegmentsDetectsLastRepWhenVideoEndsSoon() {
        // Two squat reps but the video cuts shortly after the second rep returns to top.
        // Only one full crossing triplet exists; the tail check should catch the second rep.
        VideoAnalysisRepDetection.RepDetectionResult detectedReps = VideoAnalysisRepDetection.detectRepData(
            new int[] {0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 6500, 7000},
            new double[] {100, 180, 260, 300, 260, 180, 100, 180, 260, 300, 260, 180, 100, 100, 100}
        );

        assertEquals(2, detectedReps.repSegments.size());
    }

    @Test
    public void detectRepSegmentsFiltersShortMicroReps() {
        VideoAnalysisRepDetection.RepDetectionResult detectedReps = VideoAnalysisRepDetection.detectRepData(
            new int[] {0, 200, 400, 600, 800, 1000, 1200},
            new double[] {100, 180, 250, 180, 100, 100, 180}
        );

        assertEquals("[]", describeSegments(detectedReps));
        assertEquals("[]", describeMetrics(detectedReps));
    }

    private static String describeSegments(VideoAnalysisRepDetection.RepDetectionResult detectedReps) {
        StringBuilder builder = new StringBuilder("[");
        for (int index = 0; index < detectedReps.repSegments.size(); index++) {
            VideoAnalysisRepDetection.RepSegmentData segment = detectedReps.repSegments.get(index);
            if (index > 0) {
                builder.append(", ");
            }
            builder
                .append("segment(")
                .append(segment.repIndex)
                .append(",")
                .append(segment.startMs)
                .append(",")
                .append(segment.turnaroundMs)
                .append(",")
                .append(segment.endMs)
                .append(")");
        }
        builder.append("]");
        return builder.toString();
    }

    private static String describeMetrics(VideoAnalysisRepDetection.RepDetectionResult detectedReps) {
        StringBuilder builder = new StringBuilder("[");
        for (int index = 0; index < detectedReps.repMetrics.size(); index++) {
            VideoAnalysisRepDetection.RepMetricData metric = detectedReps.repMetrics.get(index);
            if (index > 0) {
                builder.append(", ");
            }
            builder
                .append("metric(")
                .append(metric.repIndex)
                .append(",")
                .append(metric.repTimeMs)
                .append(",")
                .append(round(metric.averageConcentricSpeedPxPerS))
                .append(",")
                .append(round(metric.lowestConcentricSpeedPxPerS))
                .append(")");
        }
        builder.append("]");
        return builder.toString();
    }

    private static double round(double value) {
        return Math.round(value * 1000.0) / 1000.0;
    }
}
