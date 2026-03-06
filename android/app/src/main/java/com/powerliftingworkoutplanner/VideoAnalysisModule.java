package com.powerliftingworkoutplanner;

import android.graphics.Bitmap;
import android.media.MediaMetadataRetriever;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;

import org.opencv.android.OpenCVLoader;
import org.opencv.android.Utils;
import org.opencv.core.Mat;
import org.opencv.core.Rect;
import org.opencv.core.Size;
import org.opencv.imgproc.Imgproc;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.FileWriter;
import java.util.ArrayList;
import java.util.List;

public class VideoAnalysisModule extends ReactContextBaseJavaModule {
    private static final int ANALYZED_FPS = 8;
    private static final int DEFAULT_DURATION_MS = 6000;
    private static final int TARGET_REP_DURATION_MS = 3750;
    private static final int MIN_REP_COUNT = 1;
    private static final int MAX_REP_COUNT = 12;
    private static final int MAX_ANALYSIS_DIMENSION = 560;
    private static final int MAX_TRACKING_SAMPLES = 180;
    private static final int MAX_DEBUG_CIRCLES = 10;
    private static final int PLATE_SAMPLE_POINTS = 12;
    private static final double PLATE_MIN_RADIUS_RATIO = 0.035;
    private static final double PLATE_MAX_RADIUS_RATIO = 0.24;
    private static final double PLATE_MIN_SCORE = 0.18;
    private static final double HOUGH_DP = 1.2;
    private static final double HOUGH_PARAM_1 = 120.0;
    private static final double HOUGH_PARAM_2_WIDE = 18.0;
    private static final double HOUGH_PARAM_2_LOCKED = 22.0;
    private static final double HOUGH_GLOBAL_PARAM_1 = 120.0;
    private static final double HOUGH_GLOBAL_PARAM_2 = 20.0;
    private static final double MAX_TRACKING_SPEED_PX_PER_S = 220.0;
    private static final double MANUAL_SEED_REQUIRED_CONFIDENCE = 0.2;
    private static final double TRACKING_EMA_ALPHA = 0.45;
    private static final int TRACKING_LOCK_HITS = 2;
    private static final int TRACKING_UNLOCK_MISSES = 6;
    private static final int TRACKING_STATIC_UNLOCK_FRAMES = 6;
    private static final double TRACKING_MIN_CENTER_X_RATIO = 0.08;
    private static final double TRACKING_MAX_CENTER_X_RATIO = 0.78;
    private static final double TRACKING_MAX_CENTER_Y_RATIO = 0.56;
    private static final double[] PLATE_SAMPLE_COS = new double[PLATE_SAMPLE_POINTS];
    private static final double[] PLATE_SAMPLE_SIN = new double[PLATE_SAMPLE_POINTS];
    private static final Object OPEN_CV_LOCK = new Object();
    private static volatile boolean openCvReady = false;

    static {
        for (int index = 0; index < PLATE_SAMPLE_POINTS; index++) {
            double angle = (2.0 * Math.PI * index) / PLATE_SAMPLE_POINTS;
            PLATE_SAMPLE_COS[index] = Math.cos(angle);
            PLATE_SAMPLE_SIN[index] = Math.sin(angle);
        }
    }

