package com.powerliftingworkoutplanner;

import android.content.Context;
import android.graphics.Bitmap;
import android.media.Image;
import android.os.SystemClock;
import android.util.Log;

import com.google.mediapipe.framework.image.BitmapImageBuilder;
import com.google.mediapipe.framework.image.MPImage;
import com.google.mediapipe.tasks.components.containers.NormalizedLandmark;
import com.google.mediapipe.tasks.core.BaseOptions;
import com.google.mediapipe.tasks.core.Delegate;
import com.google.mediapipe.tasks.vision.core.RunningMode;
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker;
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult;

import org.json.JSONObject;

import java.nio.ByteBuffer;
import java.util.List;

/**
 * GH-75: hip and knee per analysed frame with MediaPipe Pose Landmarker (lite).
 *
 * Created once per analysis, fed the same sampled frames as the bar tracking, and closed when
 * the analysis ends. Only landmarks 23–26 (left/right hip, left/right knee) are stored; x/y are
 * normalised to the rotation-corrected video frame because the model sees the whole frame,
 * scaled without letterboxing.
 */
final class VideoAnalysisPoseDetector implements AutoCloseable {
    static final String MODEL_ASSET_PATH = "models/pose_landmarker_lite.task";
    static final String MODEL_NAME = "pose_landmarker_lite";
    static final String POSE_VERSION = "mediapipe-pose-lite-hip-knee-v1";

    private static final String LOG_TAG = "VideoAnalysisPose";
    /** Long side of the frame handed to the model; its 256 px landmark crop then sees the person at full detail. */
    private static final int POSE_INPUT_LONG_SIDE = 480;
    private static final int LEFT_HIP = 23;
    private static final int RIGHT_HIP = 24;
    private static final int LEFT_KNEE = 25;
    private static final int RIGHT_KNEE = 26;
    /** After this many failed frames pose is switched off for the rest of the analysis. */
    private static final int MAX_FAILURES = 3;

    private final PoseLandmarker landmarker;
    private Bitmap inputBitmap;
    private int[] inputPixels;
    private byte[] yPlane;
    private byte[] uPlane;
    private byte[] vPlane;
    private long lastTimestampMs = -1;
    private boolean disabled;

    double setupMs;
    double frameConversionMs;
    double inferenceMs;
    int callCount;
    int detectedFrameCount;
    int failureCount;
    String delegate;

    private VideoAnalysisPoseDetector(PoseLandmarker landmarker, double setupMs) {
        this.landmarker = landmarker;
        this.setupMs = setupMs;
    }

    /**
     * Returns null when the model cannot be loaded — the analysis then runs without pose.
     *
     * CPU on purpose: on the S20 test phone the GPU delegate halves the per-frame time
     * (~20 vs ~37 ms) but costs ~2.8 s of setup on EVERY analysis, so a 7 s clip at 15 FPS
     * was not faster overall (11.4 s vs 11.0 s).
     */
    static VideoAnalysisPoseDetector createOrNull(Context context) {
        long startedAtNs = SystemClock.elapsedRealtimeNanos();
        try {
            PoseLandmarker landmarker = PoseLandmarker.createFromOptions(context, buildOptions(Delegate.CPU));
            VideoAnalysisPoseDetector detector = new VideoAnalysisPoseDetector(landmarker, elapsedMs(startedAtNs));
            detector.delegate = Delegate.CPU.name();
            return detector;
        } catch (Throwable error) {
            Log.w(LOG_TAG, "Pose landmarker unavailable, analysing without pose", error);
            return null;
        }
    }

    private static PoseLandmarker.PoseLandmarkerOptions buildOptions(Delegate delegate) {
        BaseOptions baseOptions = BaseOptions.builder()
            .setModelAssetPath(MODEL_ASSET_PATH)
            .setDelegate(delegate)
            .build();
        return PoseLandmarker.PoseLandmarkerOptions.builder()
            .setBaseOptions(baseOptions)
            .setRunningMode(RunningMode.VIDEO)
            .setNumPoses(1)
            .setMinPoseDetectionConfidence(0.5f)
            .setMinPosePresenceConfidence(0.5f)
            .setMinTrackingConfidence(0.5f)
            .setOutputSegmentationMasks(false)
            .build();
    }

    /** True when pose was switched off mid-analysis after repeated failures. */
    boolean isDisabled() {
        return disabled;
    }

    /**
     * Decoder path: the YUV frame that the bar tracking just used. Never throws — pose is
     * optional and must not abort or alter the bar analysis (GH-75 review).
     */
    JSONObject detect(Image image, int rotationDegrees, int timeMs) {
        if (disabled) {
            return null;
        }
        Bitmap frame;
        try {
            long conversionStartedAtNs = SystemClock.elapsedRealtimeNanos();
            frame = yuvImageToScaledBitmap(image, rotationDegrees);
            frameConversionMs += elapsedMs(conversionStartedAtNs);
        } catch (Throwable error) {
            recordFailure(timeMs, error);
            return null;
        }
        return detect(frame, timeMs);
    }

