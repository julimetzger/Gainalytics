package com.powerliftingworkoutplanner;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/** GH-75: same cases as interpolatePoseJointAt in app/utils/__tests__/videoAnalysisPose.test.ts. */
public class PoseOverlayTrackTest {
    private static PoseOverlayTrack track() {
        // hip x: 0.4, 0.6, hidden, 0.8 at 0/100/200/300 ms; knee always visible.
        PoseOverlayTrack track = new PoseOverlayTrack(4);
        int[] times = {0, 100, 200, 300};
        float[] hipX = {0.4f, 0.6f, Float.NaN, 0.8f};
        for (int index = 0; index < 4; index++) {
            track.tMs[index] = times[index];
            track.xs[PoseOverlayTrack.HIP][index] = hipX[index];
            track.ys[PoseOverlayTrack.HIP][index] = Float.isNaN(hipX[index]) ? Float.NaN : 0.5f;
            track.xs[PoseOverlayTrack.KNEE][index] = 0.5f + index * 0.1f;
            track.ys[PoseOverlayTrack.KNEE][index] = 0.7f;
        }
        return track;
    }

    @Test
    public void interpolatesLinearlyBetweenVisibleSamples() {
        float[] out = new float[2];
        assertTrue(track().interpolate(PoseOverlayTrack.HIP, 25, 250, out));
        assertEquals(0.45f, out[0], 1e-5);
        assertEquals(0.5f, out[1], 1e-5);
        assertTrue(track().interpolate(PoseOverlayTrack.KNEE, 250, 250, out));
        assertEquals(0.75f, out[0], 1e-5);
    }

    @Test
    public void returnsTheSampleOnAnExactTime() {
        float[] out = new float[2];
        assertTrue(track().interpolate(PoseOverlayTrack.HIP, 100, 250, out));
        assertEquals(0.6f, out[0], 1e-6);
    }

    @Test
    public void hidesNextToAHiddenSampleAndAcrossLargeGaps() {
        float[] out = new float[2];
        assertFalse(track().interpolate(PoseOverlayTrack.HIP, 150, 250, out));
        assertFalse(track().interpolate(PoseOverlayTrack.HIP, 250, 250, out));
        assertFalse(track().interpolate(PoseOverlayTrack.KNEE, 50, 80, out));
    }

    @Test
    public void holdsEdgesForHalfAGap() {
        float[] out = new float[2];
        assertTrue(track().interpolate(PoseOverlayTrack.HIP, -50, 250, out));
        assertEquals(0.4f, out[0], 1e-6);
        assertTrue(track().interpolate(PoseOverlayTrack.HIP, 400, 250, out));
        assertEquals(0.8f, out[0], 1e-6);
        assertFalse(track().interpolate(PoseOverlayTrack.HIP, 450, 250, out));
    }
}
