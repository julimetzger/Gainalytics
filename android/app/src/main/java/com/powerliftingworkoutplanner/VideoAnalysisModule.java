package com.powerliftingworkoutplanner;

import android.content.res.AssetFileDescriptor;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.RectF;
import android.media.Image;
import android.media.MediaCodec;
import android.media.MediaCodecInfo;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaMetadataRetriever;
import android.os.SystemClock;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import org.json.JSONArray;
import org.json.JSONObject;
import org.tensorflow.lite.DataType;
import org.tensorflow.lite.Interpreter;
import org.tensorflow.lite.Tensor;
import org.tensorflow.lite.gpu.CompatibilityList;
import org.tensorflow.lite.gpu.GpuDelegate;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.nio.MappedByteBuffer;
import java.nio.channels.FileChannel;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class VideoAnalysisModule extends ReactContextBaseJavaModule {

    static {
        System.loadLibrary("gainalytics_native");
    }

    /**
     * Native YUV→RGB letterbox conversion (C++ + NEON, arm64).
     * Replaces the Java imageToLetterboxedFloatDirect() inner loop.
     * Plane arrays are the pre-copied yPlaneCache / uPlaneCache / vPlaneCache byte[].
     */
    private static native void nativeYuvToLetterboxedRgb(
            byte[] yArr, byte[] uArr, byte[] vArr,
            int encodedWidth, int encodedHeight,
            int yRowStride, int yPixelStride,
            int uRowStride, int uPixelStride,
            int vRowStride, int vPixelStride,
            int normalizedRotation,
            int logicalWidth, int logicalHeight,
            double padX, double padY, double scale,
            java.nio.ByteBuffer outBuffer,
            boolean isUint8Input);
    private static final int DEFAULT_DURATION_MS = 6000;
    private static final double DEFAULT_SOURCE_FPS = 30.0;
    private static final double FIXED_ANALYZED_FPS = 20.0;
    private static final int MODEL_INPUT_SIZE = 320;
    private static final int MAX_CANDIDATES = 20;
    private static final int MIN_FEATURE_VECTOR_LENGTH = 5;
    private static final int MAX_FEATURE_VECTOR_LENGTH = 64;
    private static final long DECODER_TIMEOUT_US = 10_000L;

    private static final float DETECTION_CONFIDENCE_THRESHOLD = 0.2f;
    private static final float NMS_IOU_THRESHOLD = 0.45f;
    private static final float PLAUSIBILITY_MAX_JUMP_NORMALIZED = 0.30f;
    private static final int MAX_PLAUSIBILITY_REJECTIONS_DEBUG = 120;

    private static final String TRACKER_VERSION = "tflite-yolo26-outer-plate-v1";
    private static final String MODEL_ASSET_PATH = "models/outer_plate_yolo26n_float32.tflite";

    private static final String ERR_VIDEO_ANALYSIS = "ERR_VIDEO_ANALYSIS";
    private static final String ERR_VIDEO_ANALYSIS_DIR = "ERR_VIDEO_ANALYSIS_DIR";
    private static final String ERR_VIDEO_ANALYSIS_PREVIEW = "ERR_VIDEO_ANALYSIS_PREVIEW";
    private static final String ERR_VIDEO_ANALYSIS_NEEDS_MANUAL_SEED = "ERR_VIDEO_ANALYSIS_NEEDS_MANUAL_SEED";
    private static final String ERR_VIDEO_ANALYSIS_NO_CANDIDATE = "ERR_VIDEO_ANALYSIS_NO_CANDIDATE";
    private static final String MANUAL_SEED_REQUIRED_PREFIX = "MANUAL_SEED_REQUIRED::";
    private static final String LOG_TAG = "VideoAnalysis";
    private static final Paint LETTERBOX_PAINT = new Paint(Paint.FILTER_BITMAP_FLAG);

    private final Object interpreterLock = new Object();
    private Interpreter interpreter;
    private GpuDelegate gpuDelegate;

    public VideoAnalysisModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "VideoAnalysis";
    }

    @Override
    public void invalidate() {
        synchronized (interpreterLock) {
            if (interpreter != null) {
                interpreter.close();
                interpreter = null;
            }
            if (gpuDelegate != null) {
                gpuDelegate.close();
                gpuDelegate = null;
            }
        }
        super.invalidate();
    }

    @ReactMethod
    public void getVideoDuration(String localVideoPath, Promise promise) {
        promise.resolve((double) extractDurationMs(localVideoPath));
    }

    @ReactMethod
    public void prepareSquatVideoSeed(String localVideoPath, int analysisId, Promise promise) {
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        AnalysisPerformanceMetrics performanceMetrics = new AnalysisPerformanceMetrics();
        long preflightStartedAtMs = SystemClock.elapsedRealtime();
        Bitmap frame = null;
        DetectionContext detectionContext = null;
        try {
            File rootDir = ensureVideoAnalysisRootDir();

            long previewStartedAtMs = SystemClock.elapsedRealtime();
            String previewFramePath = writePreviewFrame(localVideoPath, analysisId, rootDir);
            performanceMetrics.previewFrameWriteMs = SystemClock.elapsedRealtime() - previewStartedAtMs;

            retriever.setDataSource(localVideoPath);
            long initialFrameReadStartedAtMs = SystemClock.elapsedRealtime();
            frame = retriever.getFrameAtTime(0, MediaMetadataRetriever.OPTION_CLOSEST_SYNC);
            performanceMetrics.initialFrameReadMs = SystemClock.elapsedRealtime() - initialFrameReadStartedAtMs;
            if (frame == null) {
                promise.reject(ERR_VIDEO_ANALYSIS_PREVIEW, "Could not extract preview frame");
                return;
            }

            detectionContext = createDetectionContext();
            long initialDetectionStartedAtMs = SystemClock.elapsedRealtime();
            List<DetectionCandidate> candidates = detectCandidates(frame, detectionContext, performanceMetrics);
            performanceMetrics.initialDetectionMs = SystemClock.elapsedRealtime() - initialDetectionStartedAtMs;
            performanceMetrics.totalPreflightMs = SystemClock.elapsedRealtime() - preflightStartedAtMs;
            WritableMap result = Arguments.createMap();
            result.putString("previewFramePath", previewFramePath == null ? "" : previewFramePath);
            result.putInt("frameWidthPx", frame.getWidth());
            result.putInt("frameHeightPx", frame.getHeight());
            result.putString("trackerVersion", TRACKER_VERSION);
            result.putArray("candidates", toSeedCandidatesArray(candidates));
            promise.resolve(result);
        } catch (Exception error) {
            promise.reject(ERR_VIDEO_ANALYSIS_PREVIEW, error);
        } finally {
            performanceMetrics.totalPreflightMs = SystemClock.elapsedRealtime() - preflightStartedAtMs;
            logPerformanceMetrics("prepareSquatVideoSeed", analysisId, performanceMetrics);
            if (detectionContext != null) {
                detectionContext.release();
            }
            if (frame != null) {
                frame.recycle();
            }
            try {
                retriever.release();
            } catch (Exception ignored) {
                // No-op.
            }
        }
    }

    @ReactMethod
    public void analyzeSquatVideo(String localVideoPath, int analysisId, ReadableMap manualSeed, Promise promise) {
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        AnalysisPerformanceMetrics performanceMetrics = new AnalysisPerformanceMetrics();
        long analysisStartedAtMs = SystemClock.elapsedRealtime();
        Bitmap firstFrame = null;
        DetectionContext detectionContext = null;
        try {
            File rootDir = ensureVideoAnalysisRootDir();
            File resultsDir = new File(rootDir, "results");
            if (!resultsDir.exists() && !resultsDir.mkdirs()) {
                promise.reject(ERR_VIDEO_ANALYSIS_DIR, "Could not create video analysis result directory");
                return;
            }

            long previewStartedAtMs = SystemClock.elapsedRealtime();
            String previewFramePath = writePreviewFrame(localVideoPath, analysisId, rootDir);
            performanceMetrics.previewFrameWriteMs = SystemClock.elapsedRealtime() - previewStartedAtMs;
            retriever.setDataSource(localVideoPath);
            long initialFrameReadStartedAtMs = SystemClock.elapsedRealtime();
            firstFrame = retriever.getFrameAtTime(0, MediaMetadataRetriever.OPTION_CLOSEST_SYNC);
            performanceMetrics.initialFrameReadMs = SystemClock.elapsedRealtime() - initialFrameReadStartedAtMs;
            if (firstFrame == null) {
                promise.reject(ERR_VIDEO_ANALYSIS, "Could not read first frame");
                return;
            }

            detectionContext = createDetectionContext();
            long initialDetectionStartedAtMs = SystemClock.elapsedRealtime();
            List<DetectionCandidate> initialCandidates = detectCandidates(firstFrame, detectionContext, performanceMetrics);
            performanceMetrics.initialDetectionMs = SystemClock.elapsedRealtime() - initialDetectionStartedAtMs;
            SeedSelection manualSelection = parseManualSeed(manualSeed);
            SeedSelection activeSeed = resolveSeedSelection(initialCandidates, manualSelection);

            if (activeSeed == null) {
                if (initialCandidates.isEmpty()) {
                    promise.reject(ERR_VIDEO_ANALYSIS_NO_CANDIDATE, "No outer_plate candidate detected at t=0");
                    return;
                }
                String message = MANUAL_SEED_REQUIRED_PREFIX + (previewFramePath == null ? "" : previewFramePath);
                promise.reject(ERR_VIDEO_ANALYSIS_NEEDS_MANUAL_SEED, message);
                return;
            }

            long durationMetadataStartedAtMs = SystemClock.elapsedRealtime();
            long durationMs = extractDurationMs(localVideoPath);
            performanceMetrics.durationMetadataMs = SystemClock.elapsedRealtime() - durationMetadataStartedAtMs;

            long sourceFpsMetadataStartedAtMs = SystemClock.elapsedRealtime();
            double sourceFps = extractSourceFps(localVideoPath);
            performanceMetrics.sourceFpsMetadataMs = SystemClock.elapsedRealtime() - sourceFpsMetadataStartedAtMs;

            double analyzedFps = resolveAnalyzedFps(durationMs, sourceFps);
            performanceMetrics.analyzedFps = analyzedFps;
            Log.i(
                LOG_TAG,
                "analyzeSquatVideo start analysisId="
                    + analysisId
                    + " durationMs="
                    + durationMs
                    + " sourceFps="
                    + roundTo3(sourceFps)
                    + " analyzedFps="
                    + roundTo3(analyzedFps)
            );
            TrackingSeries trackingSeries = extractTrackedSeries(
                analysisId,
                localVideoPath,
                durationMs,
                activeSeed,
                analyzedFps,
                detectionContext,
                performanceMetrics
            );

            if (trackingSeries.barPathSeries.length() < 2) {
                promise.reject(ERR_VIDEO_ANALYSIS, "Not enough tracked points for a valid result");
                return;
            }

            JSONObject result = new JSONObject();
            result.put("analysisId", analysisId);
            result.put("units", "px/s");
            result.put("barPathSeries", trackingSeries.barPathSeries);
            result.put("confidenceSeries", trackingSeries.confidenceSeries);
            JSONArray detectedRepMetrics = new JSONArray();
            JSONArray detectedRepSegments = detectRepSegments(trackingSeries.barPathSeries, detectedRepMetrics);
            result.put("repSegments", detectedRepSegments);
            result.put("repMetrics", detectedRepMetrics);

            JSONObject analysisMeta = new JSONObject();
            analysisMeta.put("sourceFps", roundTo3(sourceFps));
            analysisMeta.put("analyzedFps", roundTo3(analyzedFps));
            analysisMeta.put("trackerVersion", TRACKER_VERSION);
            analysisMeta.put("frameCount", trackingSeries.frameCount);
            analysisMeta.put("averageConfidence", roundTo3(trackingSeries.averageConfidence));
            analysisMeta.put("trackingFrameWidthPx", trackingSeries.frameWidthPx);
            analysisMeta.put("trackingFrameHeightPx", trackingSeries.frameHeightPx);
            analysisMeta.put("manualSeedUsed", manualSelection != null);
            analysisMeta.put("initialSeedBox", activeSeed.toJsonBox());
            analysisMeta.put("detectedBoxesAtStart", toCandidatesJson(initialCandidates));
            analysisMeta.put("plausibilityRejections", trackingSeries.plausibilityRejections);
            performanceMetrics.totalAnalysisMs = SystemClock.elapsedRealtime() - analysisStartedAtMs;
            analysisMeta.put("performanceMetrics", performanceMetrics.toJson());
            result.put("analysisMeta", analysisMeta);

            JSONArray qualityFlags = new JSONArray();
            qualityFlags.put("ANALYSIS_NATIVE_TFLITE_YOLO26");
            qualityFlags.put("MODEL_ASSET:" + MODEL_ASSET_PATH);
            qualityFlags.put("CONF_THRESHOLD:" + DETECTION_CONFIDENCE_THRESHOLD);
            qualityFlags.put("NMS_IOU:" + NMS_IOU_THRESHOLD);
            qualityFlags.put("BOX_FORMAT:xyxy");
            qualityFlags.put("PLAUSIBILITY_MAX_JUMP:" + PLAUSIBILITY_MAX_JUMP_NORMALIZED);
            qualityFlags.put("ANALYZED_FPS:" + roundTo3(analyzedFps));
            qualityFlags.put(previewFramePath == null ? "PREVIEW_FRAME_MISSING" : "PREVIEW_FRAME_READY");
            if (manualSelection != null) {
                qualityFlags.put("MANUAL_SEED_USED");
            }
            if (trackingSeries.skippedImplausibleFrames > 0) {
                qualityFlags.put("PLAUSIBILITY_SKIPPED_FRAMES:" + trackingSeries.skippedImplausibleFrames);
            }
            result.put("qualityFlags", qualityFlags);

            File resultFile = new File(resultsDir, "analysis-" + analysisId + ".json");
            FileWriter writer = new FileWriter(resultFile);
            writer.write(result.toString(2));
            writer.close();
            promise.resolve(resultFile.getAbsolutePath());
        } catch (Exception error) {
            promise.reject(ERR_VIDEO_ANALYSIS, error);
        } finally {
            performanceMetrics.totalAnalysisMs = SystemClock.elapsedRealtime() - analysisStartedAtMs;
            logPerformanceMetrics("analyzeSquatVideo", analysisId, performanceMetrics);
            if (detectionContext != null) {
                detectionContext.release();
            }
            if (firstFrame != null) {
                firstFrame.recycle();
            }
            try {
                retriever.release();
            } catch (Exception ignored) {
                // No-op.
            }
        }
    }

    private File ensureVideoAnalysisRootDir() {
        File documentDir = getReactApplicationContext().getFilesDir();
        File rootDir = new File(documentDir, "video-analysis");
        if (!rootDir.exists() && !rootDir.mkdirs()) {
            throw new IllegalStateException("Could not create video analysis directory");
        }
        return rootDir;
    }

    private WritableArray toSeedCandidatesArray(List<DetectionCandidate> candidates) {
        WritableArray array = Arguments.createArray();
        for (DetectionCandidate candidate : candidates) {
            WritableMap item = Arguments.createMap();
            item.putString("id", candidate.id);
            item.putDouble("normalizedX", candidate.normalizedX);
            item.putDouble("normalizedY", candidate.normalizedY);
            item.putDouble("normalizedWidth", candidate.normalizedWidth);
            item.putDouble("normalizedHeight", candidate.normalizedHeight);
            item.putDouble("score", candidate.score);
            array.pushMap(item);
        }
        return array;
    }

    private JSONArray toCandidatesJson(List<DetectionCandidate> candidates) throws Exception {
        JSONArray array = new JSONArray();
        for (DetectionCandidate candidate : candidates) {
            array.put(candidate.toJsonBox());
        }
        return array;
    }

    private String writePreviewFrame(String localVideoPath, int analysisId, File rootDir) {
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        FileOutputStream outputStream = null;
        Bitmap frame = null;
        try {
            File previewDir = new File(rootDir, "previews");
            if (!previewDir.exists() && !previewDir.mkdirs()) {
                return null;
            }

            retriever.setDataSource(localVideoPath);
            frame = retriever.getFrameAtTime(0, MediaMetadataRetriever.OPTION_CLOSEST_SYNC);
            if (frame == null) {
                return null;
            }

            File previewFile = new File(previewDir, "analysis-" + analysisId + ".jpg");
            outputStream = new FileOutputStream(previewFile);
            if (!frame.compress(Bitmap.CompressFormat.JPEG, 90, outputStream)) {
                return null;
            }
            outputStream.flush();
            return previewFile.getAbsolutePath();
        } catch (Exception ignored) {
            return null;
        } finally {
            if (frame != null) {
                frame.recycle();
            }
            if (outputStream != null) {
                try {
                    outputStream.close();
                } catch (Exception ignored) {
                    // No-op.
                }
            }
            try {
                retriever.release();
            } catch (Exception ignored) {
                // No-op.
            }
        }
    }

    private long extractDurationMs(String localVideoPath) {
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        try {
            retriever.setDataSource(localVideoPath);
            String duration = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
            if (duration == null) {
                return DEFAULT_DURATION_MS;
            }
            return Long.parseLong(duration);
        } catch (Exception ignored) {
            return DEFAULT_DURATION_MS;
        } finally {
            try {
                retriever.release();
            } catch (Exception ignored) {
                // No-op.
            }
        }
    }

    private double extractSourceFps(String localVideoPath) {
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        try {
            retriever.setDataSource(localVideoPath);
            String captureFps = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_CAPTURE_FRAMERATE);
            if (captureFps == null || captureFps.isEmpty()) {
                return DEFAULT_SOURCE_FPS;
            }
            return Double.parseDouble(captureFps);
        } catch (Exception ignored) {
            return DEFAULT_SOURCE_FPS;
        } finally {
            try {
                retriever.release();
            } catch (Exception ignored) {
                // No-op.
            }
        }
    }

    private int extractVideoRotationDegrees(String localVideoPath) {
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        try {
            retriever.setDataSource(localVideoPath);
            String rotation = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION);
            if (rotation == null || rotation.isEmpty()) {
                return 0;
            }
            return normalizeRotationDegrees(Integer.parseInt(rotation));
        } catch (Exception ignored) {
            return 0;
        } finally {
            try {
                retriever.release();
            } catch (Exception ignored) {
                // No-op.
            }
        }
    }

    private double resolveAnalyzedFps(long durationMs, double sourceFps) {
        if (sourceFps > 0.0) {
            return Math.min(sourceFps, FIXED_ANALYZED_FPS);
        }
        return FIXED_ANALYZED_FPS;
    }

    private long[] buildSampleTimesUs(long durationMs, double analyzedFps) {
        int sampleCount = (int) Math.round((durationMs / 1000.0) * analyzedFps);
        if (sampleCount < 2) {
            sampleCount = 2;
        }

        long[] sampleTimesUs = new long[sampleCount];
        for (int sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
            long timeMs = sampleCount <= 1
                ? 0L
                : Math.round((sampleIndex * durationMs) / (double) (sampleCount - 1));
            sampleTimesUs[sampleIndex] = timeMs * 1000L;
        }
        return sampleTimesUs;
    }

    private SeedSelection parseManualSeed(ReadableMap manualSeed) {
        if (manualSeed == null) {
            return null;
        }
        if (
            !manualSeed.hasKey("normalizedX") ||
            !manualSeed.hasKey("normalizedY") ||
            !manualSeed.hasKey("normalizedWidth") ||
            !manualSeed.hasKey("normalizedHeight")
        ) {
            return null;
        }

        SeedSelection selection = new SeedSelection();
        if (manualSeed.hasKey("candidateId")) {
            selection.candidateId = manualSeed.getString("candidateId");
        }
        selection.normalizedX = clamp(manualSeed.getDouble("normalizedX"), 0.0, 1.0);
        selection.normalizedY = clamp(manualSeed.getDouble("normalizedY"), 0.0, 1.0);
        selection.normalizedWidth = clamp(manualSeed.getDouble("normalizedWidth"), 0.01, 1.0);
        selection.normalizedHeight = clamp(manualSeed.getDouble("normalizedHeight"), 0.01, 1.0);
        return selection;
    }

    private SeedSelection resolveSeedSelection(List<DetectionCandidate> candidates, SeedSelection manualSeed) {
        if (manualSeed != null) {
            return manualSeed;
        }
        if (candidates.size() != 1) {
            return null;
        }

        DetectionCandidate candidate = candidates.get(0);
        SeedSelection selection = new SeedSelection();
        selection.candidateId = candidate.id;
        selection.normalizedX = candidate.normalizedX;
        selection.normalizedY = candidate.normalizedY;
        selection.normalizedWidth = candidate.normalizedWidth;
        selection.normalizedHeight = candidate.normalizedHeight;
        return selection;
    }

    private TrackingSeries extractTrackedSeries(
        int analysisId,
        String localVideoPath,
        long durationMs,
        SeedSelection seed,
        double analyzedFps,
        DetectionContext detectionContext,
        AnalysisPerformanceMetrics performanceMetrics
    ) throws Exception {
        try {
            return extractTrackedSeriesWithDecoder(
                analysisId,
                localVideoPath,
                durationMs,
                seed,
                analyzedFps,
                detectionContext,
                performanceMetrics
            );
        } catch (Exception decoderError) {
            Log.w(LOG_TAG, "CPU decoder failed, falling back to MediaMetadataRetriever", decoderError);
            return extractTrackedSeriesWithRetriever(
                analysisId,
                localVideoPath,
                durationMs,
                seed,
                analyzedFps,
                detectionContext,
                performanceMetrics
            );
        }
    }

    private TrackingSeries extractTrackedSeriesWithRetriever(
        int analysisId,
        String localVideoPath,
        long durationMs,
        SeedSelection seed,
        double analyzedFps,
        DetectionContext detectionContext,
        AnalysisPerformanceMetrics performanceMetrics
    ) throws Exception {
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        try {
            retriever.setDataSource(localVideoPath);

            long trackingStartedAtMs = SystemClock.elapsedRealtime();
            long[] sampleTimesUs = buildSampleTimesUs(durationMs, analyzedFps);
            int sampleCount = sampleTimesUs.length;
            performanceMetrics.plannedSampleCount = sampleCount;

            TrackingSeries series = new TrackingSeries();
            series.barPathSeries = new JSONArray();
            series.confidenceSeries = new JSONArray();
            series.plausibilityRejections = new JSONArray();
            series.frameCount = 0;
            series.frameWidthPx = 0;
            series.frameHeightPx = 0;

            double accumulatedConfidence = 0.0;
            int confidenceCount = 0;

            DetectionSample lastAcceptedSample = new DetectionSample();
            lastAcceptedSample.normalizedX = seed.normalizedX;
            lastAcceptedSample.normalizedY = seed.normalizedY;

            for (int sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
                int timeMs = (int) Math.round(sampleTimesUs[sampleIndex] / 1000.0);

                performanceMetrics.sampleAttemptCount += 1;
                long frameExtractionStartedAtNs = SystemClock.elapsedRealtimeNanos();
                Bitmap frame = retriever.getFrameAtTime(timeMs * 1000L, MediaMetadataRetriever.OPTION_CLOSEST);
                performanceMetrics.frameExtractionMs += elapsedMs(frameExtractionStartedAtNs);
                if (frame == null) {
                    performanceMetrics.nullFrameCount += 1;
                    continue;
                }

                try {
                    performanceMetrics.decodedFrameCount += 1;
                    if (series.frameWidthPx == 0 || series.frameHeightPx == 0) {
                        series.frameWidthPx = frame.getWidth();
                        series.frameHeightPx = frame.getHeight();
                    }

                    List<DetectionCandidate> candidates = detectCandidates(frame, detectionContext, performanceMetrics);
                    DetectionCandidate selected = selectHighestConfidenceCandidate(candidates);
                    if (selected == null) {
                        performanceMetrics.noCandidateFrameCount += 1;
                        continue;
                    }

                    if (!isPlausibleJump(lastAcceptedSample, selected)) {
                        series.skippedImplausibleFrames += 1;
                        performanceMetrics.implausibleFrameCount += 1;
                        recordPlausibilityRejection(series, sampleIndex, timeMs, lastAcceptedSample, selected);
                        continue;
                    }

                    double score = selected.score;
                    double centerX = selected.normalizedX;
                    double centerY = selected.normalizedY;

                    lastAcceptedSample = new DetectionSample();
                    lastAcceptedSample.normalizedX = centerX;
                    lastAcceptedSample.normalizedY = centerY;

                    JSONObject barPoint = new JSONObject();
                    barPoint.put("tMs", timeMs);
                    barPoint.put("x", roundTo3(centerX * series.frameWidthPx));
                    barPoint.put("y", roundTo3(centerY * series.frameHeightPx));
                    series.barPathSeries.put(barPoint);

                    JSONObject confidencePoint = new JSONObject();
                    confidencePoint.put("tMs", timeMs);
                    confidencePoint.put("score", roundTo3(score));
                    series.confidenceSeries.put(confidencePoint);

                    accumulatedConfidence += score;
                    confidenceCount += 1;
                    series.frameCount += 1;
                    performanceMetrics.acceptedFrameCount += 1;
                    if ((sampleIndex + 1) % 10 == 0 || sampleIndex == sampleCount - 1) {
                        logTrackingProgress(analysisId, sampleIndex + 1, sampleCount, performanceMetrics);
                    }
                } finally {
                    frame.recycle();
                }
            }

            series.averageConfidence = confidenceCount == 0 ? 0.0 : accumulatedConfidence / confidenceCount;
            performanceMetrics.trackingMs = SystemClock.elapsedRealtime() - trackingStartedAtMs;
            return series;
        } finally {
            try {
                retriever.release();
            } catch (Exception ignored) {
                // No-op.
            }
        }
    }

    private TrackingSeries extractTrackedSeriesWithDecoder(
        int analysisId,
        String localVideoPath,
        long durationMs,
        SeedSelection seed,
        double analyzedFps,
        DetectionContext detectionContext,
        AnalysisPerformanceMetrics performanceMetrics
    ) throws Exception {
        MediaExtractor extractor = new MediaExtractor();
        MediaCodec decoder = null;
        try {
            long[] sampleTimesUs = buildSampleTimesUs(durationMs, analyzedFps);
            performanceMetrics.plannedSampleCount = sampleTimesUs.length;

            long decoderSetupStartedAtMs = SystemClock.elapsedRealtime();
            extractor.setDataSource(localVideoPath);
            int videoTrackIndex = findVideoTrackIndex(extractor);
            if (videoTrackIndex < 0) {
                throw new IllegalStateException("Could not find video track for sequential decode");
            }

            extractor.selectTrack(videoTrackIndex);
            MediaFormat format = extractor.getTrackFormat(videoTrackIndex);
            String mime = format.getString(MediaFormat.KEY_MIME);
            if (mime == null || !mime.startsWith("video/")) {
                throw new IllegalStateException("Unsupported video mime type: " + mime);
            }

            int rotationDegrees = resolveRotationDegrees(localVideoPath, format);
            format.setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible);
            decoder = MediaCodec.createDecoderByType(mime);
            decoder.configure(format, null, null, 0);
            decoder.start();
            performanceMetrics.decoderSetupMs = SystemClock.elapsedRealtime() - decoderSetupStartedAtMs;

            TrackingSeries series = new TrackingSeries();
            series.barPathSeries = new JSONArray();
            series.confidenceSeries = new JSONArray();
            series.plausibilityRejections = new JSONArray();
            series.frameCount = 0;
            series.frameWidthPx = 0;
            series.frameHeightPx = 0;

            double accumulatedConfidence = 0.0;
            int confidenceCount = 0;
            long trackingStartedAtMs = SystemClock.elapsedRealtime();

            DetectionSample lastAcceptedSample = new DetectionSample();
            lastAcceptedSample.normalizedX = seed.normalizedX;
            lastAcceptedSample.normalizedY = seed.normalizedY;

            MediaCodec.BufferInfo bufferInfo = new MediaCodec.BufferInfo();
            boolean inputEnded = false;
            boolean outputEnded = false;
            int nextSampleIndex = 0;

            while (!outputEnded && nextSampleIndex < sampleTimesUs.length) {
                if (!inputEnded) {
                    long queueStartedAtNs = SystemClock.elapsedRealtimeNanos();
                    inputEnded = queueDecoderInputSample(extractor, decoder, performanceMetrics);
                    performanceMetrics.decoderQueueInputMs += elapsedMs(queueStartedAtNs);
                }

                long dequeueStartedAtNs = SystemClock.elapsedRealtimeNanos();
                int outputIndex = decoder.dequeueOutputBuffer(bufferInfo, DECODER_TIMEOUT_US);
                performanceMetrics.decoderDequeueOutputMs += elapsedMs(dequeueStartedAtNs);

                if (outputIndex == MediaCodec.INFO_TRY_AGAIN_LATER) {
                    continue;
                }
                if (outputIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    continue;
                }
                if (outputIndex < 0) {
                    continue;
                }

                boolean isEndOfStream = (bufferInfo.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0;
                if (bufferInfo.size <= 0) {
                    decoder.releaseOutputBuffer(outputIndex, false);
                    outputEnded = isEndOfStream;
                    continue;
                }

                performanceMetrics.dequeuedOutputFrameCount += 1;
                long presentationTimeUs = bufferInfo.presentationTimeUs;
                if (nextSampleIndex >= sampleTimesUs.length || presentationTimeUs < sampleTimesUs[nextSampleIndex]) {
                    performanceMetrics.skippedDecodedFrameCount += 1;
                    decoder.releaseOutputBuffer(outputIndex, false);
                    outputEnded = isEndOfStream;
                    continue;
                }

                Image image = decoder.getOutputImage(outputIndex);
                if (image == null) {
                    performanceMetrics.nullFrameCount += 1;
                    decoder.releaseOutputBuffer(outputIndex, false);
                    outputEnded = isEndOfStream;
                    continue;
                }

                try {
                    performanceMetrics.sampleAttemptCount += 1;
                    performanceMetrics.processedOutputFrameCount += 1;

                    // Direct YUV→letterboxed float conversion (no intermediate Bitmap).
                    // Processes only 320×320 target pixels instead of the full encoded frame.
                    long conversionStartedAtNs = SystemClock.elapsedRealtimeNanos();
                    imageToLetterboxedFloatDirect(image, rotationDegrees, detectionContext);
                    double conversionMs = elapsedMs(conversionStartedAtNs);
                    performanceMetrics.frameExtractionMs += conversionMs;
                    performanceMetrics.frameConversionMs += conversionMs;
                    performanceMetrics.decodedFrameCount += 1;

                    if (series.frameWidthPx == 0 || series.frameHeightPx == 0) {
                        series.frameWidthPx = detectionContext.letterboxParams.sourceWidth;
                        series.frameHeightPx = detectionContext.letterboxParams.sourceHeight;
                    }

                    List<DetectionCandidate> candidates = detectCandidatesFromContext(detectionContext, performanceMetrics);
                    DetectionCandidate selected = selectHighestConfidenceCandidate(candidates);
                    int timeMs = (int) Math.round(sampleTimesUs[nextSampleIndex] / 1000.0);

                    if (selected == null) {
                        performanceMetrics.noCandidateFrameCount += 1;
                    } else if (!isPlausibleJump(lastAcceptedSample, selected)) {
                        series.skippedImplausibleFrames += 1;
                        performanceMetrics.implausibleFrameCount += 1;
                        recordPlausibilityRejection(
                            series,
                            nextSampleIndex,
                            timeMs,
                            lastAcceptedSample,
                            selected
                        );
                    } else {
                        double score = selected.score;
                        double centerX = selected.normalizedX;
                        double centerY = selected.normalizedY;

                        lastAcceptedSample = new DetectionSample();
                        lastAcceptedSample.normalizedX = centerX;
                        lastAcceptedSample.normalizedY = centerY;

                        JSONObject barPoint = new JSONObject();
                        barPoint.put("tMs", timeMs);
                        barPoint.put("x", roundTo3(centerX * series.frameWidthPx));
                        barPoint.put("y", roundTo3(centerY * series.frameHeightPx));
                        series.barPathSeries.put(barPoint);

                        JSONObject confidencePoint = new JSONObject();
                        confidencePoint.put("tMs", timeMs);
                        confidencePoint.put("score", roundTo3(score));
                        series.confidenceSeries.put(confidencePoint);

                        accumulatedConfidence += score;
                        confidenceCount += 1;
                        series.frameCount += 1;
                        performanceMetrics.acceptedFrameCount += 1;
                    }

                    if ((nextSampleIndex + 1) % 10 == 0 || nextSampleIndex == sampleTimesUs.length - 1) {
                        logTrackingProgress(analysisId, nextSampleIndex + 1, sampleTimesUs.length, performanceMetrics);
                    }
                    nextSampleIndex += 1;
                } finally {
                    image.close();
                    decoder.releaseOutputBuffer(outputIndex, false);
                    outputEnded = isEndOfStream;
                }
            }

            series.averageConfidence = confidenceCount == 0 ? 0.0 : accumulatedConfidence / confidenceCount;
            performanceMetrics.trackingMs = SystemClock.elapsedRealtime() - trackingStartedAtMs;
            return series;
        } finally {
            if (decoder != null) {
                try {
                    decoder.stop();
                } catch (Exception ignored) {
                    // No-op.
                }
                try {
                    decoder.release();
                } catch (Exception ignored) {
                    // No-op.
                }
            }
            try {
                extractor.release();
            } catch (Exception ignored) {
                // No-op.
            }
        }
    }

    private int findVideoTrackIndex(MediaExtractor extractor) {
        for (int trackIndex = 0; trackIndex < extractor.getTrackCount(); trackIndex++) {
            MediaFormat format = extractor.getTrackFormat(trackIndex);
            String mime = format.getString(MediaFormat.KEY_MIME);
            if (mime != null && mime.startsWith("video/")) {
                return trackIndex;
            }
        }
        return -1;
    }

    private boolean queueDecoderInputSample(
        MediaExtractor extractor,
        MediaCodec decoder,
        AnalysisPerformanceMetrics performanceMetrics
    ) {
        int inputIndex = decoder.dequeueInputBuffer(DECODER_TIMEOUT_US);
        if (inputIndex < 0) {
            return false;
        }

        ByteBuffer inputBuffer = decoder.getInputBuffer(inputIndex);
        if (inputBuffer == null) {
            decoder.queueInputBuffer(inputIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM);
            return true;
        }

        inputBuffer.clear();
        int sampleSize = extractor.readSampleData(inputBuffer, 0);
        if (sampleSize < 0) {
            decoder.queueInputBuffer(inputIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM);
            return true;
        }

        long sampleTimeUs = extractor.getSampleTime();
        decoder.queueInputBuffer(inputIndex, 0, sampleSize, sampleTimeUs, 0);
        performanceMetrics.queuedInputSampleCount += 1;
        extractor.advance();
        return false;
    }

    private int resolveRotationDegrees(String localVideoPath, MediaFormat format) {
        if (format.containsKey(MediaFormat.KEY_ROTATION)) {
            return normalizeRotationDegrees(format.getInteger(MediaFormat.KEY_ROTATION));
        }
        return extractVideoRotationDegrees(localVideoPath);
    }

    private DetectionCandidate selectHighestConfidenceCandidate(List<DetectionCandidate> candidates) {
        if (candidates.isEmpty()) {
            return null;
        }
        return candidates.get(0);
    }

    private boolean isPlausibleJump(DetectionSample previousSample, DetectionCandidate candidate) {
        if (previousSample == null || candidate == null) {
            return true;
        }

        double deltaX = candidate.normalizedX - previousSample.normalizedX;
        double deltaY = candidate.normalizedY - previousSample.normalizedY;
        double jumpDistance = Math.hypot(deltaX, deltaY);
        return jumpDistance <= PLAUSIBILITY_MAX_JUMP_NORMALIZED;
    }

    private void recordPlausibilityRejection(
        TrackingSeries series,
        int sampleIndex,
        int timeMs,
        DetectionSample previousSample,
        DetectionCandidate candidate
    ) throws Exception {
        if (series == null || previousSample == null || candidate == null) {
            return;
        }
        if (series.plausibilityRejections.length() >= MAX_PLAUSIBILITY_REJECTIONS_DEBUG) {
            return;
        }

        double deltaX = candidate.normalizedX - previousSample.normalizedX;
        double deltaY = candidate.normalizedY - previousSample.normalizedY;
        double jumpDistance = Math.hypot(deltaX, deltaY);
        double axisJumpX = Math.abs(deltaX);
        double axisJumpY = Math.abs(deltaY);

        JSONObject rejection = new JSONObject();
        rejection.put("sampleIndex", sampleIndex);
        rejection.put("tMs", timeMs);
        rejection.put("previousX", roundTo3(previousSample.normalizedX));
        rejection.put("previousY", roundTo3(previousSample.normalizedY));
        rejection.put("candidateX", roundTo3(candidate.normalizedX));
        rejection.put("candidateY", roundTo3(candidate.normalizedY));
        rejection.put("deltaX", roundTo3(deltaX));
        rejection.put("deltaY", roundTo3(deltaY));
        rejection.put("axisJumpX", roundTo3(axisJumpX));
        rejection.put("axisJumpY", roundTo3(axisJumpY));
        rejection.put("jumpDistance", roundTo3(jumpDistance));
        rejection.put("threshold", roundTo3(PLAUSIBILITY_MAX_JUMP_NORMALIZED));
        rejection.put("reason", "jump_distance");
        rejection.put("score", roundTo3(candidate.score));
        series.plausibilityRejections.put(rejection);
    }

    private DetectionContext createDetectionContext() throws IOException {
        Interpreter activeInterpreter = getOrCreateInterpreter();

        // Accept float32 or uint8/int8 output — TFLite auto-dequantizes to float when a
        // float output array is provided, so rawOutput can always be float[][][].
        Tensor outputTensor = activeInterpreter.getOutputTensor(0);
        DataType outputDtype = outputTensor.dataType();
        if (outputDtype != DataType.FLOAT32 && outputDtype != DataType.INT8 && outputDtype != DataType.UINT8) {
            throw new IllegalStateException("Unsupported output dtype: " + outputDtype);
        }

        int[] shape = outputTensor.shape();
        if (shape.length != 3 || shape[0] != 1) {
            throw new IllegalStateException("Unsupported output shape rank for YOLO model");
        }

        // Check input dtype: full-integer-quantized models use UINT8 input (1 byte/channel).
        // Dynamic-range or float-fallback models use FLOAT32 (4 bytes/channel).
        Tensor inputTensor = activeInterpreter.getInputTensor(0);
        boolean isUint8Input = inputTensor.dataType() == DataType.UINT8;
        int bytesPerChannel = isUint8Input ? 1 : 4;
        Log.i(LOG_TAG, "Model input dtype=" + inputTensor.dataType()
                + " output dtype=" + outputDtype
                + " isUint8Input=" + isUint8Input);

        DetectionContext detectionContext = new DetectionContext();
        detectionContext.interpreter = activeInterpreter;
        detectionContext.outputShape = shape.clone();
        detectionContext.isUint8Input = isUint8Input;
        detectionContext.letterboxBitmap = Bitmap.createBitmap(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, Bitmap.Config.ARGB_8888);
        detectionContext.letterboxCanvas = new Canvas(detectionContext.letterboxBitmap);
        detectionContext.inputBuffer = ByteBuffer.allocateDirect(bytesPerChannel * MODEL_INPUT_SIZE * MODEL_INPUT_SIZE * 3);
        detectionContext.inputBuffer.order(ByteOrder.nativeOrder());
        detectionContext.pixels = new int[MODEL_INPUT_SIZE * MODEL_INPUT_SIZE];
        detectionContext.rawOutput = new float[shape[0]][shape[1]][shape[2]];
        detectionContext.sourceRect = new Rect();
        detectionContext.destinationRect = new RectF();
        detectionContext.letterboxParams = new LetterboxParams();
        return detectionContext;
    }

    private List<DetectionCandidate> detectCandidates(Bitmap frame, DetectionContext detectionContext, AnalysisPerformanceMetrics performanceMetrics)
        throws Exception {
        if (frame == null || frame.getWidth() <= 0 || frame.getHeight() <= 0) {
            return Collections.emptyList();
        }

        if (detectionContext == null) {
            throw new IllegalArgumentException("DetectionContext is required");
        }

        long detectStartedAtNs = SystemClock.elapsedRealtimeNanos();
        long letterboxStartedAtNs = SystemClock.elapsedRealtimeNanos();
        createLetterboxedInput(frame, detectionContext);
        performanceMetrics.letterboxMs += elapsedMs(letterboxStartedAtNs);

        long inputTensorStartedAtNs = SystemClock.elapsedRealtimeNanos();
        ByteBuffer inputBuffer = bitmapToModelInput(detectionContext.letterboxBitmap, detectionContext);
        performanceMetrics.inputTensorMs += elapsedMs(inputTensorStartedAtNs);

        long inferenceStartedAtNs = SystemClock.elapsedRealtimeNanos();
        detectionContext.interpreter.run(inputBuffer, detectionContext.rawOutput);
        performanceMetrics.inferenceMs += elapsedMs(inferenceStartedAtNs);
        performanceMetrics.gpuDelegateUsed = (gpuDelegate != null);

        long candidateDecodeStartedAtNs = SystemClock.elapsedRealtimeNanos();
        List<DetectionCandidate> decoded = decodeCandidates(detectionContext.rawOutput);
        List<DetectionCandidate> nmsCandidates = applyNms(decoded);
        List<DetectionCandidate> mappedCandidates = mapCandidatesFromLetterbox(nmsCandidates, detectionContext.letterboxParams);
        performanceMetrics.candidateDecodeMs += elapsedMs(candidateDecodeStartedAtNs);
        performanceMetrics.detectionCallCount += 1;
        performanceMetrics.totalDetectionMs += elapsedMs(detectStartedAtNs);
        return mappedCandidates;
    }

    /**
     * Directly converts a YUV {@link Image} to a letterboxed 320×320 float RGB buffer
     * suitable for TFLite inference — in a single pass over only 320×320 = 102K output pixels.
     *
     * Replaces the three-step chain: imageToBitmap (2M pixels) → Canvas letterbox → getPixels + float conversion.
     * Expected speedup: ~20× versus the full-resolution intermediate Bitmap path.
     *
     * After this call {@code detectionContext.inputBuffer} is rewound and ready for
     * {@link Interpreter#run}, and {@code detectionContext.letterboxParams} holds the
     * unmap parameters for candidate post-processing.
     */
    private void imageToLetterboxedFloatDirect(
        Image image, int rotationDegrees, DetectionContext detectionContext) {

        int encodedWidth  = image.getWidth();
        int encodedHeight = image.getHeight();
        int normalizedRotation = normalizeRotationDegrees(rotationDegrees);
        boolean swap = normalizedRotation == 90 || normalizedRotation == 270;
        int logicalWidth  = swap ? encodedHeight : encodedWidth;
        int logicalHeight = swap ? encodedWidth  : encodedHeight;

        double scale = Math.min(MODEL_INPUT_SIZE / (double) logicalWidth,
                                MODEL_INPUT_SIZE / (double) logicalHeight);
        int scaledW  = Math.max(1, (int) Math.round(logicalWidth  * scale));
        int scaledH  = Math.max(1, (int) Math.round(logicalHeight * scale));
        double padX  = (MODEL_INPUT_SIZE - scaledW) / 2.0;
        double padY  = (MODEL_INPUT_SIZE - scaledH) / 2.0;

        LetterboxParams params = detectionContext.letterboxParams;
        params.sourceWidth  = logicalWidth;
        params.sourceHeight = logicalHeight;
        params.scale        = scale;
        params.padX         = padX;
        params.padY         = padY;

        Image.Plane[] planes = image.getPlanes();
        ByteBuffer yBuf  = planes[0].getBuffer();
        ByteBuffer uBuf  = planes[1].getBuffer();
        ByteBuffer vBuf  = planes[2].getBuffer();
        int yRowStride   = planes[0].getRowStride();
        int yPixelStride = planes[0].getPixelStride();
        int uRowStride   = planes[1].getRowStride();
        int uPixelStride = planes[1].getPixelStride();
        int vRowStride   = planes[2].getRowStride();
        int vPixelStride = planes[2].getPixelStride();

        // Copy YUV planes to Java byte[] so the JIT can eliminate bounds checks and avoid
        // JNI overhead from ByteBuffer.get(int) on native memory.  The bulk copy is a single
        // sequential memcpy (~0.5 ms for 3 MB) and makes per-pixel access ~5–10× faster.
        int yCapacity = yBuf.capacity();
        int uCapacity = uBuf.capacity();
        int vCapacity = vBuf.capacity();
        if (detectionContext.yPlaneCache == null || detectionContext.yPlaneCache.length < yCapacity) {
            detectionContext.yPlaneCache = new byte[yCapacity];
        }
        if (detectionContext.uPlaneCache == null || detectionContext.uPlaneCache.length < uCapacity) {
            detectionContext.uPlaneCache = new byte[uCapacity];
        }
        if (detectionContext.vPlaneCache == null || detectionContext.vPlaneCache.length < vCapacity) {
            detectionContext.vPlaneCache = new byte[vCapacity];
        }
        yBuf.rewind(); yBuf.get(detectionContext.yPlaneCache, 0, yCapacity);
        uBuf.rewind(); uBuf.get(detectionContext.uPlaneCache, 0, uCapacity);
        vBuf.rewind(); vBuf.get(detectionContext.vPlaneCache, 0, vCapacity);

        // Delegate the entire pixel-conversion loop to optimised C++ (NEON, no bounds-check
        // overhead, compiler auto-vectorisation).  The plane byte[] arrays are pinned in
        // place by GetPrimitiveArrayCritical — no extra copy happens here.
        nativeYuvToLetterboxedRgb(
                detectionContext.yPlaneCache, detectionContext.uPlaneCache, detectionContext.vPlaneCache,
                encodedWidth, encodedHeight,
                yRowStride, yPixelStride,
                uRowStride, uPixelStride,
                vRowStride, vPixelStride,
                normalizedRotation,
                logicalWidth, logicalHeight,
                padX, padY, scale,
                detectionContext.inputBuffer,
                detectionContext.isUint8Input);
        detectionContext.inputBuffer.rewind();
    }

    /**
     * Runs inference on {@code detectionContext.inputBuffer} (already filled) using the
     * letterbox parameters in {@code detectionContext.letterboxParams}.
     * Skips letterboxing and bitmap conversion — the caller has done that.
     */
    private List<DetectionCandidate> detectCandidatesFromContext(
        DetectionContext detectionContext,
        AnalysisPerformanceMetrics performanceMetrics
    ) throws Exception {
        long detectStartedAtNs = SystemClock.elapsedRealtimeNanos();

        detectionContext.inputBuffer.rewind();

        long inferenceStartedAtNs = SystemClock.elapsedRealtimeNanos();
        detectionContext.interpreter.run(detectionContext.inputBuffer, detectionContext.rawOutput);
        performanceMetrics.inferenceMs += elapsedMs(inferenceStartedAtNs);
        performanceMetrics.gpuDelegateUsed = (gpuDelegate != null);

        long candidateDecodeStartedAtNs = SystemClock.elapsedRealtimeNanos();
        List<DetectionCandidate> decoded = decodeCandidates(detectionContext.rawOutput);
        List<DetectionCandidate> nmsCandidates = applyNms(decoded);
        List<DetectionCandidate> mappedCandidates = mapCandidatesFromLetterbox(nmsCandidates, detectionContext.letterboxParams);
        performanceMetrics.candidateDecodeMs += elapsedMs(candidateDecodeStartedAtNs);
        performanceMetrics.detectionCallCount += 1;
        performanceMetrics.totalDetectionMs += elapsedMs(detectStartedAtNs);
        return mappedCandidates;
    }

    private Bitmap imageToBitmap(Image image, int rotationDegrees, DetectionContext detectionContext) {
        int sourceWidth = image.getWidth();
        int sourceHeight = image.getHeight();
        int normalizedRotation = normalizeRotationDegrees(rotationDegrees);
        boolean swapDimensions = normalizedRotation == 90 || normalizedRotation == 270;
        int outputWidth = swapDimensions ? sourceHeight : sourceWidth;
        int outputHeight = swapDimensions ? sourceWidth : sourceHeight;
        ensureFrameBitmapCapacity(detectionContext, outputWidth, outputHeight);

        Image.Plane[] planes = image.getPlanes();
        ByteBuffer yBuffer = planes[0].getBuffer();
        ByteBuffer uBuffer = planes[1].getBuffer();
        ByteBuffer vBuffer = planes[2].getBuffer();
        int yRowStride = planes[0].getRowStride();
        int yPixelStride = planes[0].getPixelStride();
        int uRowStride = planes[1].getRowStride();
        int uPixelStride = planes[1].getPixelStride();
        int vRowStride = planes[2].getRowStride();
        int vPixelStride = planes[2].getPixelStride();

        int[] pixels = detectionContext.framePixels;
        int pixelIndex = 0;
        for (int outputY = 0; outputY < outputHeight; outputY++) {
            for (int outputX = 0; outputX < outputWidth; outputX++) {
                int sourceX = outputX;
                int sourceY = outputY;
                switch (normalizedRotation) {
                    case 90:
                        sourceX = outputY;
                        sourceY = sourceHeight - 1 - outputX;
                        break;
                    case 180:
                        sourceX = sourceWidth - 1 - outputX;
                        sourceY = sourceHeight - 1 - outputY;
                        break;
                    case 270:
                        sourceX = sourceWidth - 1 - outputY;
                        sourceY = outputX;
                        break;
                    default:
                        break;
                }

                int yIndex = (sourceY * yRowStride) + (sourceX * yPixelStride);
                int uvX = sourceX / 2;
                int uvY = sourceY / 2;
                int uIndex = (uvY * uRowStride) + (uvX * uPixelStride);
                int vIndex = (uvY * vRowStride) + (uvX * vPixelStride);

                int y = yBuffer.get(yIndex) & 0xFF;
                int u = uBuffer.get(uIndex) & 0xFF;
                int v = vBuffer.get(vIndex) & 0xFF;
                pixels[pixelIndex] = yuvToArgb(y, u, v);
                pixelIndex += 1;
            }
        }

        detectionContext.frameBitmap.setPixels(pixels, 0, outputWidth, 0, 0, outputWidth, outputHeight);
        return detectionContext.frameBitmap;
    }

    private void ensureFrameBitmapCapacity(DetectionContext detectionContext, int width, int height) {
        if (
            detectionContext.frameBitmap != null &&
            detectionContext.frameBitmapWidth == width &&
            detectionContext.frameBitmapHeight == height
        ) {
            return;
        }

        if (detectionContext.frameBitmap != null && !detectionContext.frameBitmap.isRecycled()) {
            detectionContext.frameBitmap.recycle();
        }

        detectionContext.frameBitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        detectionContext.frameBitmapWidth = width;
        detectionContext.frameBitmapHeight = height;
        detectionContext.framePixels = new int[width * height];
    }

    private void createLetterboxedInput(Bitmap frame, DetectionContext detectionContext) {
        int sourceWidth = frame.getWidth();
        int sourceHeight = frame.getHeight();
        double scale = Math.min(
            MODEL_INPUT_SIZE / (double) sourceWidth,
            MODEL_INPUT_SIZE / (double) sourceHeight
        );

        int scaledWidth = Math.max(1, (int) Math.round(sourceWidth * scale));
        int scaledHeight = Math.max(1, (int) Math.round(sourceHeight * scale));
        double padX = (MODEL_INPUT_SIZE - scaledWidth) / 2.0;
        double padY = (MODEL_INPUT_SIZE - scaledHeight) / 2.0;

        detectionContext.letterboxCanvas.drawColor(Color.BLACK);

        detectionContext.sourceRect.set(0, 0, sourceWidth, sourceHeight);
        detectionContext.destinationRect.set(
            (float) padX,
            (float) padY,
            (float) (padX + scaledWidth),
            (float) (padY + scaledHeight)
        );
        detectionContext.letterboxCanvas.drawBitmap(
            frame,
            detectionContext.sourceRect,
            detectionContext.destinationRect,
            LETTERBOX_PAINT
        );

        detectionContext.letterboxParams.sourceWidth = sourceWidth;
        detectionContext.letterboxParams.sourceHeight = sourceHeight;
        detectionContext.letterboxParams.scale = scale;
        detectionContext.letterboxParams.padX = padX;
        detectionContext.letterboxParams.padY = padY;
    }

    private List<DetectionCandidate> mapCandidatesFromLetterbox(List<DetectionCandidate> candidates, LetterboxParams params) {
        if (candidates.isEmpty()) {
            return candidates;
        }

        List<DetectionCandidate> mapped = new ArrayList<>();
        for (DetectionCandidate candidate : candidates) {
            double inputCenterX = candidate.normalizedX * MODEL_INPUT_SIZE;
            double inputCenterY = candidate.normalizedY * MODEL_INPUT_SIZE;
            double inputWidth = candidate.normalizedWidth * MODEL_INPUT_SIZE;
            double inputHeight = candidate.normalizedHeight * MODEL_INPUT_SIZE;

            double sourceCenterX = (inputCenterX - params.padX) / params.scale;
            double sourceCenterY = (inputCenterY - params.padY) / params.scale;
            double sourceWidth = inputWidth / params.scale;
            double sourceHeight = inputHeight / params.scale;

            if (
                sourceCenterX < 0.0 ||
                sourceCenterY < 0.0 ||
                sourceCenterX > params.sourceWidth ||
                sourceCenterY > params.sourceHeight
            ) {
                continue;
            }

        DetectionCandidate converted = new DetectionCandidate();
        converted.id = candidate.id;
        converted.normalizedX = clamp(sourceCenterX / params.sourceWidth, 0.0, 1.0);
        converted.normalizedY = clamp(sourceCenterY / params.sourceHeight, 0.0, 1.0);
        converted.normalizedWidth = clamp(sourceWidth / params.sourceWidth, 0.01, 1.0);
        converted.normalizedHeight = clamp(sourceHeight / params.sourceHeight, 0.01, 1.0);
        converted.score = candidate.score;
        mapped.add(converted);
        }

        return mapped;
    }

    private ByteBuffer bitmapToModelInput(Bitmap bitmap, DetectionContext detectionContext) {
        ByteBuffer buffer = detectionContext.inputBuffer;
        buffer.rewind();
        bitmap.getPixels(detectionContext.pixels, 0, MODEL_INPUT_SIZE, 0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);

        for (int pixel : detectionContext.pixels) {
            float red = ((pixel >> 16) & 0xFF) / 255.0f;
            float green = ((pixel >> 8) & 0xFF) / 255.0f;
            float blue = (pixel & 0xFF) / 255.0f;
            buffer.putFloat(red);
            buffer.putFloat(green);
            buffer.putFloat(blue);
        }

        buffer.rewind();
        return buffer;
    }

    private List<DetectionCandidate> decodeCandidates(float[][][] rawOutput) {
        List<DetectionCandidate> decoded = new ArrayList<>();
        int dimA = rawOutput[0].length;
        int dimB = rawOutput[0][0].length;

        boolean featuresFirst = dimA <= MAX_FEATURE_VECTOR_LENGTH && dimA >= MIN_FEATURE_VECTOR_LENGTH && dimB > dimA;
        boolean featuresLast = dimB <= MAX_FEATURE_VECTOR_LENGTH && dimB >= MIN_FEATURE_VECTOR_LENGTH && dimA > dimB;

        if (!featuresFirst && !featuresLast) {
            featuresFirst = dimA <= dimB;
            featuresLast = !featuresFirst;
        }

        int featureCount = featuresFirst ? dimA : dimB;
        int candidateCount = featuresFirst ? dimB : dimA;

        if (featureCount < MIN_FEATURE_VECTOR_LENGTH) {
            return decoded;
        }

        for (int index = 0; index < candidateCount; index++) {
            float[] values = new float[featureCount];
            for (int featureIndex = 0; featureIndex < featureCount; featureIndex++) {
                values[featureIndex] = featuresFirst
                    ? rawOutput[0][featureIndex][index]
                    : rawOutput[0][index][featureIndex];
            }

            DetectionCandidate candidate = decodeSingleCandidate(values);
            if (candidate == null) {
                continue;
            }
            candidate.id = "candidate-" + (decoded.size() + 1);
            decoded.add(candidate);
        }

        decoded.sort((left, right) -> Double.compare(right.score, left.score));
        if (decoded.size() > MAX_CANDIDATES) {
            return new ArrayList<>(decoded.subList(0, MAX_CANDIDATES));
        }
        return decoded;
    }

    private DetectionCandidate decodeSingleCandidate(float[] values) {
        if (values.length < MIN_FEATURE_VECTOR_LENGTH) {
            return null;
        }

        double first = values[0];
        double second = values[1];
        double third = values[2];
        double fourth = values[3];

        if (first > 1.2 || second > 1.2 || third > 1.2 || fourth > 1.2) {
            first /= MODEL_INPUT_SIZE;
            second /= MODEL_INPUT_SIZE;
            third /= MODEL_INPUT_SIZE;
            fourth /= MODEL_INPUT_SIZE;
        }

        double left = Math.min(first, third);
        double right = Math.max(first, third);
        double top = Math.min(second, fourth);
        double bottom = Math.max(second, fourth);
        double cx = (left + right) / 2.0;
        double cy = (top + bottom) / 2.0;
        double width = right - left;
        double height = bottom - top;

        double confidence;
        if (values.length == 5) {
            confidence = normalizeScore(values[4]);
        } else {
            double objectness = normalizeScore(values[4]);
            double classScore = 0.0;
            for (int index = 5; index < values.length; index++) {
                classScore = Math.max(classScore, normalizeScore(values[index]));
            }
            confidence = objectness * (classScore > 0.0 ? classScore : 1.0);
        }

        if (confidence < DETECTION_CONFIDENCE_THRESHOLD) {
            return null;
        }

        cx = clamp(cx, 0.0, 1.0);
        cy = clamp(cy, 0.0, 1.0);
        width = clamp(width, 0.01, 1.0);
        height = clamp(height, 0.01, 1.0);

        DetectionCandidate candidate = new DetectionCandidate();
        candidate.normalizedX = cx;
        candidate.normalizedY = cy;
        candidate.normalizedWidth = width;
        candidate.normalizedHeight = height;
        candidate.score = confidence;
        return candidate;
    }

    private double normalizeScore(double value) {
        if (value >= 0.0 && value <= 1.0) {
            return value;
        }
        return 1.0 / (1.0 + Math.exp(-value));
    }

    private List<DetectionCandidate> applyNms(List<DetectionCandidate> candidates) {
        if (candidates.isEmpty()) {
            return candidates;
        }

        List<DetectionCandidate> sorted = new ArrayList<>(candidates);
        sorted.sort((left, right) -> Double.compare(right.score, left.score));

        List<DetectionCandidate> kept = new ArrayList<>();
        for (DetectionCandidate candidate : sorted) {
            boolean overlaps = false;
            for (DetectionCandidate existing : kept) {
                if (iou(candidate, existing) > NMS_IOU_THRESHOLD) {
                    overlaps = true;
                    break;
                }
            }
            if (!overlaps) {
                kept.add(candidate);
            }
            if (kept.size() >= MAX_CANDIDATES) {
                break;
            }
        }

        for (int index = 0; index < kept.size(); index++) {
            kept.get(index).id = "candidate-" + (index + 1);
        }
        return kept;
    }

    private double iou(DetectionCandidate a, DetectionCandidate b) {
        double aLeft = a.normalizedX - (a.normalizedWidth / 2.0);
        double aTop = a.normalizedY - (a.normalizedHeight / 2.0);
        double aRight = a.normalizedX + (a.normalizedWidth / 2.0);
        double aBottom = a.normalizedY + (a.normalizedHeight / 2.0);

        double bLeft = b.normalizedX - (b.normalizedWidth / 2.0);
        double bTop = b.normalizedY - (b.normalizedHeight / 2.0);
        double bRight = b.normalizedX + (b.normalizedWidth / 2.0);
        double bBottom = b.normalizedY + (b.normalizedHeight / 2.0);

        double overlapLeft = Math.max(aLeft, bLeft);
        double overlapTop = Math.max(aTop, bTop);
        double overlapRight = Math.min(aRight, bRight);
        double overlapBottom = Math.min(aBottom, bBottom);

        double overlapWidth = Math.max(0.0, overlapRight - overlapLeft);
        double overlapHeight = Math.max(0.0, overlapBottom - overlapTop);
        double overlapArea = overlapWidth * overlapHeight;

        double areaA = Math.max(0.0, aRight - aLeft) * Math.max(0.0, aBottom - aTop);
        double areaB = Math.max(0.0, bRight - bLeft) * Math.max(0.0, bBottom - bTop);
        double union = areaA + areaB - overlapArea;

        if (union <= 0.0) {
            return 0.0;
        }
        return overlapArea / union;
    }

    private Interpreter getOrCreateInterpreter() throws IOException {
        synchronized (interpreterLock) {
            if (interpreter != null) {
                return interpreter;
            }

            MappedByteBuffer modelBuffer = loadModelFile(MODEL_ASSET_PATH);

            // GPU delegate disabled: sustained inference on Exynos 990 causes thermal throttling
            // (inference degrades from 43ms to 118ms after ~600 frames), making CPU 4-thread
            // stable at ~45ms the better choice for real-world video analysis.
            Interpreter.Options cpuOptions = new Interpreter.Options();
            cpuOptions.setNumThreads(4);
            interpreter = new Interpreter(modelBuffer, cpuOptions);
            Log.i(LOG_TAG, "CPU interpreter initialized (4 threads)");
            return interpreter;
        }
    }

    private MappedByteBuffer loadModelFile(String modelAssetPath) throws IOException {
        AssetFileDescriptor fileDescriptor = getReactApplicationContext().getAssets().openFd(modelAssetPath);
        try (FileInputStream inputStream = new FileInputStream(fileDescriptor.getFileDescriptor());
             FileChannel fileChannel = inputStream.getChannel()) {
            long startOffset = fileDescriptor.getStartOffset();
            long declaredLength = fileDescriptor.getDeclaredLength();
            return fileChannel.map(FileChannel.MapMode.READ_ONLY, startOffset, declaredLength);
        } finally {
            fileDescriptor.close();
        }
    }

    /**
     * Detect rep segments from the bar-path vertical velocity signal using zero-crossings.
     *
     * Screen-space y increases downward, so:
     *   vy > 0 → bar moving down (eccentric/descent)
     *   vy < 0 → bar moving up (concentric/ascent)
     *
     * A rep is defined as: [top-crossing (descent start), bottom-crossing (reversal), next top-crossing].
     *
     * @param barPathSeries JSONArray of {tMs, x, y} tracking points.
     * @param repMetricsOut output JSONArray that receives RepMetric objects.
     * @return JSONArray of RepSegment objects.
     */
    private static JSONArray detectRepSegments(JSONArray barPathSeries, JSONArray repMetricsOut) throws Exception {
        JSONArray repSegments = new JSONArray();
        int n = barPathSeries.length();
        if (n < 6) {
            return repSegments;
        }

        int[] tMsArr = new int[n];
        double[] yArr = new double[n];
        for (int i = 0; i < n; i++) {
            JSONObject point = barPathSeries.getJSONObject(i);
            tMsArr[i] = point.getInt("tMs");
            yArr[i] = point.getDouble("y");
        }

        // Central-difference vertical velocity: vy[i] = (y[i+1] - y[i-1]) / (dt in seconds)
        double[] rawVy = new double[n];
        for (int i = 1; i < n - 1; i++) {
            double dtS = Math.max(1, tMsArr[i + 1] - tMsArr[i - 1]) / 1000.0;
            rawVy[i] = (yArr[i + 1] - yArr[i - 1]) / dtS;
        }

        double[] vy = smoothDoubleArray(rawVy, 5);

        // Minimum duration (ms) per phase to filter out noise crossings.
        int minPhaseDurationMs = 200;

        // Collect zero-crossing indices:
        //   bottomCrossings: vy goes from positive to negative (bar reversal, was descending now ascending)
        //   topCrossings:    vy goes from negative to positive (bar was ascending, starts descending again)
        List<Integer> bottomCrossings = new ArrayList<>();
        List<Integer> topCrossings = new ArrayList<>();
        for (int i = 1; i < n; i++) {
            if (vy[i - 1] > 0 && vy[i] <= 0) {
                bottomCrossings.add(i);
            } else if (vy[i - 1] <= 0 && vy[i] > 0) {
                topCrossings.add(i);
            }
        }

        if (bottomCrossings.isEmpty()) {
            return repSegments;
        }

        int repIndex = 0;
        for (int bottomIdx : bottomCrossings) {
            int bottomMs = tMsArr[bottomIdx];

            // Find the last top-crossing before this bottom (= start of descent)
            int startIdx = 0;
            for (int topIdx : topCrossings) {
                if (tMsArr[topIdx] < bottomMs) {
                    startIdx = topIdx;
                } else {
                    break;
                }
            }
            int startMs = tMsArr[startIdx];

            // Find the first top-crossing after this bottom (= end of concentric)
            int endIdx = n - 1;
            for (int topIdx : topCrossings) {
                if (tMsArr[topIdx] > bottomMs) {
                    endIdx = topIdx;
                    break;
                }
            }
            int endMs = tMsArr[endIdx];

            // Discard if phases are too short
            if (bottomMs - startMs < minPhaseDurationMs || endMs - bottomMs < minPhaseDurationMs) {
                continue;
            }

            // RepSegment
            JSONObject segment = new JSONObject();
            segment.put("repIndex", repIndex);
            segment.put("startMs", startMs);
            segment.put("bottomMs", bottomMs);
            segment.put("endMs", endMs);
            repSegments.put(segment);

            // RepMetric: concentric phase displacement / time
            double yAtBottom = yArr[bottomIdx];
            double yAtEnd = yArr[endIdx];
            double concentricDispPx = Math.abs(yAtBottom - yAtEnd);
            double concentricTimeS = Math.max(0.001, (endMs - bottomMs) / 1000.0);
            double avgConcentricSpeedPxPerS = concentricDispPx / concentricTimeS;

            // Lowest concentric speed: minimum |vy| in concentric window
            double lowestSpeed = Double.MAX_VALUE;
            for (int i = bottomIdx; i <= endIdx && i < n; i++) {
                double speed = Math.abs(vy[i]);
                if (speed < lowestSpeed) {
                    lowestSpeed = speed;
                }
            }
            if (lowestSpeed == Double.MAX_VALUE) {
                lowestSpeed = 0.0;
            }

            JSONObject metric = new JSONObject();
            metric.put("repIndex", repIndex);
            metric.put("repTimeMs", endMs - startMs);
            metric.put("averageConcentricSpeedPxPerS", roundTo3(avgConcentricSpeedPxPerS));
            metric.put("lowestConcentricSpeedPxPerS", roundTo3(lowestSpeed));
            repMetricsOut.put(metric);

            repIndex++;
        }

        return repSegments;
    }

    private static double[] smoothDoubleArray(double[] arr, int windowSize) {
        if (arr.length == 0 || windowSize <= 1) {
            return arr;
        }
        int half = windowSize / 2;
        double[] result = new double[arr.length];
        for (int i = 0; i < arr.length; i++) {
            int start = Math.max(0, i - half);
            int end = Math.min(arr.length - 1, i + half);
            double sum = 0;
            int count = end - start + 1;
            for (int j = start; j <= end; j++) {
                sum += arr[j];
            }
            result[i] = sum / count;
        }
        return result;
    }

    private static double roundTo3(double value) {
        return Math.round(value * 1000.0) / 1000.0;
    }

    private double elapsedMs(long startedAtNs) {
        return (SystemClock.elapsedRealtimeNanos() - startedAtNs) / 1_000_000.0;
    }

    private int clampInt(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private int normalizeRotationDegrees(int rotationDegrees) {
        int normalized = rotationDegrees % 360;
        if (normalized < 0) {
            normalized += 360;
        }
        if (normalized == 90 || normalized == 180 || normalized == 270) {
            return normalized;
        }
        return 0;
    }

    private int yuvToArgb(int y, int u, int v) {
        int adjustedY = Math.max(0, y - 16);
        int adjustedU = u - 128;
        int adjustedV = v - 128;

        int red = clampInt((298 * adjustedY + 409 * adjustedV + 128) >> 8, 0, 255);
        int green = clampInt((298 * adjustedY - 100 * adjustedU - 208 * adjustedV + 128) >> 8, 0, 255);
        int blue = clampInt((298 * adjustedY + 516 * adjustedU + 128) >> 8, 0, 255);
        return 0xFF000000 | (red << 16) | (green << 8) | blue;
    }

    private void logPerformanceMetrics(String stage, int analysisId, AnalysisPerformanceMetrics performanceMetrics) {
        try {
            Log.i(LOG_TAG, stage + " analysisId=" + analysisId + " metrics=" + performanceMetrics.toJson().toString());
        } catch (Exception ignored) {
            Log.i(LOG_TAG, stage + " analysisId=" + analysisId + " metrics_unavailable");
        }
    }

    private void logTrackingProgress(
        int analysisId,
        int processedSamples,
        int plannedSamples,
        AnalysisPerformanceMetrics performanceMetrics
    ) {
        Log.i(
            LOG_TAG,
            "tracking-progress analysisId="
                + analysisId
                + " processedSamples="
                + processedSamples
                + "/"
                + plannedSamples
                + " decodedFrames="
                + performanceMetrics.decodedFrameCount
                + " dequeuedFrames="
                + performanceMetrics.dequeuedOutputFrameCount
                + " acceptedFrames="
                + performanceMetrics.acceptedFrameCount
                + " avgFrameExtractionMs="
                + roundTo3(
                    performanceMetrics.decodedFrameCount == 0
                        ? 0.0
                        : performanceMetrics.frameExtractionMs / performanceMetrics.decodedFrameCount
                )
                + " avgDetectionMs="
                + roundTo3(
                    performanceMetrics.detectionCallCount == 0
                        ? 0.0
                        : performanceMetrics.totalDetectionMs / performanceMetrics.detectionCallCount
                )
                + " avgInferenceMs="
                + roundTo3(
                    performanceMetrics.detectionCallCount == 0
                        ? 0.0
                        : performanceMetrics.inferenceMs / performanceMetrics.detectionCallCount
                )
                + " avgFrameConversionMs="
                + roundTo3(
                    performanceMetrics.processedOutputFrameCount == 0
                        ? 0.0
                        : performanceMetrics.frameConversionMs / performanceMetrics.processedOutputFrameCount
                )
        );
    }

    private static class DetectionSample {
        double normalizedX;
        double normalizedY;
    }

    private static class SeedSelection {
        String candidateId;
        double normalizedX;
        double normalizedY;
        double normalizedWidth;
        double normalizedHeight;

        JSONObject toJsonBox() throws Exception {
            JSONObject object = new JSONObject();
            object.put("x", normalizedX);
            object.put("y", normalizedY);
            object.put("width", normalizedWidth);
            object.put("height", normalizedHeight);
            return object;
        }
    }

    private static class DetectionCandidate {
        String id;
        double normalizedX;
        double normalizedY;
        double normalizedWidth;
        double normalizedHeight;
        double score;

        JSONObject toJsonBox() throws Exception {
            JSONObject object = new JSONObject();
            object.put("id", id);
            object.put("x", normalizedX);
            object.put("y", normalizedY);
            object.put("width", normalizedWidth);
            object.put("height", normalizedHeight);
            object.put("score", score);
            return object;
        }
    }

    private static class LetterboxParams {
        int sourceWidth;
        int sourceHeight;
        double scale;
        double padX;
        double padY;
    }

    private static class DetectionContext {
        Interpreter interpreter;
        int[] outputShape;
        Bitmap letterboxBitmap;
        Canvas letterboxCanvas;
        ByteBuffer inputBuffer;
        int[] pixels;
        Bitmap frameBitmap;
        int[] framePixels;
        int frameBitmapWidth;
        int frameBitmapHeight;
        float[][][] rawOutput;
        Rect sourceRect;
        RectF destinationRect;
        LetterboxParams letterboxParams;
        // true when the model expects UINT8 (0-255) input instead of FLOAT32 (0.0-1.0).
        boolean isUint8Input;
        // Reusable byte[] caches for YUV plane data.
        // Using Java arrays instead of direct ByteBuffer.get(int) eliminates JNI overhead
        // and allows the JIT to eliminate bounds checks, giving ~5-10x faster access.
        byte[] yPlaneCache;
        byte[] uPlaneCache;
        byte[] vPlaneCache;

        void release() {
            if (letterboxBitmap != null && !letterboxBitmap.isRecycled()) {
                letterboxBitmap.recycle();
            }
            if (frameBitmap != null && !frameBitmap.isRecycled()) {
                frameBitmap.recycle();
            }
        }
    }

    private class AnalysisPerformanceMetrics {
        long previewFrameWriteMs;
        long initialFrameReadMs;
        long initialDetectionMs;
        long durationMetadataMs;
        long sourceFpsMetadataMs;
        long totalPreflightMs;
        long trackingMs;
        long totalAnalysisMs;
        double analyzedFps;
        int plannedSampleCount;
        int sampleAttemptCount;
        int decodedFrameCount;
        int nullFrameCount;
        int noCandidateFrameCount;
        int implausibleFrameCount;
        int acceptedFrameCount;
        int detectionCallCount;
        int queuedInputSampleCount;
        int dequeuedOutputFrameCount;
        int processedOutputFrameCount;
        int skippedDecodedFrameCount;
        long decoderSetupMs;
        double frameExtractionMs;
        double decoderQueueInputMs;
        double decoderDequeueOutputMs;
        double frameConversionMs;
        double letterboxMs;
        double inputTensorMs;
        double inferenceMs;
        double candidateDecodeMs;
        double totalDetectionMs;
        boolean gpuDelegateUsed;

        JSONObject toJson() throws Exception {
            JSONObject object = new JSONObject();
            object.put("previewFrameWriteMs", previewFrameWriteMs);
            object.put("initialFrameReadMs", initialFrameReadMs);
            object.put("initialDetectionMs", initialDetectionMs);
            object.put("durationMetadataMs", durationMetadataMs);
            object.put("sourceFpsMetadataMs", sourceFpsMetadataMs);
            object.put("totalPreflightMs", totalPreflightMs);
            object.put("trackingMs", trackingMs);
            object.put("totalAnalysisMs", totalAnalysisMs);
            object.put("analyzedFps", roundTo3(analyzedFps));
            object.put("plannedSampleCount", plannedSampleCount);
            object.put("sampleAttemptCount", sampleAttemptCount);
            object.put("decodedFrameCount", decodedFrameCount);
            object.put("nullFrameCount", nullFrameCount);
            object.put("noCandidateFrameCount", noCandidateFrameCount);
            object.put("implausibleFrameCount", implausibleFrameCount);
            object.put("acceptedFrameCount", acceptedFrameCount);
            object.put("detectionCallCount", detectionCallCount);
            object.put("queuedInputSampleCount", queuedInputSampleCount);
            object.put("dequeuedOutputFrameCount", dequeuedOutputFrameCount);
            object.put("processedOutputFrameCount", processedOutputFrameCount);
            object.put("skippedDecodedFrameCount", skippedDecodedFrameCount);
            object.put("decoderSetupMs", decoderSetupMs);
            object.put("frameExtractionMs", roundTo3(frameExtractionMs));
            object.put("decoderQueueInputMs", roundTo3(decoderQueueInputMs));
            object.put("decoderDequeueOutputMs", roundTo3(decoderDequeueOutputMs));
            object.put("frameConversionMs", roundTo3(frameConversionMs));
            object.put("letterboxMs", roundTo3(letterboxMs));
            object.put("inputTensorMs", roundTo3(inputTensorMs));
            object.put("inferenceMs", roundTo3(inferenceMs));
            object.put("candidateDecodeMs", roundTo3(candidateDecodeMs));
            object.put("totalDetectionMs", roundTo3(totalDetectionMs));
            object.put("gpuDelegateUsed", gpuDelegateUsed);
            object.put(
                "avgFrameExtractionMs",
                roundTo3(decodedFrameCount == 0 ? 0.0 : frameExtractionMs / decodedFrameCount)
            );
            object.put(
                "avgDetectionMs",
                roundTo3(detectionCallCount == 0 ? 0.0 : totalDetectionMs / detectionCallCount)
            );
            object.put(
                "avgInferenceMs",
                roundTo3(detectionCallCount == 0 ? 0.0 : inferenceMs / detectionCallCount)
            );
            object.put(
                "avgFrameConversionMs",
                roundTo3(processedOutputFrameCount == 0 ? 0.0 : frameConversionMs / processedOutputFrameCount)
            );
            return object;
        }
    }

    private static class TrackingSeries {
        JSONArray barPathSeries;
        JSONArray confidenceSeries;
        JSONArray plausibilityRejections;
        int frameCount;
        int frameWidthPx;
        int frameHeightPx;
        double averageConfidence;
        int skippedImplausibleFrames;
    }
}