    public VideoAnalysisModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "VideoAnalysis";
    }

    private void ensureOpenCvReady() {
        if (openCvReady) {
            return;
        }
        synchronized (OPEN_CV_LOCK) {
            if (openCvReady) {
                return;
            }
            if (!OpenCVLoader.initDebug()) {
                throw new IllegalStateException("OpenCV initialization failed");
            }
            openCvReady = true;
        }
    }

    @ReactMethod
    public void analyzeSquatVideo(String localVideoPath, int analysisId, ReadableMap manualSeed, Promise promise) {
        try {
            ensureOpenCvReady();
            File documentDir = getReactApplicationContext().getFilesDir();
            File rootDir = new File(documentDir, "video-analysis");
            File resultsDir = new File(rootDir, "results");
            if (!resultsDir.exists() && !resultsDir.mkdirs()) {
                promise.reject("ERR_VIDEO_ANALYSIS_DIR", "Could not create video analysis result directory");
                return;
            }

            File resultFile = new File(resultsDir, "analysis-" + analysisId + ".json");
            String previewFramePath = writePreviewFrame(localVideoPath, analysisId, rootDir);
            long durationMs = extractDurationMs(localVideoPath);
            double sourceFps = extractSourceFps(localVideoPath);
            ManualSeedPoint manualSeedPoint = buildManualSeedPoint(manualSeed);
            TrackingSeries trackingSeries = extractMotionTrackedSeries(localVideoPath, durationMs, manualSeedPoint);
            if (manualSeedPoint == null && (trackingSeries.usedFallback || trackingSeries.averageConfidence < MANUAL_SEED_REQUIRED_CONFIDENCE)) {
                String manualSeedMessage = "MANUAL_SEED_REQUIRED::" + (previewFramePath == null ? "" : previewFramePath);
                promise.reject("ERR_VIDEO_ANALYSIS_NEEDS_MANUAL_SEED", manualSeedMessage);
                return;
            }
            int estimatedRepCount = estimateRepCountFromSeries(trackingSeries.barPathSeries, durationMs, ANALYZED_FPS);
            JSONArray repSegments =
                buildRepSegmentsFromSeries(trackingSeries.barPathSeries, ANALYZED_FPS, durationMs, estimatedRepCount);
            JSONArray repMetrics = buildRepMetrics(trackingSeries.barPathSeries, repSegments);

            JSONObject result = new JSONObject();
            result.put("analysisId", analysisId);
            result.put("units", "px/s");
            result.put("barPathSeries", trackingSeries.barPathSeries);
            result.put("confidenceSeries", trackingSeries.confidenceSeries);
            result.put("repSegments", repSegments);
            result.put("repMetrics", repMetrics);

            JSONObject analysisMeta = new JSONObject();
            analysisMeta.put("sourceFps", roundTo3(sourceFps));
            analysisMeta.put("analyzedFps", ANALYZED_FPS);
            analysisMeta.put("trackerVersion", "opencv-hough-v2");
            analysisMeta.put("frameCount", trackingSeries.frameCount);
            analysisMeta.put("averageConfidence", roundTo3(trackingSeries.averageConfidence));
            analysisMeta.put("trackingFrameWidthPx", trackingSeries.frameWidthPx);
            analysisMeta.put("trackingFrameHeightPx", trackingSeries.frameHeightPx);
            analysisMeta.put("manualSeedUsed", manualSeedPoint != null);
            analysisMeta.put("detectedCirclesAtStart", trackingSeries.detectedCirclesAtStart);
            result.put("analysisMeta", analysisMeta);

            JSONArray qualityFlags = new JSONArray();
            qualityFlags.put("ANALYSIS_NATIVE_PLATE_TRACKING_V2");
            qualityFlags.put("ANALYSIS_NATIVE_OPENCV_HOUGH_CIRCLES");
            qualityFlags.put("SOURCE_VIDEO:" + localVideoPath);
            qualityFlags.put(previewFramePath == null ? "PREVIEW_FRAME_MISSING" : "PREVIEW_FRAME_READY");
            qualityFlags.put("ESTIMATED_REPS_AUTOCORR:" + estimatedRepCount);
            qualityFlags.put("REP_ESTIMATION_DURATION_BASED:" + TARGET_REP_DURATION_MS + "ms");
            if (manualSeedPoint != null) {
                qualityFlags.put("MANUAL_SEED_USED");
            }
            if (trackingSeries.usedFallback) {
                qualityFlags.put("TRACKING_FALLBACK:" + trackingSeries.fallbackReason);
            }
            result.put("qualityFlags", qualityFlags);

            FileWriter writer = new FileWriter(resultFile);
            writer.write(result.toString(2));
            writer.close();

            promise.resolve(resultFile.getAbsolutePath());
        } catch (Exception error) {
            promise.reject("ERR_VIDEO_ANALYSIS", error);
        }
    }

    private String writePreviewFrame(String localVideoPath, int analysisId, File rootDir) {
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        FileOutputStream outputStream = null;
        try {
            File previewDir = new File(rootDir, "previews");
            if (!previewDir.exists() && !previewDir.mkdirs()) {
                return null;
            }

            retriever.setDataSource(localVideoPath);
            Bitmap frame = retriever.getFrameAtTime(0, MediaMetadataRetriever.OPTION_CLOSEST_SYNC);
            if (frame == null) {
                return null;
            }

            File previewFile = new File(previewDir, "analysis-" + analysisId + ".jpg");
            outputStream = new FileOutputStream(previewFile);
            if (!frame.compress(Bitmap.CompressFormat.JPEG, 90, outputStream)) {
                frame.recycle();
                return null;
            }
            outputStream.flush();
            frame.recycle();
            return previewFile.getAbsolutePath();
        } catch (Exception ignored) {
            return null;
        } finally {
            if (outputStream != null) {
                try {
                    outputStream.close();
                } catch (Exception ignored) {
                    // No-op: closing stream best-effort only.
                }
            }
            try {
                retriever.release();
            } catch (Exception ignored) {
                // No-op: retriever may already be released.
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
                // No-op: retriever may already be released on some device/codec combinations.
            }
        }
    }

    private double extractSourceFps(String localVideoPath) {
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        try {
            retriever.setDataSource(localVideoPath);
            String captureFps = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_CAPTURE_FRAMERATE);
            if (captureFps == null || captureFps.isEmpty()) {
                return ANALYZED_FPS;
            }
            return Double.parseDouble(captureFps);
        } catch (Exception ignored) {
            return ANALYZED_FPS;
        } finally {
            try {
                retriever.release();
            } catch (Exception ignored) {
                // No-op.
            }
        }
    }

    private ManualSeedPoint buildManualSeedPoint(ReadableMap manualSeed) {
        if (manualSeed == null) {
            return null;
        }
        if (!manualSeed.hasKey("normalizedX") || !manualSeed.hasKey("normalizedY")) {
            return null;
        }

        ManualSeedPoint point = new ManualSeedPoint();
        point.normalizedX = clamp(manualSeed.getDouble("normalizedX"), 0.0, 1.0);
        point.normalizedY = clamp(manualSeed.getDouble("normalizedY"), 0.0, 1.0);
        return point;
    }

    private TrackingSeries extractMotionTrackedSeries(String localVideoPath, long durationMs, ManualSeedPoint manualSeedPoint) throws Exception {
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        try {
            retriever.setDataSource(localVideoPath);

            int sampleCount = Math.max(24, Math.min(MAX_TRACKING_SAMPLES, (int) Math.round((durationMs / 1000.0) * ANALYZED_FPS)));
            if (sampleCount < 2) {
                sampleCount = 2;
            }

            List<TrackingSample> samples = new ArrayList<>();
            int trackingWidth = -1;
            int trackingHeight = -1;
            int[] previousGray = null;
            double filteredX = Double.NaN;
            double filteredY = Double.NaN;
            double previousFilteredY = Double.NaN;
            double anchorX = Double.NaN;
            double velocityX = 0.0;
            double velocityY = 0.0;
            double trackedRadius = Double.NaN;
            boolean hasTrackingLock = manualSeedPoint != null;
            int consecutiveHits = 0;
            int consecutiveMisses = 0;
            int consecutiveStaticLockFrames = 0;
            int previousTimeMs = -1;
            JSONArray detectedCirclesAtStart = new JSONArray();

            for (int sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
                int timeMs = sampleCount <= 1
                    ? 0
                    : (int) Math.round((sampleIndex * durationMs) / (double) (sampleCount - 1));
                Bitmap frame = retriever.getFrameAtTime(timeMs * 1000L, MediaMetadataRetriever.OPTION_CLOSEST);
                if (frame == null) {
                    continue;
                }

                FrameData frameData = toFrameData(frame);
                frame.recycle();
                if (frameData == null) {
                    continue;
                }
                try {
                    trackingWidth = frameData.width;
                    trackingHeight = frameData.height;
                    int[] motion = buildMotionMagnitude(frameData.gray, previousGray);
                    previousGray = frameData.gray;

                    double dtSeconds = 1.0 / ANALYZED_FPS;
                    if (previousTimeMs >= 0 && timeMs > previousTimeMs) {
                        dtSeconds = Math.max(0.001, (timeMs - previousTimeMs) / 1000.0);
                    }

                    double predictedX = filteredX;
                    double predictedY = filteredY;
                    if (Double.isNaN(predictedX) || Double.isNaN(predictedY)) {
                        if (manualSeedPoint != null) {
                            predictedX = manualSeedPoint.normalizedX * frameData.width;
                            predictedY = manualSeedPoint.normalizedY * frameData.height;
                        } else {
                            predictedX = frameData.width * 0.5;
                            predictedY = frameData.height * 0.45;
                        }
                    } else {
                        predictedX += velocityX * dtSeconds;
                        predictedY += velocityY * dtSeconds;
                    }
                    if (!Double.isNaN(anchorX) && hasTrackingLock) {
                        double xBand = frameData.width * 0.2;
                        predictedX = clamp(predictedX, anchorX - xBand, anchorX + xBand);
                    }

                    int[] edge = buildEdgeMagnitude(frameData.gray, frameData.width, frameData.height);
                    boolean useWideSearch = !hasTrackingLock || consecutiveMisses > 1 || (manualSeedPoint != null && samples.isEmpty());
                    PlateDetection detection =
                        detectPlateCenterWithHough(
                            frameData,
                            edge,
                            motion,
                            predictedX,
                            predictedY,
                            trackedRadius,
                            useWideSearch,
                            false
                        );
                    if (sampleIndex == 0 && detectedCirclesAtStart.length() == 0) {
                        double hintX = detection.found ? detection.x : predictedX;
                        double hintY = detection.found ? detection.y : predictedY;
                        double hintRadius = detection.found ? detection.radius : trackedRadius;
                        detectedCirclesAtStart = detectInitialFrameCircles(frameData, edge, hintX, hintY, hintRadius);
                    }
                    boolean detectionAccepted = detection.found;
                    if (detectionAccepted && !Double.isNaN(filteredX) && !Double.isNaN(filteredY)) {
                        double jumpDistance = Math.hypot(detection.x - predictedX, detection.y - predictedY);
                        double speedMagnitude = Math.hypot(velocityX, velocityY);
                        double minDimension = Math.max(1.0, Math.min(frameData.width, frameData.height));
                        double maxJump = clamp(
                            (speedMagnitude * dtSeconds * 1.8) + (minDimension * 0.045),
                            8.0,
                            minDimension * (useWideSearch ? 0.42 : 0.18)
                        );
                        if (!useWideSearch && jumpDistance > maxJump) {
                            detectionAccepted = false;
                        }

                        if (detectionAccepted && !Double.isNaN(trackedRadius)) {
                            double radiusDelta = Math.abs(detection.radius - trackedRadius);
                            double radiusTolerance = Math.max(2.5, trackedRadius * (useWideSearch ? 0.65 : 0.35));
                            if (!useWideSearch && radiusDelta > radiusTolerance) {
                                detectionAccepted = false;
                            }
                        }
                    }

                    double measuredX;
                    double measuredY;
                    double confidence;

                    if (detectionAccepted) {
                        measuredX = detection.x;
                        measuredY = detection.y;
                        confidence = detection.confidence;
                        consecutiveHits += 1;
                        consecutiveMisses = 0;
                        if (!hasTrackingLock && consecutiveHits >= TRACKING_LOCK_HITS) {
                            hasTrackingLock = true;
                        }
                        if (Double.isNaN(anchorX)) {
                            anchorX = detection.x;
                        } else {
                            anchorX = anchorX + (detection.x - anchorX) * 0.08;
                        }
                        if (Double.isNaN(trackedRadius)) {
                            trackedRadius = detection.radius;
                        } else {
                            trackedRadius = trackedRadius + (detection.radius - trackedRadius) * 0.35;
                        }
                    } else if (!Double.isNaN(filteredX) && !Double.isNaN(filteredY)) {
                        measuredX = predictedX;
                        measuredY = predictedY;
                        consecutiveMisses += 1;
                        consecutiveHits = 0;
                        confidence = clamp(0.065 - (consecutiveMisses * 0.008), 0.03, 0.08);
                    } else {
                        measuredX = frameData.width * 0.5;
                        measuredY = frameData.height * 0.45;
                        consecutiveMisses += 1;
                        consecutiveHits = 0;
                        confidence = 0.03;
                    }

                    if (consecutiveMisses >= TRACKING_UNLOCK_MISSES) {
                        hasTrackingLock = false;
                        trackedRadius = Double.NaN;
                        velocityX *= 0.4;
                        velocityY *= 0.4;
                        if (!Double.isNaN(anchorX)) {
                            anchorX = anchorX + (predictedX - anchorX) * 0.12;
                        }
                        consecutiveStaticLockFrames = 0;
                    }

                    if (Double.isNaN(filteredX) || Double.isNaN(filteredY)) {
                        filteredX = measuredX;
                        filteredY = measuredY;
                    } else {
                        double alpha = clamp((TRACKING_EMA_ALPHA * 0.55) + (confidence * 0.55), 0.2, 0.88);
                        filteredX = filteredX + alpha * (measuredX - filteredX);
                        filteredY = filteredY + alpha * (measuredY - filteredY);
                    }

                    filteredX = clamp(filteredX, 0.0, Math.max(1, frameData.width - 1));
                    filteredY = clamp(filteredY, 0.0, Math.max(1, frameData.height - 1));

                    if (hasTrackingLock && detectionAccepted) {
                        double deltaY = Double.isNaN(previousFilteredY) ? 0.0 : Math.abs(filteredY - previousFilteredY);
                        if (detection.motionScore < 0.045 && deltaY < 0.75) {
                            consecutiveStaticLockFrames++;
                        } else {
                            consecutiveStaticLockFrames = Math.max(0, consecutiveStaticLockFrames - 1);
                        }
                        if (consecutiveStaticLockFrames >= TRACKING_STATIC_UNLOCK_FRAMES) {
                            hasTrackingLock = false;
                            trackedRadius = Double.NaN;
                            consecutiveHits = 0;
                            consecutiveMisses = Math.max(consecutiveMisses, 2);
                            velocityX *= 0.35;
                            velocityY *= 0.35;
                            if (!Double.isNaN(anchorX)) {
                                anchorX = anchorX + (predictedX - anchorX) * 0.15;
                            }
                            consecutiveStaticLockFrames = 0;
                        }
                    } else {
                        consecutiveStaticLockFrames = Math.max(0, consecutiveStaticLockFrames - 1);
                    }

                    double nextVelocityX = velocityX * 0.85;
                    double nextVelocityY = velocityY * 0.85;
                    if (dtSeconds > 0.0) {
                        double instantVx = (filteredX - predictedX) / dtSeconds;
                        double instantVy = (filteredY - predictedY) / dtSeconds;
                        double blend = detectionAccepted ? 0.52 : 0.22;
                        nextVelocityX = (velocityX * (1.0 - blend)) + (instantVx * blend);
                        nextVelocityY = (velocityY * (1.0 - blend)) + (instantVy * blend);
                        nextVelocityX = clamp(nextVelocityX, -MAX_TRACKING_SPEED_PX_PER_S, MAX_TRACKING_SPEED_PX_PER_S);
                        nextVelocityY = clamp(nextVelocityY, -MAX_TRACKING_SPEED_PX_PER_S, MAX_TRACKING_SPEED_PX_PER_S);
                    }
                    velocityX = nextVelocityX;
                    velocityY = nextVelocityY;

                    TrackingSample sample = new TrackingSample();
                    sample.tMs = timeMs;
                    sample.x = filteredX;
                    sample.y = filteredY;
                    sample.confidence = confidence;
                    samples.add(sample);
                    previousFilteredY = filteredY;
                    previousTimeMs = timeMs;
                } finally {
                    frameData.release();
                }
            }

            if (samples.size() < 6) {
                return buildFallbackTrackingSeries(durationMs, "NO_STABLE_PLATE_SIGNAL", trackingWidth, trackingHeight);
            }

            JSONArray barPathSeries = new JSONArray();
            JSONArray confidenceSeries = new JSONArray();
            double confidenceSum = 0.0;

            for (TrackingSample sample : samples) {
                JSONObject point = new JSONObject();
                point.put("tMs", sample.tMs);
                point.put("x", roundTo3(sample.x));
                point.put("y", roundTo3(sample.y));
                barPathSeries.put(point);

                JSONObject confidencePoint = new JSONObject();
                confidencePoint.put("tMs", sample.tMs);
                confidencePoint.put("score", roundTo3(sample.confidence));
                confidenceSeries.put(confidencePoint);
                confidenceSum += sample.confidence;
            }

            TrackingSeries series = new TrackingSeries();
            series.barPathSeries = barPathSeries;
            series.confidenceSeries = confidenceSeries;
            series.frameCount = samples.size();
            series.averageConfidence = confidenceSum / samples.size();
            series.frameWidthPx = trackingWidth;
            series.frameHeightPx = trackingHeight;
            series.detectedCirclesAtStart = detectedCirclesAtStart;
            series.usedFallback = false;
            series.fallbackReason = "";
            return series;
        } finally {
            try {
                retriever.release();
            } catch (Exception ignored) {
                // No-op.
            }
        }
    }

    private TrackingSeries buildFallbackTrackingSeries(long durationMs, String reason, int trackingWidth, int trackingHeight) throws Exception {
        int sampleCount = Math.max(30, Math.min(400, (int) Math.round((durationMs / 1000.0) * ANALYZED_FPS)));
        int repCount = estimateRepCount(durationMs);

        TrackingSeries series = new TrackingSeries();
        series.barPathSeries = buildFallbackBarPathSeries(sampleCount, ANALYZED_FPS, repCount);
        series.confidenceSeries = buildFallbackConfidenceSeries(sampleCount, ANALYZED_FPS);
        series.frameCount = sampleCount;
        series.averageConfidence = calculateAverageConfidence(series.confidenceSeries);
        series.frameWidthPx = trackingWidth > 0 ? trackingWidth : MAX_ANALYSIS_DIMENSION;
        series.frameHeightPx = trackingHeight > 0 ? trackingHeight : (int) Math.round(MAX_ANALYSIS_DIMENSION * (9.0 / 16.0));
        series.detectedCirclesAtStart = new JSONArray();
        series.usedFallback = true;
        series.fallbackReason = reason;
        return series;
    }

    private FrameData toFrameData(Bitmap frame) {
        int sourceWidth = frame.getWidth();
        int sourceHeight = frame.getHeight();
        if (sourceWidth <= 0 || sourceHeight <= 0) {
            return null;
        }

        int scaledWidth = sourceWidth;
        int scaledHeight = sourceHeight;
        int maxDimension = Math.max(sourceWidth, sourceHeight);
        if (maxDimension > MAX_ANALYSIS_DIMENSION) {
            double scale = MAX_ANALYSIS_DIMENSION / (double) maxDimension;
            scaledWidth = Math.max(2, (int) Math.round(sourceWidth * scale));
            scaledHeight = Math.max(2, (int) Math.round(sourceHeight * scale));
        }

        Bitmap workingBitmap = frame;
        boolean needsRecycle = false;
        if (scaledWidth != sourceWidth || scaledHeight != sourceHeight) {
            workingBitmap = Bitmap.createScaledBitmap(frame, scaledWidth, scaledHeight, true);
            needsRecycle = true;
        }

        Mat rgba = null;
        Mat grayMat = null;
        try {
            rgba = new Mat();
            Utils.bitmapToMat(workingBitmap, rgba);
            grayMat = new Mat();
            Imgproc.cvtColor(rgba, grayMat, Imgproc.COLOR_RGBA2GRAY);
            Imgproc.GaussianBlur(grayMat, grayMat, new Size(5.0, 5.0), 1.2);

            byte[] grayBytes = new byte[scaledWidth * scaledHeight];
            grayMat.get(0, 0, grayBytes);
            int[] gray = new int[grayBytes.length];
            for (int index = 0; index < grayBytes.length; index++) {
                gray[index] = grayBytes[index] & 0xFF;
            }

            FrameData frameData = new FrameData();
            frameData.width = scaledWidth;
            frameData.height = scaledHeight;
            frameData.gray = gray;
            frameData.grayMat = grayMat;
            grayMat = null;
            return frameData;
        } catch (Exception ignored) {
            return null;
        } finally {
            if (rgba != null) {
                rgba.release();
            }
            if (grayMat != null) {
                grayMat.release();
            }
            if (needsRecycle) {
                workingBitmap.recycle();
            }
        }
    }

    FrameHoughDebugResult detectPlateFromBitmapForTest(Bitmap frame, double hintX, double hintY, double hintRadius) throws Exception {
        ensureOpenCvReady();
        FrameHoughDebugResult result = new FrameHoughDebugResult();
        if (frame == null) {
            return result;
        }

        FrameData frameData = toFrameData(frame);
        if (frameData == null) {
            return result;
        }

        try {
            result.frameWidth = frameData.width;
            result.frameHeight = frameData.height;

            boolean hasHint =
                !Double.isNaN(hintX) &&
                !Double.isNaN(hintY) &&
                !Double.isNaN(hintRadius) &&
                hintRadius > 0.0;
            double safeHintX = hasHint
                ? clamp(hintX, 0.0, Math.max(1, frameData.width - 1))
                : frameData.width * 0.5;
            double safeHintY = hasHint
                ? clamp(hintY, 0.0, Math.max(1, frameData.height - 1))
                : frameData.height * 0.45;
            double safeHintRadius = hasHint
                ? clamp(hintRadius, 1.0, Math.min(frameData.width, frameData.height))
                : Double.NaN;
            double initialHintX = hasHint ? safeHintX : Double.NaN;
            double initialHintY = hasHint ? safeHintY : Double.NaN;
            double initialHintRadius = hasHint ? safeHintRadius : Double.NaN;

            int[] edge = buildEdgeMagnitude(frameData.gray, frameData.width, frameData.height);
            JSONArray initialCircles = detectInitialFrameCircles(frameData, edge, initialHintX, initialHintY, initialHintRadius);
            PlateDetection detection =
                detectPlateCenterWithHough(
                    frameData,
                    edge,
                    new int[frameData.gray.length],
                    safeHintX,
                    safeHintY,
                    safeHintRadius,
                    true,
                    true
                );

            result.found = detection.found;
            result.x = detection.x;
            result.y = detection.y;
            result.radius = detection.radius;
            result.score = detection.score;
            for (int index = 0; index < initialCircles.length(); index++) {
                JSONObject circleObject = initialCircles.optJSONObject(index);
                if (circleObject == null) {
                    continue;
                }
                FrameHoughDebugCircle circle = new FrameHoughDebugCircle();
                circle.x = circleObject.optDouble("x", 0.0);
                circle.y = circleObject.optDouble("y", 0.0);
                circle.radius = circleObject.optDouble("radius", 0.0);
                circle.score = circleObject.optDouble("score", 0.0);
                result.initialCircles.add(circle);
            }
            if (detection.candidateCircles != null) {
                for (CircleCandidate candidate : detection.candidateCircles) {
                    if (candidate == null) {
                        continue;
                    }
                    FrameHoughDebugCircle circle = new FrameHoughDebugCircle();
                    circle.x = candidate.x;
                    circle.y = candidate.y;
                    circle.radius = candidate.radius;
                    circle.score = candidate.score;
                    result.houghCandidates.add(circle);
                    if (!Double.isNaN(circle.score)) {
                        result.rankedHoughCandidates.add(circle);
                    }
                }
                result.rankedHoughCandidates.sort((left, right) -> Double.compare(right.score, left.score));
            }
            return result;
        } finally {
            frameData.release();
        }
    }

    private int[] buildEdgeMagnitude(int[] gray, int width, int height) {
        int[] edge = new int[gray.length];
        if (width < 3 || height < 3) {
            return edge;
        }

        for (int y = 1; y < height - 1; y++) {
            int rowOffset = y * width;
            for (int x = 1; x < width - 1; x++) {
                int pixelIndex = rowOffset + x;
                int gradientX = gray[pixelIndex + 1] - gray[pixelIndex - 1];
                int gradientY = gray[pixelIndex + width] - gray[pixelIndex - width];
                int magnitude = Math.abs(gradientX) + Math.abs(gradientY);
                edge[pixelIndex] = Math.min(255, magnitude);
            }
        }
        return edge;
    }

    private int[] buildMotionMagnitude(int[] gray, int[] previousGray) {
        int[] motion = new int[gray.length];
        if (previousGray == null || previousGray.length != gray.length) {
            return motion;
        }

        for (int index = 0; index < gray.length; index++) {
            motion[index] = Math.abs(gray[index] - previousGray[index]);
        }
        return motion;
    }

    private PlateDetection detectPlateCenterWithHough(
        FrameData frameData,
        int[] edge,
        int[] motion,
        double predictedX,
        double predictedY,
        double predictedRadius,
        boolean useWideSearch,
        boolean captureCandidateCircles
    ) {
        int width = frameData.width;
        int height = frameData.height;
        int minDimension = Math.min(width, height);
        PlateDetection emptyDetection = new PlateDetection();
        emptyDetection.found = false;
        if (frameData.grayMat == null || frameData.grayMat.empty()) {
            return emptyDetection;
        }

        int minRadius = Math.max(8, (int) Math.round(minDimension * PLATE_MIN_RADIUS_RATIO));
        int maxRadius = Math.max(minRadius + 2, (int) Math.round(minDimension * PLATE_MAX_RADIUS_RATIO));
        if (!Double.isNaN(predictedRadius)) {
            int centerRadius = clampInt((int) Math.round(predictedRadius), minRadius, maxRadius);
            int radiusPadding = Math.max(3, (int) Math.round(centerRadius * (useWideSearch ? 0.40 : 0.25)));
            minRadius = Math.max(minRadius, centerRadius - radiusPadding);
            maxRadius = Math.min(maxRadius, centerRadius + radiusPadding);
            if (maxRadius <= minRadius) {
                maxRadius = Math.min((int) Math.round(minDimension * PLATE_MAX_RADIUS_RATIO), minRadius + 2);
            }
        }
        int expandedRadius = maxRadius + 3;

        double safePredictedX = clamp(predictedX, 0.0, Math.max(1, width - 1));
        double safePredictedY = clamp(predictedY, 0.0, Math.max(1, height - 1));
        int roiHalfWidth = (int) Math.round(width * (useWideSearch ? 0.32 : 0.22));
        int roiHalfHeight = (int) Math.round(height * (useWideSearch ? 0.24 : 0.18));

        int roiMinX = clampInt((int) Math.round(safePredictedX) - roiHalfWidth, expandedRadius, width - expandedRadius - 1);
        int roiMaxX = clampInt((int) Math.round(safePredictedX) + roiHalfWidth, roiMinX + 1, width - expandedRadius - 1);
        int roiMinY = clampInt((int) Math.round(safePredictedY) - roiHalfHeight, expandedRadius, height - expandedRadius - 1);
        int roiMaxY = clampInt((int) Math.round(safePredictedY) + roiHalfHeight, roiMinY + 1, height - expandedRadius - 1);

        int globalMinX = clampInt((int) Math.round(width * TRACKING_MIN_CENTER_X_RATIO), expandedRadius, width - expandedRadius - 1);
        int globalMaxX = clampInt((int) Math.round(width * TRACKING_MAX_CENTER_X_RATIO), globalMinX + 1, width - expandedRadius - 1);
        int globalMaxY = clampInt((int) Math.round(height * TRACKING_MAX_CENTER_Y_RATIO), expandedRadius + 1, height - expandedRadius - 1);
        roiMinX = clampInt(roiMinX, globalMinX, globalMaxX - 1);
        roiMaxX = clampInt(roiMaxX, roiMinX + 1, globalMaxX);
        roiMinY = clampInt(roiMinY, expandedRadius, globalMaxY - 1);
        roiMaxY = clampInt(roiMaxY, roiMinY + 1, globalMaxY);

        if (roiMaxX <= roiMinX || roiMaxY <= roiMinY) {
            return emptyDetection;
        }

        Rect roiRect = new Rect(roiMinX, roiMinY, roiMaxX - roiMinX + 1, roiMaxY - roiMinY + 1);
        if (roiRect.width <= 2 || roiRect.height <= 2) {
            return emptyDetection;
        }

        Mat roiGray = null;
        Mat roiFiltered = null;
        Mat circles = null;
        double bestScore = -Double.MAX_VALUE;
        double bestX = safePredictedX;
        double bestY = safePredictedY;
        int bestRadius = minRadius;
        double bestMotionRing = 0.0;
        List<CircleCandidate> candidateCircles = captureCandidateCircles ? new ArrayList<>() : null;

        try {
            roiGray = frameData.grayMat.submat(roiRect);
            roiFiltered = new Mat();
            Imgproc.medianBlur(roiGray, roiFiltered, 5);
            circles = new Mat();

            double minDist = Math.max(10.0, minRadius * 1.8);
            Imgproc.HoughCircles(
                roiFiltered,
                circles,
                Imgproc.HOUGH_GRADIENT,
                HOUGH_DP,
                minDist,
                HOUGH_PARAM_1,
                useWideSearch ? HOUGH_PARAM_2_WIDE : HOUGH_PARAM_2_LOCKED,
                minRadius,
                maxRadius
            );
            if (circles.empty() || circles.cols() <= 0) {
                return emptyDetection;
            }

            double roiDistanceNorm = Math.max(1.0, Math.max(roiHalfWidth, roiHalfHeight));
            int candidateCount = circles.cols();
            for (int candidateIndex = 0; candidateIndex < candidateCount; candidateIndex++) {
                double[] candidate = circles.get(0, candidateIndex);
                if (candidate == null || candidate.length < 3) {
                    continue;
                }

                int centerX = clampInt((int) Math.round(candidate[0] + roiRect.x), 0, width - 1);
                int centerY = clampInt((int) Math.round(candidate[1] + roiRect.y), 0, height - 1);
                int radius = clampInt((int) Math.round(candidate[2]), minRadius, maxRadius);
                CircleCandidate circleCandidate = null;
                if (captureCandidateCircles && candidateCircles != null && candidateCircles.size() < MAX_DEBUG_CIRCLES) {
                    circleCandidate = new CircleCandidate();
                    circleCandidate.x = centerX;
                    circleCandidate.y = centerY;
                    circleCandidate.radius = radius;
                    circleCandidate.score = Double.NaN;
                    candidateCircles.add(circleCandidate);
                }
                int expanded = radius + 3;
                if (centerX - expanded < 1 || centerX + expanded >= width - 1 || centerY - expanded < 1 || centerY + expanded >= height - 1) {
                    continue;
                }

                CircleStats ringEdgeStats = sampleCircleStats(edge, width, height, centerX, centerY, radius);
                double ringEdge = ringEdgeStats.mean;
                if (ringEdge < 6.0) {
                    continue;
                }

                double innerEdge = sampleCircleAverage(edge, width, height, centerX, centerY, Math.max(2, radius - 2));
                double outerEdge = sampleCircleAverage(edge, width, height, centerX, centerY, radius + 2);
                double centerEdge = sampleCircleAverage(edge, width, height, centerX, centerY, Math.max(2, radius / 3));
                double innerLum = sampleCircleAverage(frameData.gray, width, height, centerX, centerY, Math.max(2, radius - 2));
                double outerLum = sampleCircleAverage(frameData.gray, width, height, centerX, centerY, radius + 2);
                double motionRing = sampleCircleAverage(motion, width, height, centerX, centerY, radius);
                double contrast = Math.abs(innerLum - outerLum);
                double edgePeak = ringEdge - ((innerEdge + outerEdge) * 0.5);
                if (edgePeak < 1.8) {
                    continue;
                }

                double ringUniformity = clamp(1.0 - (ringEdgeStats.stdDev / (ringEdge + 24.0)), 0.0, 1.0);
                if (ringUniformity < 0.05) {
                    continue;
                }
                double distance = Math.hypot(centerX - safePredictedX, centerY - safePredictedY);
                double distancePenalty = clamp(distance / roiDistanceNorm, 0.0, 1.0) * 0.50;
                double radiusPenalty = 0.0;
                double radiusSupport = 0.0;
                if (!Double.isNaN(predictedRadius)) {
                    double radiusDeltaRatio = Math.abs(radius - predictedRadius) / Math.max(1.0, predictedRadius);
                    radiusPenalty = clamp(radiusDeltaRatio, 0.0, 1.0) * (useWideSearch ? 0.32 : 0.46);
                    radiusSupport = (1.0 - clamp(radiusDeltaRatio, 0.0, 1.0)) * (useWideSearch ? 0.22 : 0.28);
                }
                double sizeBonus = 0.0;
                if (maxRadius > minRadius) {
                    sizeBonus = ((radius - minRadius) / (double) (maxRadius - minRadius)) * 0.22;
                }
                double candidateRankBonus = clamp(1.0 - (candidateIndex / 8.0), 0.0, 1.0) * 0.06;

                double score = (ringEdge / 255.0) * 0.46
                    + clamp(edgePeak / 255.0, -1.0, 1.0) * 0.24
                    + (contrast / 255.0) * 0.26
                    + ringUniformity * 0.14
                    + (motionRing / 255.0) * 0.12
                    + sizeBonus
                    + candidateRankBonus
                    + radiusSupport
                    - (centerEdge / 255.0) * 0.18
                    - distancePenalty
                    - radiusPenalty;
                if (circleCandidate != null) {
                    circleCandidate.score = score;
                }
                if (score > bestScore) {
                    bestScore = score;
                    bestX = centerX;
                    bestY = centerY;
                    bestRadius = radius;
                    bestMotionRing = motionRing;
                }
            }
        } finally {
            if (circles != null) {
                circles.release();
            }
            if (roiGray != null) {
                roiGray.release();
            }
            if (roiFiltered != null) {
                roiFiltered.release();
            }
        }

        PlateDetection detection = new PlateDetection();
        detection.x = bestX;
        detection.y = bestY;
        detection.radius = bestRadius;
        detection.score = bestScore;
        detection.motionScore = clamp(bestMotionRing / 255.0, 0.0, 1.0);
        detection.found = bestScore >= PLATE_MIN_SCORE;
        detection.confidence = detection.found
            ? clamp(0.08 + ((bestScore - PLATE_MIN_SCORE) / 0.52), 0.08, 1.0)
            : clamp(bestScore, 0.02, 0.08);
        detection.candidateCircles = candidateCircles;
        return detection;
    }

    private JSONArray detectInitialFrameCircles(FrameData frameData, int[] edge, double hintX, double hintY, double hintRadius) throws Exception {
        JSONArray circlesArray = new JSONArray();
        if (frameData.grayMat == null || frameData.grayMat.empty() || edge == null || edge.length == 0) {
            return circlesArray;
        }

        int minDimension = Math.min(frameData.width, frameData.height);
        int minRadius = Math.max(8, (int) Math.round(minDimension * PLATE_MIN_RADIUS_RATIO));
        int maxRadius = Math.max(minRadius + 2, (int) Math.round(minDimension * PLATE_MAX_RADIUS_RATIO));
        boolean hasHint = !Double.isNaN(hintX) && !Double.isNaN(hintY) && !Double.isNaN(hintRadius) && hintRadius >= minRadius;
        int hintRadiusPx = hasHint ? clampInt((int) Math.round(hintRadius), minRadius, maxRadius) : -1;
        if (hasHint) {
            int hintedMinRadius = clampInt((int) Math.round(hintRadiusPx * 0.66), minRadius, maxRadius);
            int hintedMaxRadius = clampInt((int) Math.round(hintRadiusPx * 1.42), minRadius, maxRadius);
            if (hintedMaxRadius <= hintedMinRadius) {
                hintedMaxRadius = Math.min(maxRadius, hintedMinRadius + 2);
            }
            minRadius = hintedMinRadius;
            maxRadius = hintedMaxRadius;
        }
        int globalMinX = clampInt((int) Math.round(frameData.width * TRACKING_MIN_CENTER_X_RATIO), minRadius, frameData.width - minRadius - 1);
        int globalMaxX = clampInt((int) Math.round(frameData.width * TRACKING_MAX_CENTER_X_RATIO), globalMinX + 1, frameData.width - minRadius - 1);
        int globalMaxY = clampInt((int) Math.round(frameData.height * TRACKING_MAX_CENTER_Y_RATIO), minRadius + 1, frameData.height - minRadius - 1);
        int hintCenterX = hasHint ? clampInt((int) Math.round(hintX), 0, frameData.width - 1) : -1;
        int hintCenterY = hasHint ? clampInt((int) Math.round(hintY), 0, frameData.height - 1) : -1;
        int hintXBand = hasHint ? Math.max(20, (int) Math.round(hintRadiusPx * 3.4)) : 0;
        int hintYBand = hasHint ? Math.max(16, (int) Math.round(hintRadiusPx * 2.6)) : 0;
        double minDist = hasHint
            ? Math.max(12.0, hintRadiusPx * 1.7)
            : Math.max(14.0, minDimension / 8.0);

        Mat blurred = new Mat();
        Mat circles = new Mat();
        try {
            frameData.grayMat.copyTo(blurred);
            Imgproc.medianBlur(blurred, blurred, 5);
            Imgproc.HoughCircles(
                blurred,
                circles,
                Imgproc.HOUGH_GRADIENT,
                HOUGH_DP,
                minDist,
                HOUGH_GLOBAL_PARAM_1,
                HOUGH_GLOBAL_PARAM_2,
                minRadius,
                maxRadius
            );
            if (circles.empty() || circles.cols() <= 0) {
                return circlesArray;
            }

            List<CircleCandidate> rankedCandidates = new ArrayList<>();
            int circleCount = circles.cols();
            for (int index = 0; index < circleCount; index++) {
                double[] candidate = circles.get(0, index);
                if (candidate == null || candidate.length < 3) {
                    continue;
                }

                int centerX = clampInt((int) Math.round(candidate[0]), 0, frameData.width - 1);
                int centerY = clampInt((int) Math.round(candidate[1]), 0, frameData.height - 1);
                int radius = clampInt((int) Math.round(candidate[2]), minRadius, maxRadius);
                if (centerX < globalMinX || centerX > globalMaxX || centerY < minRadius || centerY > globalMaxY) {
                    continue;
                }
                if (hasHint && (Math.abs(centerX - hintCenterX) > hintXBand || Math.abs(centerY - hintCenterY) > hintYBand)) {
                    continue;
                }
                int expanded = radius + 3;
                if (
                    centerX - expanded < 1 ||
                    centerX + expanded >= frameData.width - 1 ||
                    centerY - expanded < 1 ||
                    centerY + expanded >= frameData.height - 1
                ) {
                    continue;
                }

                CircleStats ringEdgeStats = sampleCircleStats(edge, frameData.width, frameData.height, centerX, centerY, radius);
                double ringEdge = ringEdgeStats.mean;
                if (ringEdge < 8.0) {
                    continue;
                }
                double innerEdge = sampleCircleAverage(edge, frameData.width, frameData.height, centerX, centerY, Math.max(2, radius - 2));
                double outerEdge = sampleCircleAverage(edge, frameData.width, frameData.height, centerX, centerY, radius + 2);
                double centerEdge = sampleCircleAverage(edge, frameData.width, frameData.height, centerX, centerY, Math.max(2, radius / 3));
                double edgePeak = ringEdge - ((innerEdge + outerEdge) * 0.5);
                if (edgePeak < 2.2) {
                    continue;
                }

                double ringUniformity = clamp(1.0 - (ringEdgeStats.stdDev / (ringEdge + 24.0)), 0.0, 1.0);
                if (ringUniformity < 0.05) {
                    continue;
                }
                double score = (ringEdge / 255.0) * 0.55
                    + clamp(edgePeak / 255.0, 0.0, 1.0) * 0.30
                    + ringUniformity * 0.20
                    - (centerEdge / 255.0) * 0.20;
                if (score < 0.02) {
                    continue;
                }

                CircleCandidate circleCandidate = new CircleCandidate();
                circleCandidate.x = centerX;
                circleCandidate.y = centerY;
                circleCandidate.radius = radius;
                circleCandidate.score = score;
                rankedCandidates.add(circleCandidate);
            }

            rankedCandidates.sort((left, right) -> Double.compare(right.score, left.score));
            List<CircleCandidate> filteredCandidates = new ArrayList<>();
            for (CircleCandidate candidate : rankedCandidates) {
                boolean overlaps = false;
                for (CircleCandidate kept : filteredCandidates) {
                    double minDistance = Math.max(6.0, Math.min(candidate.radius, kept.radius) * 0.9);
                    if (Math.hypot(candidate.x - kept.x, candidate.y - kept.y) < minDistance) {
                        overlaps = true;
                        break;
                    }
                }
                if (overlaps) {
                    continue;
                }
                filteredCandidates.add(candidate);
                if (filteredCandidates.size() >= MAX_DEBUG_CIRCLES) {
                    break;
                }
            }

            double referenceRadius = Double.NaN;
            if (hasHint) {
                referenceRadius = hintRadiusPx;
            } else if (!filteredCandidates.isEmpty()) {
                double strongestScore = filteredCandidates.get(0).score;
                for (CircleCandidate candidate : filteredCandidates) {
                    if (candidate.score < (strongestScore * 0.85)) {
                        break;
                    }
                    referenceRadius = Double.isNaN(referenceRadius)
                        ? candidate.radius
                        : Math.max(referenceRadius, candidate.radius);
                }
                if (Double.isNaN(referenceRadius)) {
                    referenceRadius = filteredCandidates.get(0).radius;
                }
            }
            for (CircleCandidate circle : filteredCandidates) {
                if (!Double.isNaN(referenceRadius)) {
                    double minAllowedRadius = referenceRadius * 0.66;
                    double maxAllowedRadius = referenceRadius * 1.38;
                    if (circle.radius < minAllowedRadius || circle.radius > maxAllowedRadius) {
                        continue;
                    }
                }
                JSONObject circleObject = new JSONObject();
                circleObject.put("x", roundTo3(circle.x));
                circleObject.put("y", roundTo3(circle.y));
                circleObject.put("radius", roundTo3(circle.radius));
                circleObject.put("score", roundTo3(circle.score));
                circlesArray.put(circleObject);
            }
            return circlesArray;
        } finally {
            blurred.release();
            circles.release();
        }
    }

    private CircleStats sampleCircleStats(int[] source, int width, int height, int centerX, int centerY, int radius) {
        int safeRadius = Math.max(1, radius);
        double sum = 0.0;
        double squaredSum = 0.0;
        int count = 0;

        for (int sampleIndex = 0; sampleIndex < PLATE_SAMPLE_POINTS; sampleIndex++) {
            int sampleX = (int) Math.round(centerX + PLATE_SAMPLE_COS[sampleIndex] * safeRadius);
            int sampleY = (int) Math.round(centerY + PLATE_SAMPLE_SIN[sampleIndex] * safeRadius);
            if (sampleX < 0 || sampleX >= width || sampleY < 0 || sampleY >= height) {
                continue;
            }

            double value = source[(sampleY * width) + sampleX];
            sum += value;
            squaredSum += value * value;
            count++;
        }

        CircleStats stats = new CircleStats();
        if (count == 0) {
            stats.mean = 0.0;
            stats.stdDev = 0.0;
            return stats;
        }

        stats.mean = sum / count;
        double variance = Math.max(0.0, (squaredSum / count) - (stats.mean * stats.mean));
        stats.stdDev = Math.sqrt(variance);
        return stats;
    }

    private double sampleCircleAverage(int[] source, int width, int height, int centerX, int centerY, int radius) {
        int safeRadius = Math.max(1, radius);
        double sum = 0.0;
        int count = 0;

        for (int sampleIndex = 0; sampleIndex < PLATE_SAMPLE_POINTS; sampleIndex++) {
            int sampleX = (int) Math.round(centerX + PLATE_SAMPLE_COS[sampleIndex] * safeRadius);
            int sampleY = (int) Math.round(centerY + PLATE_SAMPLE_SIN[sampleIndex] * safeRadius);
            if (sampleX < 0 || sampleX >= width || sampleY < 0 || sampleY >= height) {
                continue;
            }

            sum += source[(sampleY * width) + sampleX];
            count++;
        }

        return count == 0 ? 0.0 : sum / count;
    }

    private JSONArray buildRepSegmentsFromSeries(
        JSONArray barPathSeries,
        int analyzedFps,
        long durationMs,
        int estimatedRepCount
    ) throws Exception {
        if (barPathSeries.length() < 6) {
            return buildFallbackRepSegments(durationMs, analyzedFps, estimatedRepCount);
        }

        int count = barPathSeries.length();
        double[] ySeries = new double[count];
        int[] timeSeries = new int[count];
        double yMin = Double.POSITIVE_INFINITY;
        double yMax = Double.NEGATIVE_INFINITY;

        for (int index = 0; index < count; index++) {
            JSONObject point = barPathSeries.optJSONObject(index);
            if (point == null) {
                return buildFallbackRepSegments(durationMs, analyzedFps, estimatedRepCount);
            }
            double y = point.optDouble("y", 0.0);
            ySeries[index] = y;
            timeSeries[index] = point.optInt("tMs", index * (1000 / Math.max(1, analyzedFps)));
            yMin = Math.min(yMin, y);
            yMax = Math.max(yMax, y);
        }

        double[] smoothY = movingAverage(ySeries, 5);
        double[] dy = new double[count];
        dy[0] = 0.0;
        for (int index = 1; index < count; index++) {
            dy[index] = smoothY[index] - smoothY[index - 1];
        }
        double[] smoothDy = movingAverage(dy, 3);

        List<Integer> topIndices = new ArrayList<>();
        List<Integer> bottomIndices = new ArrayList<>();
        for (int index = 2; index < count - 1; index++) {
            double prev = smoothDy[index - 1];
            double curr = smoothDy[index];
            if (prev <= 0.0 && curr > 0.0) {
                topIndices.add(index);
            }
            if (prev >= 0.0 && curr < 0.0) {
                bottomIndices.add(index);
            }
        }

        double amplitudeThreshold = Math.max(4.0, (yMax - yMin) * 0.08);
        int minRepFrames = Math.max(6, analyzedFps / 2);
        JSONArray segments = new JSONArray();
        int repIndex = 1;
        int lastEndIndex = -1;

        for (int bottomIndex : bottomIndices) {
            Integer previousTop = findNearestTopBefore(topIndices, bottomIndex);
            Integer nextTop = findNearestTopAfter(topIndices, bottomIndex);
            if (previousTop == null || nextTop == null) {
                continue;
            }
            if (previousTop <= lastEndIndex) {
                continue;
            }
            if (nextTop - previousTop < minRepFrames) {
                continue;
            }

            double topY = Math.max(smoothY[previousTop], smoothY[nextTop]);
            double movementAmplitude = smoothY[bottomIndex] - topY;
            if (movementAmplitude < amplitudeThreshold) {
                continue;
            }

            JSONObject segment = new JSONObject();
            segment.put("repIndex", repIndex++);
            segment.put("startMs", timeSeries[previousTop]);
            segment.put("bottomMs", timeSeries[bottomIndex]);
            segment.put("endMs", timeSeries[nextTop]);
            segments.put(segment);

            lastEndIndex = nextTop;
        }

        if (segments.length() == 0) {
            return buildFallbackRepSegments(durationMs, analyzedFps, estimatedRepCount);
        }

        if (Math.abs(segments.length() - estimatedRepCount) > 1) {
            return buildFallbackRepSegments(durationMs, analyzedFps, estimatedRepCount);
        }
        return segments;
    }

    private JSONArray buildFallbackRepSegments(long durationMs, int analyzedFps, int estimatedRepCount) throws Exception {
        int repCount = Math.max(MIN_REP_COUNT, Math.min(MAX_REP_COUNT, estimatedRepCount));
        int frameCount = Math.max(2, (int) Math.round((durationMs / 1000.0) * analyzedFps));
        double lastFrameIndex = frameCount - 1;

        JSONArray segments = new JSONArray();
        for (int repIndex = 0; repIndex < repCount; repIndex++) {
            int startFrame = (int) Math.round((repIndex * lastFrameIndex) / repCount);
            int bottomFrame = (int) Math.round(((repIndex + 0.5) * lastFrameIndex) / repCount);
            int endFrame = (int) Math.round(((repIndex + 1) * lastFrameIndex) / repCount);

            JSONObject segment = new JSONObject();
            segment.put("repIndex", repIndex + 1);
            segment.put("startMs", frameToTimeMs(startFrame, analyzedFps));
            segment.put("bottomMs", frameToTimeMs(Math.max(startFrame, Math.min(bottomFrame, endFrame)), analyzedFps));
            segment.put("endMs", frameToTimeMs(Math.max(endFrame, startFrame), analyzedFps));
            segments.put(segment);
        }
        return segments;
    }

    private Integer findNearestTopBefore(List<Integer> topIndices, int pivotIndex) {
        Integer candidate = null;
        for (int topIndex : topIndices) {
            if (topIndex >= pivotIndex) {
                break;
            }
            candidate = topIndex;
        }
        return candidate;
    }

    private Integer findNearestTopAfter(List<Integer> topIndices, int pivotIndex) {
        for (int topIndex : topIndices) {
            if (topIndex > pivotIndex) {
                return topIndex;
            }
        }
        return null;
    }

    private double[] movingAverage(double[] values, int windowSize) {
        int count = values.length;
        double[] smoothed = new double[count];
        int radius = Math.max(0, windowSize / 2);

        for (int index = 0; index < count; index++) {
            int from = Math.max(0, index - radius);
            int to = Math.min(count - 1, index + radius);
            double sum = 0.0;
            int amount = 0;
            for (int cursor = from; cursor <= to; cursor++) {
                sum += values[cursor];
                amount++;
            }
            smoothed[index] = amount == 0 ? values[index] : sum / amount;
        }
        return smoothed;
    }

    private JSONArray buildFallbackBarPathSeries(int frameCount, int fps, int repCount) throws Exception {
        JSONArray series = new JSONArray();
        double frameDurationMs = 1000.0 / fps;
        int safeRepCount = Math.max(1, repCount);

        for (int frameIndex = 0; frameIndex < frameCount; frameIndex++) {
            double progress = frameCount <= 1 ? 0.0 : (double) frameIndex / (frameCount - 1);
            double cycles = progress * Math.PI * safeRepCount * 2.0;

            JSONObject point = new JSONObject();
            point.put("tMs", (int) Math.round(frameIndex * frameDurationMs));
            point.put("x", roundTo3(620.0 + (Math.sin(cycles) * 28.0) + (progress * 10.0)));
            point.put("y", roundTo3(420.0 + ((1.0 - Math.cos(cycles)) * 95.0)));
            series.put(point);
        }
        return series;
    }

    private JSONArray buildFallbackConfidenceSeries(int frameCount, int fps) throws Exception {
        JSONArray series = new JSONArray();
        double frameDurationMs = 1000.0 / fps;
        for (int frameIndex = 0; frameIndex < frameCount; frameIndex++) {
            double progress = frameCount <= 1 ? 0.0 : (double) frameIndex / (frameCount - 1);
            double oscillation = (Math.cos(progress * Math.PI * 3.0) + 1.0) * 0.5;

            JSONObject point = new JSONObject();
            point.put("tMs", (int) Math.round(frameIndex * frameDurationMs));
            point.put("score", roundTo3(0.84 + (oscillation * 0.12)));
            series.put(point);
        }
        return series;
    }

    private int estimateRepCountFromSeries(JSONArray barPathSeries, long durationMs, int analyzedFps) {
        int fallbackRepCount = estimateRepCount(durationMs);
        int count = barPathSeries.length();
        if (count < 24) {
            return fallbackRepCount;
        }

        double[] ySeries = new double[count];
        for (int index = 0; index < count; index++) {
            JSONObject point = barPathSeries.optJSONObject(index);
            if (point == null) {
                return fallbackRepCount;
            }
            ySeries[index] = point.optDouble("y", 0.0);
        }

        int smoothWindow = Math.max(5, (analyzedFps * 2) - 1);
        if (smoothWindow % 2 == 0) {
            smoothWindow += 1;
        }
        double[] smoothY = movingAverage(ySeries, smoothWindow);
        double meanY = 0.0;
        for (double y : smoothY) {
            meanY += y;
        }
        meanY /= count;

        double[] centered = new double[count];
        for (int index = 0; index < count; index++) {
            centered[index] = smoothY[index] - meanY;
        }

        int minLag = Math.max(8, analyzedFps * 2);
        int maxLag = Math.min(count / 2, analyzedFps * 10);
        if (maxLag <= minLag) {
            return fallbackRepCount;
        }

        double bestCorrelation = -1.0;
        int bestLag = -1;
        for (int lag = minLag; lag <= maxLag; lag++) {
            double numerator = 0.0;
            double energyA = 0.0;
            double energyB = 0.0;
            for (int index = 0; index < count - lag; index++) {
                double a = centered[index];
                double b = centered[index + lag];
                numerator += a * b;
                energyA += a * a;
                energyB += b * b;
            }

            double denominator = Math.sqrt(energyA * energyB);
            if (denominator <= 1e-6) {
                continue;
            }

            double correlation = numerator / denominator;
            if (correlation > bestCorrelation) {
                bestCorrelation = correlation;
                bestLag = lag;
            }
        }

        if (bestLag < 0 || bestCorrelation < 0.2) {
            return fallbackRepCount;
        }

        double periodMs = (bestLag * 1000.0) / Math.max(1, analyzedFps);
        if (periodMs <= 1.0) {
            return fallbackRepCount;
        }

        int estimatedByAutocorrelation = (int) Math.round(durationMs / periodMs);
        return Math.max(MIN_REP_COUNT, Math.min(MAX_REP_COUNT, estimatedByAutocorrelation));
    }

    private int estimateRepCount(long durationMs) {
        int repCount = (int) Math.round(durationMs / (double) TARGET_REP_DURATION_MS);
        return Math.max(MIN_REP_COUNT, Math.min(MAX_REP_COUNT, repCount));
    }

    private JSONArray buildRepMetrics(JSONArray barPathSeries, JSONArray repSegments) throws Exception {
        JSONArray metrics = new JSONArray();
        for (int index = 0; index < repSegments.length(); index++) {
            JSONObject repSegment = repSegments.optJSONObject(index);
            if (repSegment == null) {
                continue;
            }

            int repIndex = repSegment.optInt("repIndex", index + 1);
            int startMs = repSegment.optInt("startMs", 0);
            int bottomMs = repSegment.optInt("bottomMs", startMs);
            int endMs = repSegment.optInt("endMs", bottomMs);

            double bottomY = findNearestYForTime(barPathSeries, bottomMs);
            double endY = findNearestYForTime(barPathSeries, endMs);
            int concentricDurationMs = Math.max(1, endMs - bottomMs);
            int repTimeMs = Math.max(0, endMs - startMs);
            double verticalDisplacementPx = Math.max(0.0, bottomY - endY);
            double averageConcentricSpeedPxPerS = roundTo3((verticalDisplacementPx * 1000.0) / concentricDurationMs);
            double lowestConcentricSpeedPxPerS =
                roundTo3(calculateLowestConcentricSpeedPxPerS(barPathSeries, bottomMs, endMs, averageConcentricSpeedPxPerS));

            JSONObject repMetric = new JSONObject();
            repMetric.put("repIndex", repIndex);
            repMetric.put("averageConcentricSpeedPxPerS", averageConcentricSpeedPxPerS);
            repMetric.put("lowestConcentricSpeedPxPerS", lowestConcentricSpeedPxPerS);
            repMetric.put("repTimeMs", repTimeMs);
            metrics.put(repMetric);
        }

        return metrics;
    }

    private double findNearestYForTime(JSONArray barPathSeries, int targetMs) {
        if (barPathSeries.length() == 0) {
            return 0.0;
        }

        JSONObject nearestPoint = barPathSeries.optJSONObject(0);
        int nearestDelta = nearestPoint == null ? Integer.MAX_VALUE : Math.abs(nearestPoint.optInt("tMs", 0) - targetMs);
        for (int index = 1; index < barPathSeries.length(); index++) {
            JSONObject point = barPathSeries.optJSONObject(index);
            if (point == null) {
                continue;
            }

            int delta = Math.abs(point.optInt("tMs", 0) - targetMs);
            if (delta < nearestDelta) {
                nearestPoint = point;
                nearestDelta = delta;
            }
        }

        return nearestPoint == null ? 0.0 : nearestPoint.optDouble("y", 0.0);
    }

    private double calculateLowestConcentricSpeedPxPerS(
        JSONArray barPathSeries,
        int bottomMs,
        int endMs,
        double fallbackSpeedPxPerS
    ) {
        Double lowestSpeed = null;
        for (int index = 1; index < barPathSeries.length(); index++) {
            JSONObject previousPoint = barPathSeries.optJSONObject(index - 1);
            JSONObject nextPoint = barPathSeries.optJSONObject(index);
            if (previousPoint == null || nextPoint == null) {
                continue;
            }

            int previousTimeMs = previousPoint.optInt("tMs", 0);
            int nextTimeMs = nextPoint.optInt("tMs", 0);
            if (previousTimeMs < bottomMs || nextTimeMs > endMs) {
                continue;
            }

            int deltaMs = nextTimeMs - previousTimeMs;
            if (deltaMs <= 0) {
                continue;
            }

            double previousY = previousPoint.optDouble("y", 0.0);
            double nextY = nextPoint.optDouble("y", 0.0);
            double upwardSpeedPxPerS = ((previousY - nextY) * 1000.0) / deltaMs;
            if (upwardSpeedPxPerS <= 0.0) {
                continue;
            }

            if (lowestSpeed == null || upwardSpeedPxPerS < lowestSpeed) {
                lowestSpeed = upwardSpeedPxPerS;
            }
        }

        return lowestSpeed == null ? fallbackSpeedPxPerS : lowestSpeed;
    }

    private int frameToTimeMs(int frameIndex, int fps) {
        return (int) Math.round((frameIndex * 1000.0) / Math.max(1, fps));
    }

    private double calculateAverageConfidence(JSONArray confidenceSeries) {
        if (confidenceSeries.length() == 0) {
            return 0.0;
        }

        double confidenceSum = 0.0;
        for (int index = 0; index < confidenceSeries.length(); index++) {
            JSONObject point = confidenceSeries.optJSONObject(index);
            if (point != null) {
                confidenceSum += point.optDouble("score", 0.0);
            }
        }
        return confidenceSum / confidenceSeries.length();
    }

    private double roundTo3(double value) {
        return Math.round(value * 1000.0) / 1000.0;
    }

    private int clampInt(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    private double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private static class FrameData {
        int width;
        int height;
        int[] gray;
        Mat grayMat;

        void release() {
            if (grayMat != null) {
                grayMat.release();
                grayMat = null;
            }
        }
    }

    private static class TrackingSample {
        int tMs;
        double x;
        double y;
        double confidence;
    }

    private static class ManualSeedPoint {
        double normalizedX;
        double normalizedY;
    }

    private static class PlateDetection {
        boolean found;
        double x;
        double y;
        int radius;
        double score;
        double motionScore;
        double confidence;
        List<CircleCandidate> candidateCircles;
    }

    private static class CircleStats {
        double mean;
        double stdDev;
    }

    private static class CircleCandidate {
        double x;
        double y;
        double radius;
        double score;
    }

    static class FrameHoughDebugCircle {
        double x;
        double y;
        double radius;
        double score;
    }

    static class FrameHoughDebugResult {
        int frameWidth;
        int frameHeight;
        boolean found;
        double x;
        double y;
        double radius;
        double score;
        List<FrameHoughDebugCircle> initialCircles = new ArrayList<>();
        List<FrameHoughDebugCircle> houghCandidates = new ArrayList<>();
        List<FrameHoughDebugCircle> rankedHoughCandidates = new ArrayList<>();
    }

    private static class TrackingSeries {
        JSONArray barPathSeries;
        JSONArray confidenceSeries;
        int frameCount;
        double averageConfidence;
        int frameWidthPx;
        int frameHeightPx;
        JSONArray detectedCirclesAtStart;
        boolean usedFallback;
        String fallbackReason;
    }
}
