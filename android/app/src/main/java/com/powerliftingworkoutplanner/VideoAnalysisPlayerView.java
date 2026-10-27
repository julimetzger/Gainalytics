package com.powerliftingworkoutplanner;

import android.content.res.AssetFileDescriptor;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.view.TextureView;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.PlaybackParameters;
import androidx.media3.common.Player;
import androidx.media3.common.VideoSize;
import androidx.media3.exoplayer.ExoPlayer;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

public class VideoAnalysisPlayerView extends FrameLayout {
    /** JS matches on this prefix to render the "source video no longer available" state. */
    static final String SOURCE_UNAVAILABLE_PREFIX = "SOURCE_UNAVAILABLE::";
    private static final int PROGRESS_INTERVAL_MS = 50;
    private static final int PROGRESS_EVENT_INTERVAL_MS = 50;
    private static final float BACKGROUND_PATH_STROKE_WIDTH_PX = 4f;
    private static final float ACTIVE_PATH_STROKE_WIDTH_PX = 5f;
    private static final float ACTIVE_POINT_RADIUS_PX = 7f;
    private static final float POSE_LINE_WIDTH_DP = 3f;
    private static final float POSE_POINT_RADIUS_DP = 5f;
    private static final float POSE_POINT_OUTLINE_DP = 1.5f;

    private final ExoPlayer player;
    private final TextureView textureView;
    private final Handler progressHandler = new Handler(Looper.getMainLooper());
    private final List<TrackingPoint> barPathSeries = new ArrayList<>();
    private final List<RepSegmentData> repSegmentList = new ArrayList<>();
    private final Paint backgroundPathPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint activeRepPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint activeRepPointPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path backgroundPathBuffer = new Path();
    private final Path activeTrailPathBuffer = new Path();
    // GH-75: hip/knee overlay, drawn at the player's current position.
    private final List<PoseOverlayTrack> poseTracks = new ArrayList<>();
    private final Paint poseLinePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint posePointPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint posePointOutlinePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final float[] poseHipBuffer = new float[2];
    private final float[] poseKneeBuffer = new float[2];
    private int poseMaxGapMs = 0;
    private boolean showPose = true;

    private String sourcePath;
    private boolean paused = true;
    private float playbackSpeed = 1.0f;
    private boolean prepared = false;
    private int durationMs = 0;
    private int videoWidth = 0;
    private int videoHeight = 0;
    private int trackingFrameWidthPx = 0;
    private int trackingFrameHeightPx = 0;
    private int lastRequestedSeekMs = -1;
    private float fallbackMinX = 0f;
    private float fallbackMaxX = 0f;
    private float fallbackMinY = 0f;
    private float fallbackMaxY = 0f;
    private boolean hasFallbackBounds = false;
    private int lastProgressEventTimeMs = -1;
    private int currentTimeMs = 0;
    private int currentRepIndex = -1;

    private final Runnable progressRunnable = new Runnable() {
        @Override
        public void run() {
            if (!prepared) {
                return;
            }

            if (durationMs <= 0) {
                int freshDuration = getSafeDurationMs();
                if (freshDuration > 0) {
                    durationMs = freshDuration;
                    emitLoad();
                }
            }

            int nextCurrentTimeMs = getSafeCurrentPositionMs();
            updateOverlayTimeForMs(nextCurrentTimeMs);
            maybeEmitProgress(nextCurrentTimeMs, false);

            if (!paused) {
                progressHandler.postDelayed(this, PROGRESS_INTERVAL_MS);
            }
        }
    };

    private final Player.Listener playerListener = new Player.Listener() {
        @Override
        public void onPlaybackStateChanged(int playbackState) {
            if (playbackState == Player.STATE_READY) {
                prepared = true;
                durationMs = getSafeDurationMs();
                emitLoad();

                if (paused) {
                    player.pause();
                    int nextCurrentTimeMs = getSafeCurrentPositionMs();
                    updateOverlayTimeForMs(nextCurrentTimeMs);
                    maybeEmitProgress(nextCurrentTimeMs, true);
                } else {
                    player.play();
                    updateOverlayTimeForMs(getSafeCurrentPositionMs());
                    startProgressLoop();
                }
                return;
            }

            if (playbackState == Player.STATE_ENDED) {
                paused = true;
                stopProgressLoop();
                int endTimeMs = Math.max(getSafeDurationMs(), getSafeCurrentPositionMs());
                updateOverlayTimeForMs(endTimeMs);
                maybeEmitProgress(endTimeMs, true);
                emitEnd();
            }
        }

        @Override
        public void onVideoSizeChanged(VideoSize size) {
            videoWidth = Math.max(0, size.width);
            videoHeight = Math.max(0, size.height);
            if (prepared) {
                emitLoad();
                updateOverlayTimeForMs(getSafeCurrentPositionMs());
            } else {
                postInvalidateOnAnimation();
            }
        }

        @Override
        public void onPlayerError(PlaybackException error) {
            emitError(error.getMessage() == null ? "Player error" : error.getMessage());
            stopProgressLoop();
            paused = true;
            prepared = false;
            updateOverlayTimeForMs(0);
        }
    };

