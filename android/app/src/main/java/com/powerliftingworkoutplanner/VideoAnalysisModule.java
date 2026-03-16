package com.powerliftingworkoutplanner;

import android.content.res.AssetFileDescriptor;
import android.graphics.Bitmap;
import android.media.MediaMetadataRetriever;

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

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.MappedByteBuffer;
import java.nio.channels.FileChannel;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class VideoAnalysisModule extends ReactContextBaseJavaModule {
    private static final int ANALYZED_FPS = 12;
    private static final int DEFAULT_DURATION_MS = 6000;
    private static final int MODEL_INPUT_SIZE = 320;
    private static final int MAX_CANDIDATES = 20;
    private static final int MAX_CONSECUTIVE_MISSES = 8;
    private static final int MIN_FEATURE_VECTOR_LENGTH = 5;
    private static final int MAX_FEATURE_VECTOR_LENGTH = 64;

    private static final float DETECTION_CONFIDENCE_THRESHOLD = 0.02f;
    private static final float NMS_IOU_THRESHOLD = 0.45f;
    private static final float ASSOCIATION_MAX_DISTANCE = 0.35f;
    private static final double XYXY_INTERPRETATION_MARGIN = 0.25;

    private static final String TRACKER_VERSION = "tflite-yolo26-outer-plate-v1";
    private static final String MODEL_ASSET_PATH = "models/outer_plate_yolo26n_float32.tflite";

    private static final String ERR_VIDEO_ANALYSIS = "ERR_VIDEO_ANALYSIS";
    private static final String ERR_VIDEO_ANALYSIS_DIR = "ERR_VIDEO_ANALYSIS_DIR";
    private static final String ERR_VIDEO_ANALYSIS_PREVIEW = "ERR_VIDEO_ANALYSIS_PREVIEW";
    private static final String ERR_VIDEO_ANALYSIS_NEEDS_MANUAL_SEED = "ERR_VIDEO_ANALYSIS_NEEDS_MANUAL_SEED";
    private static final String ERR_VIDEO_ANALYSIS_NO_CANDIDATE = "ERR_VIDEO_ANALYSIS_NO_CANDIDATE";
    private static final String MANUAL_SEED_REQUIRED_PREFIX = "MANUAL_SEED_REQUIRED::";

    private final Object interpreterLock = new Object();
    private Interpreter interpreter;

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
        }
        super.invalidate();
    }

    @ReactMethod
    public void prepareSquatVideoSeed(String localVideoPath, int analysisId, Promise promise) {
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        Bitmap frame = null;
        try {
            File rootDir = ensureVideoAnalysisRootDir();
            String previewFramePath = writePreviewFrame(localVideoPath, analysisId, rootDir);

            retriever.setDataSource(localVideoPath);
            frame = retriever.getFrameAtTime(0, MediaMetadataRetriever.OPTION_CLOSEST_SYNC);
            if (frame == null) {
                promise.reject(ERR_VIDEO_ANALYSIS_PREVIEW, "Could not extract preview frame");
                return;
            }

            List<DetectionCandidate> candidates = detectCandidates(frame);
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
        Bitmap firstFrame = null;
        try {
            File rootDir = ensureVideoAnalysisRootDir();
            File resultsDir = new File(rootDir, "results");
            if (!resultsDir.exists() && !resultsDir.mkdirs()) {
                promise.reject(ERR_VIDEO_ANALYSIS_DIR, "Could not create video analysis result directory");
                return;
            }

            String previewFramePath = writePreviewFrame(localVideoPath, analysisId, rootDir);
            retriever.setDataSource(localVideoPath);
            firstFrame = retriever.getFrameAtTime(0, MediaMetadataRetriever.OPTION_CLOSEST_SYNC);
            if (firstFrame == null) {
                promise.reject(ERR_VIDEO_ANALYSIS, "Could not read first frame");
                return;
            }

            List<DetectionCandidate> initialCandidates = detectCandidates(firstFrame);
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

            long durationMs = extractDurationMs(localVideoPath);
            double sourceFps = extractSourceFps(localVideoPath);
            TrackingSeries trackingSeries = extractTrackedSeries(localVideoPath, durationMs, activeSeed);

            if (trackingSeries.barPathSeries.length() < 2) {
                promise.reject(ERR_VIDEO_ANALYSIS, "Not enough tracked points for a valid result");
                return;
            }

            JSONObject result = new JSONObject();
            result.put("analysisId", analysisId);
            result.put("units", "px/s");
            result.put("barPathSeries", trackingSeries.barPathSeries);
            result.put("confidenceSeries", trackingSeries.confidenceSeries);
            result.put("repSegments", new JSONArray());
            result.put("repMetrics", new JSONArray());

            JSONObject analysisMeta = new JSONObject();
            analysisMeta.put("sourceFps", roundTo3(sourceFps));
            analysisMeta.put("analyzedFps", ANALYZED_FPS);
            analysisMeta.put("trackerVersion", TRACKER_VERSION);
            analysisMeta.put("frameCount", trackingSeries.frameCount);
            analysisMeta.put("averageConfidence", roundTo3(trackingSeries.averageConfidence));
            analysisMeta.put("trackingFrameWidthPx", trackingSeries.frameWidthPx);
            analysisMeta.put("trackingFrameHeightPx", trackingSeries.frameHeightPx);
            analysisMeta.put("manualSeedUsed", manualSelection != null);
            analysisMeta.put("initialSeedBox", activeSeed.toJsonBox());
            analysisMeta.put("detectedBoxesAtStart", toCandidatesJson(initialCandidates));
            result.put("analysisMeta", analysisMeta);

            JSONArray qualityFlags = new JSONArray();
            qualityFlags.put("ANALYSIS_NATIVE_TFLITE_YOLO26");
            qualityFlags.put("MODEL_ASSET:" + MODEL_ASSET_PATH);
            qualityFlags.put("CONF_THRESHOLD:" + DETECTION_CONFIDENCE_THRESHOLD);
            qualityFlags.put("NMS_IOU:" + NMS_IOU_THRESHOLD);
            qualityFlags.put("ANALYZED_FPS:" + ANALYZED_FPS);
            qualityFlags.put(previewFramePath == null ? "PREVIEW_FRAME_MISSING" : "PREVIEW_FRAME_READY");
            if (manualSelection != null) {
                qualityFlags.put("MANUAL_SEED_USED");
            }
            if (trackingSeries.usedHoldFallback) {
                qualityFlags.put("TRACKING_HOLD_FALLBACK_USED");
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

    private TrackingSeries extractTrackedSeries(String localVideoPath, long durationMs, SeedSelection seed) throws Exception {
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        try {
            retriever.setDataSource(localVideoPath);

            int sampleCount = (int) Math.round((durationMs / 1000.0) * ANALYZED_FPS);
            if (sampleCount < 2) {
                sampleCount = 2;
            }

            TrackingSeries series = new TrackingSeries();
            series.barPathSeries = new JSONArray();
            series.confidenceSeries = new JSONArray();
            series.frameCount = 0;
            series.frameWidthPx = 0;
            series.frameHeightPx = 0;

            double accumulatedConfidence = 0.0;
            int confidenceCount = 0;

            DetectionCandidate previousCandidate = seed.toDetectionCandidate("seed");
            DetectionSample lastSample = null;
            int consecutiveMisses = 0;

            for (int sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
                int timeMs = sampleCount <= 1
                    ? 0
                    : (int) Math.round((sampleIndex * durationMs) / (double) (sampleCount - 1));

                Bitmap frame = retriever.getFrameAtTime(timeMs * 1000L, MediaMetadataRetriever.OPTION_CLOSEST);
                if (frame == null) {
                    continue;
                }

                try {
                    if (series.frameWidthPx == 0 || series.frameHeightPx == 0) {
                        series.frameWidthPx = frame.getWidth();
                        series.frameHeightPx = frame.getHeight();
                    }

                    List<DetectionCandidate> candidates = detectCandidates(frame);
                    DetectionCandidate selected = selectTrackedCandidate(candidates, previousCandidate);
                    double score;
                    double centerX;
                    double centerY;

                    if (selected != null) {
                        consecutiveMisses = 0;
                        previousCandidate = selected;
                        score = selected.score;
                        centerX = selected.normalizedX;
                        centerY = selected.normalizedY;
                    } else {
                        consecutiveMisses += 1;
                        if (lastSample == null || consecutiveMisses > MAX_CONSECUTIVE_MISSES) {
                            throw new IllegalStateException("Tracking lost for too many consecutive frames");
                        }
                        series.usedHoldFallback = true;
                        score = 0.05;
                        centerX = lastSample.normalizedX;
                        centerY = lastSample.normalizedY;
                    }

                    lastSample = new DetectionSample();
                    lastSample.normalizedX = centerX;
                    lastSample.normalizedY = centerY;

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
                } finally {
                    frame.recycle();
                }
            }

            series.averageConfidence = confidenceCount == 0 ? 0.0 : accumulatedConfidence / confidenceCount;
            return series;
        } finally {
            try {
                retriever.release();
            } catch (Exception ignored) {
                // No-op.
            }
        }
    }

    private DetectionCandidate selectTrackedCandidate(List<DetectionCandidate> candidates, DetectionCandidate previousCandidate) {
        if (candidates.isEmpty()) {
            return null;
        }
        if (previousCandidate == null) {
            return candidates.get(0);
        }

        DetectionCandidate bestCandidate = null;
        double bestCost = Double.MAX_VALUE;
        for (DetectionCandidate candidate : candidates) {
            double dx = candidate.normalizedX - previousCandidate.normalizedX;
            double dy = candidate.normalizedY - previousCandidate.normalizedY;
            double distance = Math.hypot(dx, dy);
            if (distance > ASSOCIATION_MAX_DISTANCE) {
                continue;
            }

            double cost = distance - (candidate.score * 0.15);
            if (cost < bestCost) {
                bestCost = cost;
                bestCandidate = candidate;
            }
        }

        return bestCandidate;
    }

    private List<DetectionCandidate> detectCandidates(Bitmap frame) throws Exception {
        if (frame == null || frame.getWidth() <= 0 || frame.getHeight() <= 0) {
            return Collections.emptyList();
        }

        Interpreter activeInterpreter = getOrCreateInterpreter();
        Bitmap scaled = Bitmap.createScaledBitmap(frame, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, true);
        try {
            ByteBuffer inputBuffer = bitmapToModelInput(scaled);
            Tensor outputTensor = activeInterpreter.getOutputTensor(0);
            if (outputTensor.dataType() != DataType.FLOAT32) {
                throw new IllegalStateException("Unsupported output dtype: " + outputTensor.dataType());
            }

            int[] shape = outputTensor.shape();
            if (shape.length != 3 || shape[0] != 1) {
                throw new IllegalStateException("Unsupported output shape rank for YOLO model");
            }

            float[][][] rawOutput = new float[shape[0]][shape[1]][shape[2]];
            activeInterpreter.run(inputBuffer, rawOutput);
            List<DetectionCandidate> decoded = decodeCandidates(rawOutput);
            return applyNms(decoded);
        } finally {
            scaled.recycle();
        }
    }

    private ByteBuffer bitmapToModelInput(Bitmap bitmap) {
        ByteBuffer buffer = ByteBuffer.allocateDirect(4 * MODEL_INPUT_SIZE * MODEL_INPUT_SIZE * 3);
        buffer.order(ByteOrder.nativeOrder());
        int[] pixels = new int[MODEL_INPUT_SIZE * MODEL_INPUT_SIZE];
        bitmap.getPixels(pixels, 0, MODEL_INPUT_SIZE, 0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);

        for (int pixel : pixels) {
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

        double[] xywhGeometry = toXywhGeometry(first, second, third, fourth, false);
        double[] xyxyGeometry = toXywhGeometry(first, second, third, fourth, true);
        double xywhPenalty = geometryPenalty(xywhGeometry[0], xywhGeometry[1], xywhGeometry[2], xywhGeometry[3]);
        double xyxyPenalty = geometryPenalty(xyxyGeometry[0], xyxyGeometry[1], xyxyGeometry[2], xyxyGeometry[3]);

        double cx = xywhGeometry[0];
        double cy = xywhGeometry[1];
        double width = xywhGeometry[2];
        double height = xywhGeometry[3];
        if (xyxyPenalty + XYXY_INTERPRETATION_MARGIN < xywhPenalty) {
            cx = xyxyGeometry[0];
            cy = xyxyGeometry[1];
            width = xyxyGeometry[2];
            height = xyxyGeometry[3];
        }

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

    private double[] toXywhGeometry(double first, double second, double third, double fourth, boolean interpretAsXyxy) {
        if (!interpretAsXyxy) {
            return new double[] {first, second, third, fourth};
        }

        double left = Math.min(first, third);
        double right = Math.max(first, third);
        double top = Math.min(second, fourth);
        double bottom = Math.max(second, fourth);

        double cx = (left + right) / 2.0;
        double cy = (top + bottom) / 2.0;
        double width = right - left;
        double height = bottom - top;
        return new double[] {cx, cy, width, height};
    }

    private double geometryPenalty(double cx, double cy, double width, double height) {
        if (width <= 0.0 || height <= 0.0) {
            return 1000.0;
        }

        double penalty = 0.0;
        if (cx < 0.0 || cx > 1.0) {
            penalty += 2.0 + Math.abs(cx - 0.5);
        }
        if (cy < 0.0 || cy > 1.0) {
            penalty += 2.0 + Math.abs(cy - 0.5);
        }

        if (width < 0.01) {
            penalty += 2.0;
        }
        if (height < 0.01) {
            penalty += 2.0;
        }
        if (width > 0.6) {
            penalty += 1.5 + (width - 0.6) * 8.0;
        }
        if (height > 0.6) {
            penalty += 1.5 + (height - 0.6) * 8.0;
        }

        double aspectRatio = width / Math.max(height, 1e-6);
        penalty += Math.abs(Math.log(aspectRatio)) * 0.35;
        return penalty;
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

            Interpreter.Options options = new Interpreter.Options();
            options.setNumThreads(4);
            interpreter = new Interpreter(loadModelFile(MODEL_ASSET_PATH), options);
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

    private double roundTo3(double value) {
        return Math.round(value * 1000.0) / 1000.0;
    }

    private double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
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

        DetectionCandidate toDetectionCandidate(String fallbackId) {
            DetectionCandidate candidate = new DetectionCandidate();
            candidate.id = candidateId == null ? fallbackId : candidateId;
            candidate.normalizedX = normalizedX;
            candidate.normalizedY = normalizedY;
            candidate.normalizedWidth = normalizedWidth;
            candidate.normalizedHeight = normalizedHeight;
            candidate.score = 1.0;
            return candidate;
        }

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

    private static class TrackingSeries {
        JSONArray barPathSeries;
        JSONArray confidenceSeries;
        int frameCount;
        int frameWidthPx;
        int frameHeightPx;
        double averageConfidence;
        boolean usedHoldFallback;
    }
}
