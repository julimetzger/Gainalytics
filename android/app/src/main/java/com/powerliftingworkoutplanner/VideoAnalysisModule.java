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

public class VideoAnalysisModule extends ReactContextBaseJavaModule {
    private static final int ANALYZED_FPS = 30;
    private static final int DEFAULT_DURATION_MS = 6000;
    private static final int MIN_FRAME_COUNT = 60;
    private static final int TARGET_REP_DURATION_MS = 2500;

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
            int frameCount = Math.max(MIN_FRAME_COUNT, (int) Math.round(durationMs * (ANALYZED_FPS / 1000.0)));
            int estimatedRepCount = estimateRepCount(durationMs);
            JSONArray barPathSeries = buildBarPathSeries(frameCount, ANALYZED_FPS, estimatedRepCount);
            JSONArray confidenceSeries = buildConfidenceSeries(frameCount, ANALYZED_FPS);
            JSONArray repSegments = buildRepSegments(frameCount, ANALYZED_FPS, estimatedRepCount);
            JSONArray repMetrics = buildRepMetrics(barPathSeries, repSegments);
            double averageConfidence = calculateAverageConfidence(confidenceSeries);

            JSONObject result = new JSONObject();
            result.put("analysisId", analysisId);
            result.put("units", "px/s");
            result.put("barPathSeries", barPathSeries);
            result.put("confidenceSeries", confidenceSeries);
            result.put("repSegments", repSegments);
            result.put("repMetrics", repMetrics);

            JSONObject analysisMeta = new JSONObject();
            analysisMeta.put("sourceFps", 30);
            analysisMeta.put("analyzedFps", ANALYZED_FPS);
            analysisMeta.put("frameCount", frameCount);
            analysisMeta.put("averageConfidence", averageConfidence);
            result.put("analysisMeta", analysisMeta);

            JSONArray qualityFlags = new JSONArray();
            qualityFlags.put("ANALYSIS_NATIVE_SYNTHETIC_BAR_PATH");
            qualityFlags.put("SOURCE_VIDEO:" + localVideoPath);
            qualityFlags.put(previewFramePath == null ? "PREVIEW_FRAME_MISSING" : "PREVIEW_FRAME_READY");
            qualityFlags.put("ESTIMATED_REPS:" + estimatedRepCount);
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

    private JSONArray buildBarPathSeries(int frameCount, int fps, int repCount) throws Exception {
        JSONArray series = new JSONArray();
        double frameDurationMs = 1000.0 / fps;
        for (int frameIndex = 0; frameIndex < frameCount; frameIndex++) {
            double progress = frameCount <= 1 ? 0.0 : (double) frameIndex / (frameCount - 1);
            double cycles = progress * Math.PI * Math.max(1, repCount) * 2.0;

            JSONObject point = new JSONObject();
            point.put("tMs", (int) Math.round(frameIndex * frameDurationMs));
            point.put("x", 620.0 + (Math.sin(cycles) * 28.0) + (progress * 10.0));
            point.put("y", 420.0 + ((1.0 - Math.cos(cycles)) * 95.0));
            series.put(point);
        }
        return series;
    }

    private JSONArray buildConfidenceSeries(int frameCount, int fps) throws Exception {
        JSONArray series = new JSONArray();
        double frameDurationMs = 1000.0 / fps;
        for (int frameIndex = 0; frameIndex < frameCount; frameIndex++) {
            double progress = frameCount <= 1 ? 0.0 : (double) frameIndex / (frameCount - 1);
            double oscillation = (Math.cos(progress * Math.PI * 3.0) + 1.0) * 0.5;

            JSONObject point = new JSONObject();
            point.put("tMs", (int) Math.round(frameIndex * frameDurationMs));
            point.put("score", 0.84 + (oscillation * 0.12));
            series.put(point);
        }
        return series;
    }

    private JSONArray buildRepSegments(int frameCount, int fps, int repCount) throws Exception {
        JSONArray segments = new JSONArray();
        if (frameCount < 2) {
            return segments;
        }

        int boundedRepCount = Math.max(1, Math.min(12, repCount));
        double lastFrameIndex = frameCount - 1;
        for (int repIndex = 0; repIndex < boundedRepCount; repIndex++) {
            int startFrame = (int) Math.round((repIndex * lastFrameIndex) / boundedRepCount);
            int bottomFrame = (int) Math.round(((repIndex + 0.5) * lastFrameIndex) / boundedRepCount);
            int endFrame = (int) Math.round(((repIndex + 1) * lastFrameIndex) / boundedRepCount);

            JSONObject segment = new JSONObject();
            segment.put("repIndex", repIndex + 1);
            segment.put("startMs", frameToTimeMs(startFrame, fps));
            segment.put("bottomMs", frameToTimeMs(Math.max(startFrame, Math.min(bottomFrame, endFrame)), fps));
            segment.put("endMs", frameToTimeMs(Math.max(endFrame, startFrame), fps));
            segments.put(segment);
        }
        return segments;
    }

    private int estimateRepCount(long durationMs) {
        int repCount = (int) Math.round(durationMs / (double) TARGET_REP_DURATION_MS);
        return Math.max(1, Math.min(12, repCount));
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
        return (int) Math.round((frameIndex * 1000.0) / fps);
    }

    private double roundTo3(double value) {
        return Math.round(value * 1000.0) / 1000.0;
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
}