    public VideoAnalysisPlayerView(@NonNull ReactContext context) {
        super(context);
        setWillNotDraw(false);

        initializePaints();

        player = new ExoPlayer.Builder(context).build();
        player.addListener(playerListener);

        textureView = new TextureView(context);
        textureView.setLayoutParams(
            new LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        );
        addView(textureView);
        player.setVideoTextureView(textureView);
    }

    public void setSourcePath(String path) {
        if (path == null || path.isEmpty() || path.equals(sourcePath)) {
            return;
        }

        sourcePath = path;
        prepared = false;
        durationMs = 0;
        videoWidth = 0;
        videoHeight = 0;
        currentTimeMs = 0;
        lastRequestedSeekMs = -1;
        resetProgressEventState();
        stopProgressLoop();
        postInvalidateOnAnimation();

        Uri mediaUri;
        if (path.startsWith("content://")) {
            mediaUri = Uri.parse(path);
            if (!isContentUriReadable(mediaUri)) {
                emitError(SOURCE_UNAVAILABLE_PREFIX + path);
                return;
            }
        } else {
            String normalizedPath = path.startsWith("file://") ? path.substring(7) : path;
            File file = new File(normalizedPath);
            if (!file.exists()) {
                emitError(SOURCE_UNAVAILABLE_PREFIX + normalizedPath);
                return;
            }
            mediaUri = Uri.fromFile(file);
        }

        MediaItem mediaItem = MediaItem.fromUri(mediaUri);
        player.setMediaItem(mediaItem);
        player.prepare();

        if (paused) {
            player.pause();
        } else {
            player.play();
        }
    }

    public void setPaused(boolean shouldPause) {
        paused = shouldPause;

        if (paused) {
            player.pause();
            stopProgressLoop();
            if (prepared) {
                int nextCurrentTimeMs = getSafeCurrentPositionMs();
                updateOverlayTimeForMs(nextCurrentTimeMs);
                maybeEmitProgress(nextCurrentTimeMs, true);
            }
            return;
        }

        player.play();
        if (prepared) {
            updateOverlayTimeForMs(getSafeCurrentPositionMs());
            startProgressLoop();
        }
    }

    public void setSeekPositionMs(int seekPositionMs) {
        if (seekPositionMs < 0) {
            return;
        }

        int clampedSeekMs = durationMs > 0 ? Math.min(seekPositionMs, durationMs) : seekPositionMs;
        if (Math.abs(clampedSeekMs - lastRequestedSeekMs) < 16) {
            return;
        }

        lastRequestedSeekMs = clampedSeekMs;
        player.seekTo(clampedSeekMs);
        updateOverlayTimeForMs(clampedSeekMs);
        if (prepared) {
            maybeEmitProgress(clampedSeekMs, true);
        }
    }

    public void setBarPathSeries(@Nullable ReadableArray points) {
        barPathSeries.clear();
        if (points != null) {
            for (int index = 0; index < points.size(); index++) {
                ReadableMap point = points.getMap(index);
                if (point == null) {
                    continue;
                }

                TrackingPoint trackingPoint = new TrackingPoint();
                trackingPoint.tMs = point.hasKey("tMs") ? (int) Math.round(point.getDouble("tMs")) : 0;
                trackingPoint.x = point.hasKey("x") ? (float) point.getDouble("x") : 0f;
                trackingPoint.y = point.hasKey("y") ? (float) point.getDouble("y") : 0f;
                barPathSeries.add(trackingPoint);
            }
        }

        recalculateFallbackBounds();
        postInvalidateOnAnimation();
    }

