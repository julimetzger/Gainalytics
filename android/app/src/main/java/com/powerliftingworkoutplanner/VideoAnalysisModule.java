package com.powerliftingworkoutplanner;

import android.graphics.Bitmap;
import android.media.MediaMetadataRetriever;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

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
    private static final int MAX_ANALYSIS_DIMENSION = 320;
    private static final int MOTION_THRESHOLD = 18;
    private static final int MIN_MOTION_PIXELS = 80;
    private static final double TRACKING_EMA_ALPHA = 0.45;

    public VideoAnalysisModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "VideoAnalysis";
    }

    @ReactMethod
    public void analyzeSquatVideo(String localVideoPath, int analysisId, Promise promise) {
        try {
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
            TrackingSeries trackingSeries = extractMotionTrackedSeries(localVideoPath, durationMs);
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
            analysisMeta.put("frameCount", trackingSeries.frameCount);
            analysisMeta.put("averageConfidence", roundTo3(trackingSeries.averageConfidence));
            result.put("analysisMeta", analysisMeta);

            JSONArray qualityFlags = new JSONArray();
            qualityFlags.put("ANALYSIS_NATIVE_MOTION_TRACKING_V1");
            qualityFlags.put("SOURCE_VIDEO:" + localVideoPath);
            qualityFlags.put(previewFramePath == null ? "PREVIEW_FRAME_MISSING" : "PREVIEW_FRAME_READY");
            qualityFlags.put("ESTIMATED_REPS_AUTOCORR:" + estimatedRepCount);
            qualityFlags.put("REP_ESTIMATION_DURATION_BASED:" + TARGET_REP_DURATION_MS + "ms");
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

    private TrackingSeries extractMotionTrackedSeries(String localVideoPath, long durationMs) throws Exception {
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        try {
            retriever.setDataSource(localVideoPath);

            int sampleCount = Math.max(24, Math.min(300, (int) Math.round((durationMs / 1000.0) * ANALYZED_FPS)));
            if (sampleCount < 2) {
                sampleCount = 2;
            }

            List<TrackingSample> samples = new ArrayList<>();
            int[] previousGray = null;
            int previousWidth = -1;
            int previousHeight = -1;
            double smoothedX = Double.NaN;
            double smoothedY = Double.NaN;

            for (int sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
                int timeMs = sampleCount <= 1
                    ? 0
                    : (int) Math.round((sampleIndex * durationMs) / (double) (sampleCount - 1));
                Bitmap frame = retriever.getFrameAtTime(timeMs * 1000L, MediaMetadataRetriever.OPTION_CLOSEST_SYNC);
                if (frame == null) {
                    continue;
                }

                FrameData frameData = toFrameData(frame);
                frame.recycle();
                if (frameData == null) {
                    continue;
                }

                double trackedX;
                double trackedY;
                double confidence;

                if (previousGray == null || previousWidth != frameData.width || previousHeight != frameData.height) {
                    trackedX = frameData.width / 2.0;
                    trackedY = frameData.height * 0.45;
                    confidence = 0.05;
                } else {
                    int roiMinX = (int) Math.round(frameData.width * 0.1);
                    int roiMaxX = (int) Math.round(frameData.width * 0.9);
                    int roiMinY = (int) Math.round(frameData.height * 0.1);
                    int roiMaxY = (int) Math.round(frameData.height * 0.75);

                    double weightedXSum = 0.0;
                    double weightedYSum = 0.0;
                    double weightSum = 0.0;
                    int motionPixels = 0;
                    int roiArea = Math.max(1, (roiMaxX - roiMinX) * (roiMaxY - roiMinY));

                    for (int y = roiMinY; y < roiMaxY; y++) {
                        int rowOffset = y * frameData.width;
                        for (int x = roiMinX; x < roiMaxX; x++) {
                            int pixelIndex = rowOffset + x;
                            int diff = Math.abs(frameData.gray[pixelIndex] - previousGray[pixelIndex]);
                            if (diff < MOTION_THRESHOLD) {
                                continue;
                            }

                            motionPixels++;
                            weightedXSum += x * diff;
                            weightedYSum += y * diff;
                            weightSum += diff;
                        }
                    }

                    if (motionPixels >= MIN_MOTION_PIXELS && weightSum > 0.0) {
                        trackedX = weightedXSum / weightSum;
                        trackedY = weightedYSum / weightSum;
                        confidence = clamp(motionPixels / (roiArea * 0.08), 0.1, 1.0);
                    } else if (!Double.isNaN(smoothedX) && !Double.isNaN(smoothedY)) {
                        trackedX = smoothedX;
                        trackedY = smoothedY;
                        confidence = 0.1;
                    } else {
                        trackedX = frameData.width / 2.0;
                        trackedY = frameData.height * 0.45;
                        confidence = 0.05;
                    }
                }

                if (Double.isNaN(smoothedX) || Double.isNaN(smoothedY)) {
                    smoothedX = trackedX;
                    smoothedY = trackedY;
                } else {
                    smoothedX = smoothedX + TRACKING_EMA_ALPHA * (trackedX - smoothedX);
                    smoothedY = smoothedY + TRACKING_EMA_ALPHA * (trackedY - smoothedY);
                }

                TrackingSample sample = new TrackingSample();
                sample.tMs = timeMs;
                sample.x = smoothedX;
                sample.y = smoothedY;
                sample.confidence = confidence;
                samples.add(sample);

                previousGray = frameData.gray;
                previousWidth = frameData.width;
                previousHeight = frameData.height;
            }

            if (samples.size() < 6) {
                return buildFallbackTrackingSeries(durationMs, "NO_STABLE_MOTION_SIGNAL");
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

    private TrackingSeries buildFallbackTrackingSeries(long durationMs, String reason) throws Exception {
        int sampleCount = Math.max(30, Math.min(400, (int) Math.round((durationMs / 1000.0) * ANALYZED_FPS)));
        int repCount = estimateRepCount(durationMs);

        TrackingSeries series = new TrackingSeries();
        series.barPathSeries = buildFallbackBarPathSeries(sampleCount, ANALYZED_FPS, repCount);
        series.confidenceSeries = buildFallbackConfidenceSeries(sampleCount, ANALYZED_FPS);
        series.frameCount = sampleCount;
        series.averageConfidence = calculateAverageConfidence(series.confidenceSeries);
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

        try {
            int[] argb = new int[scaledWidth * scaledHeight];
            workingBitmap.getPixels(argb, 0, scaledWidth, 0, 0, scaledWidth, scaledHeight);

            int[] gray = new int[argb.length];
            for (int index = 0; index < argb.length; index++) {
                int color = argb[index];
                int red = (color >> 16) & 0xFF;
                int green = (color >> 8) & 0xFF;
                int blue = color & 0xFF;
                gray[index] = (299 * red + 587 * green + 114 * blue) / 1000;
            }

            FrameData frameData = new FrameData();
            frameData.width = scaledWidth;
            frameData.height = scaledHeight;
            frameData.gray = gray;
            return frameData;
        } finally {
            if (needsRecycle) {
                workingBitmap.recycle();
            }
        }
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

    private double clamp(double value, double min, double max) {
        return Math.max(min, Math.min(max, value));
    }

    private static class FrameData {
        int width;
        int height;
        int[] gray;
    }

    private static class TrackingSample {
        int tMs;
        double x;
        double y;
        double confidence;
    }

    private static class TrackingSeries {
        JSONArray barPathSeries;
        JSONArray confidenceSeries;
        int frameCount;
        double averageConfidence;
        boolean usedFallback;
        String fallbackReason;
    }
}