    /** Retriever fallback path: an already rotation-corrected frame. Never throws. */
    JSONObject detect(Bitmap frame, int timeMs) {
        if (disabled || frame == null || frame.isRecycled() || frame.getWidth() <= 0 || frame.getHeight() <= 0) {
            return null;
        }
        Bitmap input = frame;
        boolean scaled = false;
        try {
            if (frame != inputBitmap) {
                long conversionStartedAtNs = SystemClock.elapsedRealtimeNanos();
                int[] size = scaledSize(frame.getWidth(), frame.getHeight());
                if (size[0] != frame.getWidth() || size[1] != frame.getHeight()) {
                    input = Bitmap.createScaledBitmap(frame, size[0], size[1], true);
                    scaled = true;
                }
                frameConversionMs += elapsedMs(conversionStartedAtNs);
            }
            // VIDEO mode needs strictly increasing timestamps; the retriever fallback can
            // restart at 0 after a failed decoder pass.
            long timestampMs = Math.max(timeMs, lastTimestampMs + 1);
            lastTimestampMs = timestampMs;
            MPImage mpImage = new BitmapImageBuilder(input).build();
            long inferenceStartedAtNs = SystemClock.elapsedRealtimeNanos();
            PoseLandmarkerResult result = landmarker.detectForVideo(mpImage, timestampMs);
            inferenceMs += elapsedMs(inferenceStartedAtNs);
            callCount += 1;
            return toPoseSample(result, timeMs);
        } catch (Throwable error) {
            recordFailure(timeMs, error);
            return null;
        } finally {
            if (scaled && input != frame) {
                input.recycle();
            }
        }
    }

    private void recordFailure(int timeMs, Throwable error) {
        failureCount += 1;
        Log.w(LOG_TAG, "Pose detection failed at tMs=" + timeMs + " (failure " + failureCount + ")", error);
        // An Error (OOM, native crash surfaced as Error) or repeated failures: stop trying, so a
        // broken pose model costs neither time nor memory for the rest of the analysis.
        if (error instanceof Error || failureCount >= MAX_FAILURES) {
            disabled = true;
            Log.w(LOG_TAG, "Pose detection disabled for the rest of this analysis");
        }
    }

    private JSONObject toPoseSample(PoseLandmarkerResult result, int timeMs) throws Exception {
        JSONObject sample = new JSONObject();
        sample.put("tMs", timeMs);
        List<List<NormalizedLandmark>> poses = result.landmarks();
        if (poses == null || poses.isEmpty() || poses.get(0).size() <= RIGHT_KNEE) {
            return sample;
        }
        List<NormalizedLandmark> landmarks = poses.get(0);
        sample.put("left", toSide(landmarks.get(LEFT_HIP), landmarks.get(LEFT_KNEE)));
        sample.put("right", toSide(landmarks.get(RIGHT_HIP), landmarks.get(RIGHT_KNEE)));
        detectedFrameCount += 1;
        return sample;
    }

    private static JSONObject toSide(NormalizedLandmark hip, NormalizedLandmark knee) throws Exception {
        JSONObject side = new JSONObject();
        side.put("hip", toPoint(hip));
        side.put("knee", toPoint(knee));
        return side;
    }

    private static JSONObject toPoint(NormalizedLandmark landmark) throws Exception {
        JSONObject point = new JSONObject();
        point.put("x", round(landmark.x(), 10000.0));
        point.put("y", round(landmark.y(), 10000.0));
        point.put("visibility", round(landmark.visibility().orElse(0f), 1000.0));
        return point;
    }

    private static int[] scaledSize(int width, int height) {
        double scale = Math.min(1.0, POSE_INPUT_LONG_SIDE / (double) Math.max(width, height));
        return new int[] {
            Math.max(1, (int) Math.round(width * scale)),
            Math.max(1, (int) Math.round(height * scale)),
        };
    }