    public void setRepSegments(@Nullable ReadableArray segments) {
        repSegmentList.clear();
        if (segments != null) {
            for (int index = 0; index < segments.size(); index++) {
                ReadableMap segment = segments.getMap(index);
                if (segment == null) {
                    continue;
                }

                RepSegmentData repSegment = new RepSegmentData();
                repSegment.repIndex = segment.hasKey("repIndex") ? segment.getInt("repIndex") : index;
                repSegment.startMs = segment.hasKey("startMs") ? (int) Math.round(segment.getDouble("startMs")) : 0;
                repSegment.turnaroundMs = segment.hasKey("turnaroundMs") ? (int) Math.round(segment.getDouble("turnaroundMs")) : 0;
                repSegment.endMs = segment.hasKey("endMs") ? (int) Math.round(segment.getDouble("endMs")) : 0;
                repSegmentList.add(repSegment);
            }
        }

        postInvalidateOnAnimation();
    }

    public void setCurrentRepIndex(int repIndex) {
        currentRepIndex = repIndex >= 0 ? repIndex : -1;
        postInvalidateOnAnimation();
    }

    public void setPrimaryColor(int color) {
        activeRepPaint.setColor(color);
        activeRepPointPaint.setColor(color);
        postInvalidateOnAnimation();
    }

    public void setPathColor(int color) {
        backgroundPathPaint.setColor(color);
        postInvalidateOnAnimation();
    }

    public void setPoseTracks(@Nullable ReadableArray tracks) {
        poseTracks.clear();
        if (tracks != null) {
            for (int trackIndex = 0; trackIndex < tracks.size(); trackIndex++) {
                ReadableMap track = tracks.getMap(trackIndex);
                ReadableArray samples = track != null && track.hasKey("samples") ? track.getArray("samples") : null;
                if (samples == null) {
                    continue;
                }
                PoseOverlayTrack overlayTrack = new PoseOverlayTrack(samples.size());
                for (int index = 0; index < samples.size(); index++) {
                    ReadableMap sample = samples.getMap(index);
                    overlayTrack.tMs[index] = sample != null && sample.hasKey("tMs") ? (int) Math.round(sample.getDouble("tMs")) : 0;
                    overlayTrack.xs[PoseOverlayTrack.HIP][index] = readPoseCoordinate(sample, "hipX");
                    overlayTrack.ys[PoseOverlayTrack.HIP][index] = readPoseCoordinate(sample, "hipY");
                    overlayTrack.xs[PoseOverlayTrack.KNEE][index] = readPoseCoordinate(sample, "kneeX");
                    overlayTrack.ys[PoseOverlayTrack.KNEE][index] = readPoseCoordinate(sample, "kneeY");
                }
                poseTracks.add(overlayTrack);
            }
        }
        postInvalidateOnAnimation();
    }

    private static float readPoseCoordinate(@Nullable ReadableMap sample, String key) {
        return sample != null && sample.hasKey(key) && !sample.isNull(key) ? (float) sample.getDouble(key) : Float.NaN;
    }

    public void setPoseMaxGapMs(int maxGapMs) {
        poseMaxGapMs = Math.max(0, maxGapMs);
        postInvalidateOnAnimation();
    }

    public void setShowPose(boolean shouldShowPose) {
        showPose = shouldShowPose;
        postInvalidateOnAnimation();
    }

    public void setPlaybackSpeed(float speed) {
        playbackSpeed = Math.max(0.1f, Math.min(1.0f, speed));
        player.setPlaybackParameters(new PlaybackParameters(playbackSpeed));
    }

    public void setTrackingFrameWidthPx(int widthPx) {
        trackingFrameWidthPx = Math.max(0, widthPx);
        postInvalidateOnAnimation();
    }

    public void setTrackingFrameHeightPx(int heightPx) {
        trackingFrameHeightPx = Math.max(0, heightPx);
        postInvalidateOnAnimation();
    }

    public void onDropView() {
        stopProgressLoop();
        player.removeListener(playerListener);
        player.clearVideoTextureView(textureView);
        player.release();
        resetProgressEventState();
    }

    @Override
    protected void dispatchDraw(Canvas canvas) {
        super.dispatchDraw(canvas);
        drawBarPathOverlay(canvas);
        drawPoseOverlay(canvas);

        if (prepared && !paused) {
            postInvalidateOnAnimation();
        }
    }

