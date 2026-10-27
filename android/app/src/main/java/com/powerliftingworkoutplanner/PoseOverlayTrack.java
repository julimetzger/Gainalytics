package com.powerliftingworkoutplanner;

/**
 * GH-75: one side's hip/knee samples for the player overlay. Hidden points are NaN.
 *
 * {@link #interpolate} mirrors {@code interpolatePoseJointAt} in
 * {@code app/utils/videoAnalysisPose.ts}: linear between the two surrounding samples, hidden when
 * a neighbour is hidden or the gap exceeds {@code maxGapMs}; the edge samples are held for half
 * a gap. Keep both in sync.
 */
final class PoseOverlayTrack {
    static final int HIP = 0;
    static final int KNEE = 1;

    final int[] tMs;
    /** [joint][sample] */
    final float[][] xs;
    final float[][] ys;

    PoseOverlayTrack(int sampleCount) {
        tMs = new int[sampleCount];
        xs = new float[2][sampleCount];
        ys = new float[2][sampleCount];
    }

    int size() {
        return tMs.length;
    }

    private boolean isVisible(int joint, int index) {
        return !Float.isNaN(xs[joint][index]) && !Float.isNaN(ys[joint][index]);
    }

    /** Writes the joint position at {@code timeMs} into {@code out[0..1]}; returns false when hidden. */
    boolean interpolate(int joint, int timeMs, int maxGapMs, float[] out) {
        int count = tMs.length;
        if (count == 0) {
            return false;
        }
        if (timeMs <= tMs[0] || timeMs >= tMs[count - 1]) {
            int edge = timeMs <= tMs[0] ? 0 : count - 1;
            if (Math.abs(timeMs - tMs[edge]) * 2 > maxGapMs || !isVisible(joint, edge)) {
                return false;
            }
            out[0] = xs[joint][edge];
            out[1] = ys[joint][edge];
            return true;
        }

        int low = 0;
        int high = count - 1;
        while (high - low > 1) {
            int middle = (low + high) >>> 1;
            if (tMs[middle] <= timeMs) {
                low = middle;
            } else {
                high = middle;
            }
        }
        boolean fromVisible = isVisible(joint, low);
        if (fromVisible && timeMs == tMs[low]) {
            out[0] = xs[joint][low];
            out[1] = ys[joint][low];
            return true;
        }
        int span = tMs[high] - tMs[low];
        if (!fromVisible || !isVisible(joint, high) || span > maxGapMs) {
            return false;
        }
        float ratio = span <= 0 ? 0f : (timeMs - tMs[low]) / (float) span;
        out[0] = xs[joint][low] + (xs[joint][high] - xs[joint][low]) * ratio;
        out[1] = ys[joint][low] + (ys[joint][high] - ys[joint][low]) * ratio;
        return true;
    }
}