    /**
     * Nearest-neighbour YUV→ARGB with rotation, straight into a small bitmap. Only the
     * ~480×270 output pixels are computed, not the full decoded frame.
     */
    private Bitmap yuvImageToScaledBitmap(Image image, int rotationDegrees) {
        int encodedWidth = image.getWidth();
        int encodedHeight = image.getHeight();
        int rotation = ((rotationDegrees % 360) + 360) % 360;
        boolean swap = rotation == 90 || rotation == 270;
        int logicalWidth = swap ? encodedHeight : encodedWidth;
        int logicalHeight = swap ? encodedWidth : encodedHeight;
        int[] size = scaledSize(logicalWidth, logicalHeight);
        int outWidth = size[0];
        int outHeight = size[1];

        if (inputBitmap == null || inputBitmap.getWidth() != outWidth || inputBitmap.getHeight() != outHeight) {
            if (inputBitmap != null) {
                inputBitmap.recycle();
            }
            inputBitmap = Bitmap.createBitmap(outWidth, outHeight, Bitmap.Config.ARGB_8888);
            inputPixels = new int[outWidth * outHeight];
        }

        Image.Plane[] planes = image.getPlanes();
        yPlane = copyPlane(planes[0].getBuffer(), yPlane);
        uPlane = copyPlane(planes[1].getBuffer(), uPlane);
        vPlane = copyPlane(planes[2].getBuffer(), vPlane);
        int yRowStride = planes[0].getRowStride();
        int yPixelStride = planes[0].getPixelStride();
        int uRowStride = planes[1].getRowStride();
        int uPixelStride = planes[1].getPixelStride();
        int vRowStride = planes[2].getRowStride();
        int vPixelStride = planes[2].getPixelStride();

        double stepX = logicalWidth / (double) outWidth;
        double stepY = logicalHeight / (double) outHeight;
        int pixelIndex = 0;
        for (int outY = 0; outY < outHeight; outY++) {
            int logicalY = Math.min(logicalHeight - 1, (int) ((outY + 0.5) * stepY));
            for (int outX = 0; outX < outWidth; outX++) {
                int logicalX = Math.min(logicalWidth - 1, (int) ((outX + 0.5) * stepX));
                int sourceX;
                int sourceY;
                switch (rotation) {
                    case 90:
                        sourceX = logicalY;
                        sourceY = encodedHeight - 1 - logicalX;
                        break;
                    case 180:
                        sourceX = encodedWidth - 1 - logicalX;
                        sourceY = encodedHeight - 1 - logicalY;
                        break;
                    case 270:
                        sourceX = encodedWidth - 1 - logicalY;
                        sourceY = logicalX;
                        break;
                    default:
                        sourceX = logicalX;
                        sourceY = logicalY;
                        break;
                }
                int y = yPlane[sourceY * yRowStride + sourceX * yPixelStride] & 0xFF;
                int uvX = sourceX >> 1;
                int uvY = sourceY >> 1;
                int u = uPlane[uvY * uRowStride + uvX * uPixelStride] & 0xFF;
                int v = vPlane[uvY * vRowStride + uvX * vPixelStride] & 0xFF;
                inputPixels[pixelIndex++] = yuvToArgb(y, u, v);
            }
        }
        inputBitmap.setPixels(inputPixels, 0, outWidth, 0, 0, outWidth, outHeight);
        return inputBitmap;
    }

    /**
     * Copies a plane without touching the codec's buffer state: a duplicate has its own
     * position/limit, and only the readable bytes (up to the limit) are copied.
     */
    private static byte[] copyPlane(ByteBuffer buffer, byte[] cache) {
        ByteBuffer view = buffer.duplicate();
        view.rewind();
        int length = view.remaining();
        byte[] target = cache != null && cache.length >= length ? cache : new byte[length];
        view.get(target, 0, length);
        return target;
    }

    /** BT.601 limited range, same as VideoAnalysisModule.yuvToArgb. */
    private static int yuvToArgb(int y, int u, int v) {
        int adjustedY = Math.max(0, y - 16);
        int adjustedU = u - 128;
        int adjustedV = v - 128;
        int red = clampColor((298 * adjustedY + 409 * adjustedV + 128) >> 8);
        int green = clampColor((298 * adjustedY - 100 * adjustedU - 208 * adjustedV + 128) >> 8);
        int blue = clampColor((298 * adjustedY + 516 * adjustedU + 128) >> 8);
        return 0xFF000000 | (red << 16) | (green << 8) | blue;
    }

    private static int clampColor(int value) {
        return value < 0 ? 0 : Math.min(255, value);
    }

    private static double round(double value, double factor) {
        return Math.round(value * factor) / factor;
    }

    private static double elapsedMs(long startedAtNs) {
        return (SystemClock.elapsedRealtimeNanos() - startedAtNs) / 1_000_000.0;
    }

    @Override
    public void close() {
        try {
            landmarker.close();
        } catch (Throwable ignored) {
            // No-op.
        }
        if (inputBitmap != null && !inputBitmap.isRecycled()) {
            inputBitmap.recycle();
        }
        inputBitmap = null;
        inputPixels = null;
        yPlane = null;
        uPlane = null;
        vPlane = null;
    }
}