    private void initializePaints() {
        backgroundPathPaint.setStyle(Paint.Style.STROKE);
        backgroundPathPaint.setStrokeWidth(BACKGROUND_PATH_STROKE_WIDTH_PX);
        backgroundPathPaint.setStrokeCap(Paint.Cap.ROUND);
        backgroundPathPaint.setStrokeJoin(Paint.Join.ROUND);

        activeRepPaint.setStyle(Paint.Style.STROKE);
        activeRepPaint.setStrokeWidth(ACTIVE_PATH_STROKE_WIDTH_PX);
        activeRepPaint.setStrokeCap(Paint.Cap.ROUND);
        activeRepPaint.setStrokeJoin(Paint.Join.ROUND);

        activeRepPointPaint.setStyle(Paint.Style.FILL);

        float density = getResources().getDisplayMetrics().density;
        poseLinePaint.setStyle(Paint.Style.STROKE);
        poseLinePaint.setStrokeWidth(POSE_LINE_WIDTH_DP * density);
        poseLinePaint.setStrokeCap(Paint.Cap.ROUND);
        poseLinePaint.setColor(0xE6FFFFFF);
        posePointPaint.setStyle(Paint.Style.FILL);
        posePointPaint.setColor(0xFF00E5FF);
        posePointOutlinePaint.setStyle(Paint.Style.STROKE);
        posePointOutlinePaint.setStrokeWidth(POSE_POINT_OUTLINE_DP * density);
        posePointOutlinePaint.setColor(0xFFFFFFFF);
    }

    private void startProgressLoop() {
        stopProgressLoop();
        progressHandler.post(progressRunnable);
    }

    private void stopProgressLoop() {
        progressHandler.removeCallbacks(progressRunnable);
    }

    private void updateOverlayTimeForMs(int timeMs) {
        currentTimeMs = Math.max(0, timeMs);
        postInvalidateOnAnimation();
    }

    private void drawBarPathOverlay(Canvas canvas) {
        if (barPathSeries.isEmpty()) {
            return;
        }

        int viewWidth = getWidth();
        int viewHeight = getHeight();
        if (viewWidth <= 0 || viewHeight <= 0) {
            return;
        }

        float sourceWidth = trackingFrameWidthPx > 0 ? trackingFrameWidthPx : (videoWidth > 0 ? videoWidth : viewWidth);
        float sourceHeight = trackingFrameHeightPx > 0 ? trackingFrameHeightPx : (videoHeight > 0 ? videoHeight : viewHeight);
        if (sourceWidth <= 0f || sourceHeight <= 0f) {
            return;
        }

        float scale = Math.min(viewWidth / sourceWidth, viewHeight / sourceHeight);
        float renderedWidth = sourceWidth * scale;
        float renderedHeight = sourceHeight * scale;
        float offsetX = (viewWidth - renderedWidth) / 2f;
        float offsetY = (viewHeight - renderedHeight) / 2f;
        boolean useTrackingFrame = trackingFrameWidthPx > 0 && trackingFrameHeightPx > 0;
        int drawTimeMs = resolveDrawTimeMs();

        backgroundPathBuffer.reset();
        boolean hasBackgroundPath = false;
        for (TrackingPoint point : barPathSeries) {
            float mappedX = mapX(point.x, offsetX, renderedWidth, sourceWidth, useTrackingFrame);
            float mappedY = mapY(point.y, offsetY, renderedHeight, sourceHeight, useTrackingFrame);
            if (!hasBackgroundPath) {
                backgroundPathBuffer.moveTo(mappedX, mappedY);
                hasBackgroundPath = true;
            } else {
                backgroundPathBuffer.lineTo(mappedX, mappedY);
            }
        }
        if (hasBackgroundPath) {
            canvas.drawPath(backgroundPathBuffer, backgroundPathPaint);
        }

        RepSegmentData activeRep = findActiveRep(drawTimeMs);
        if (activeRep == null) {
            return;
        }

        activeTrailPathBuffer.reset();
        int visibleTrailPointCount = 0;
        float lastTrailX = Float.NaN;
        float lastTrailY = Float.NaN;
        for (TrackingPoint point : barPathSeries) {
            if (point.tMs < activeRep.startMs) {
                continue;
            }
            if (point.tMs > drawTimeMs) {
                break;
            }

            float mappedX = mapX(point.x, offsetX, renderedWidth, sourceWidth, useTrackingFrame);
            float mappedY = mapY(point.y, offsetY, renderedHeight, sourceHeight, useTrackingFrame);
            if (visibleTrailPointCount == 0) {
                activeTrailPathBuffer.moveTo(mappedX, mappedY);
            } else {
                activeTrailPathBuffer.lineTo(mappedX, mappedY);
            }
            visibleTrailPointCount += 1;
            lastTrailX = mappedX;
            lastTrailY = mappedY;
        }

        if (visibleTrailPointCount > 1) {
            canvas.drawPath(activeTrailPathBuffer, activeRepPaint);
        }
        if (visibleTrailPointCount > 0 && !Float.isNaN(lastTrailX) && !Float.isNaN(lastTrailY)) {
            canvas.drawCircle(lastTrailX, lastTrailY, ACTIVE_POINT_RADIUS_PX, activeRepPointPaint);
        }
    }

    private void drawPoseOverlay(Canvas canvas) {
        if (!showPose || poseTracks.isEmpty()) {
            return;
        }
        int viewWidth = getWidth();
        int viewHeight = getHeight();
        float sourceWidth = trackingFrameWidthPx > 0 ? trackingFrameWidthPx : videoWidth;
        float sourceHeight = trackingFrameHeightPx > 0 ? trackingFrameHeightPx : videoHeight;
        if (viewWidth <= 0 || viewHeight <= 0 || sourceWidth <= 0f || sourceHeight <= 0f) {
            return;
        }

        // Same fit-centre mapping as the bar path; pose x/y are normalised to the video frame.
        float scale = Math.min(viewWidth / sourceWidth, viewHeight / sourceHeight);
        float renderedWidth = sourceWidth * scale;
        float renderedHeight = sourceHeight * scale;
        float offsetX = (viewWidth - renderedWidth) / 2f;
        float offsetY = (viewHeight - renderedHeight) / 2f;
        int drawTimeMs = resolveDrawTimeMs();
        float radius = POSE_POINT_RADIUS_DP * getResources().getDisplayMetrics().density;

        for (PoseOverlayTrack track : poseTracks) {
            boolean hipVisible = track.interpolate(PoseOverlayTrack.HIP, drawTimeMs, poseMaxGapMs, poseHipBuffer);
            boolean kneeVisible = track.interpolate(PoseOverlayTrack.KNEE, drawTimeMs, poseMaxGapMs, poseKneeBuffer);
            float hipX = offsetX + poseHipBuffer[0] * renderedWidth;
            float hipY = offsetY + poseHipBuffer[1] * renderedHeight;
            float kneeX = offsetX + poseKneeBuffer[0] * renderedWidth;
            float kneeY = offsetY + poseKneeBuffer[1] * renderedHeight;
            if (hipVisible && kneeVisible) {
                canvas.drawLine(hipX, hipY, kneeX, kneeY, poseLinePaint);
            }
            if (hipVisible) {
                canvas.drawCircle(hipX, hipY, radius, posePointPaint);
                canvas.drawCircle(hipX, hipY, radius, posePointOutlinePaint);
            }
            if (kneeVisible) {
                canvas.drawCircle(kneeX, kneeY, radius, posePointPaint);
                canvas.drawCircle(kneeX, kneeY, radius, posePointOutlinePaint);
            }
        }
    }

    private int resolveDrawTimeMs() {
        if (!prepared || paused) {
            return currentTimeMs;
        }

        currentTimeMs = getSafeCurrentPositionMs();
        return currentTimeMs;
    }

    @Nullable
    private RepSegmentData findActiveRep(int timeMs) {
        if (repSegmentList.isEmpty()) {
            return null;
        }

        if (currentRepIndex >= 0) {
            for (RepSegmentData segment : repSegmentList) {
                if (
                    segment.repIndex == currentRepIndex &&
                    timeMs >= segment.startMs &&
                    timeMs <= segment.endMs
                ) {
                    return segment;
                }
            }
        }

        for (RepSegmentData segment : repSegmentList) {
            if (timeMs >= segment.startMs && timeMs <= segment.endMs) {
                return segment;
            }
        }

        return null;
    }

    private float mapX(float x, float offsetX, float renderedWidth, float sourceWidth, boolean useTrackingFrame) {
        float mappedX;
        if (useTrackingFrame) {
            mappedX = offsetX + x * (renderedWidth / sourceWidth);
        } else if (hasFallbackBounds) {
            float xSpan = Math.max(1f, fallbackMaxX - fallbackMinX);
            mappedX = offsetX + ((x - fallbackMinX) / xSpan) * renderedWidth;
        } else {
            mappedX = offsetX + renderedWidth * 0.5f;
        }

        return clampFloat(mappedX, 0f, getWidth());
    }

    private float mapY(float y, float offsetY, float renderedHeight, float sourceHeight, boolean useTrackingFrame) {
        float mappedY;
        if (useTrackingFrame) {
            mappedY = offsetY + y * (renderedHeight / sourceHeight);
        } else if (hasFallbackBounds) {
            float ySpan = Math.max(1f, fallbackMaxY - fallbackMinY);
            mappedY = offsetY + ((y - fallbackMinY) / ySpan) * renderedHeight;
        } else {
            mappedY = offsetY + renderedHeight * 0.5f;
        }

        return clampFloat(mappedY, 0f, getHeight());
    }

    private void recalculateFallbackBounds() {
        if (barPathSeries.isEmpty()) {
            hasFallbackBounds = false;
            fallbackMinX = 0f;
            fallbackMaxX = 0f;
            fallbackMinY = 0f;
            fallbackMaxY = 0f;
            return;
        }

        float minX = Float.POSITIVE_INFINITY;
        float maxX = Float.NEGATIVE_INFINITY;
        float minY = Float.POSITIVE_INFINITY;
        float maxY = Float.NEGATIVE_INFINITY;
        for (TrackingPoint point : barPathSeries) {
            minX = Math.min(minX, point.x);
            maxX = Math.max(maxX, point.x);
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        }

        fallbackMinX = minX;
        fallbackMaxX = maxX;
        fallbackMinY = minY;
        fallbackMaxY = maxY;
        hasFallbackBounds = true;
    }

    private int getSafeCurrentPositionMs() {
        long positionMs = player.getCurrentPosition();
        if (positionMs <= 0) {
            return 0;
        }
        if (positionMs >= Integer.MAX_VALUE) {
            return Integer.MAX_VALUE;
        }
        return (int) positionMs;
    }

    private int getSafeDurationMs() {
        long durationValue = player.getDuration();
        if (durationValue == C.TIME_UNSET || durationValue <= 0) {
            return 0;
        }
        if (durationValue >= Integer.MAX_VALUE) {
            return Integer.MAX_VALUE;
        }
        return (int) durationValue;
    }

    private float clampFloat(float value, float min, float max) {
        return Math.max(min, Math.min(max, value));
    }

    private void emitLoad() {
        WritableMap payload = Arguments.createMap();
        payload.putInt("durationMs", Math.max(0, durationMs));
        payload.putInt("videoWidth", Math.max(0, videoWidth));
        payload.putInt("videoHeight", Math.max(0, videoHeight));
        dispatchEvent("onLoad", payload);
    }

    private void emitProgress(int nextCurrentTimeMs) {
        WritableMap payload = Arguments.createMap();
        payload.putInt("currentTimeMs", Math.max(0, nextCurrentTimeMs));
        payload.putInt("durationMs", Math.max(0, durationMs));
        dispatchEvent("onProgress", payload);
    }

    private void maybeEmitProgress(int nextCurrentTimeMs, boolean forceEmit) {
        if (!forceEmit && lastProgressEventTimeMs >= 0) {
            int elapsedSinceLastEvent = Math.abs(nextCurrentTimeMs - lastProgressEventTimeMs);
            if (elapsedSinceLastEvent < PROGRESS_EVENT_INTERVAL_MS) {
                return;
            }
        }

        lastProgressEventTimeMs = Math.max(0, nextCurrentTimeMs);
        emitProgress(nextCurrentTimeMs);
    }

    private void resetProgressEventState() {
        lastProgressEventTimeMs = -1;
    }

    private void emitEnd() {
        dispatchEvent("onEnd", Arguments.createMap());
    }

    /**
     * A gallery-backed video can vanish (user deleted it) or its grant can be revoked.
     * Probing the descriptor keeps ExoPlayer from surfacing a raw decoder error.
     */
    private boolean isContentUriReadable(Uri uri) {
        try (AssetFileDescriptor descriptor = getContext().getContentResolver().openAssetFileDescriptor(uri, "r")) {
            return descriptor != null;
        } catch (Exception error) {
            return false;
        }
    }

    private void emitError(String message) {
        WritableMap payload = Arguments.createMap();
        payload.putString("message", message);
        dispatchEvent("onError", payload);
    }

    private void dispatchEvent(String eventName, WritableMap payload) {
        ReactContext reactContext = (ReactContext) getContext();
        reactContext
            .getJSModule(RCTEventEmitter.class)
            .receiveEvent(getId(), eventName, payload);
    }

    private static final class TrackingPoint {
        int tMs;
        float x;
        float y;
    }

    private static final class RepSegmentData {
        int repIndex;
        int startMs;
        int turnaroundMs;
        int endMs;
    }
}
