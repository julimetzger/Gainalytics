package com.powerliftingworkoutplanner;

import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.view.ViewGroup;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.VideoView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;

import java.util.ArrayList;
import java.io.File;
import java.util.List;

public class VideoAnalysisPlayerView extends FrameLayout {
    private static final int PROGRESS_INTERVAL_MS = 100;

    private final VideoView videoView;
    private final OverlayDotView overlayView;
    private final Handler progressHandler = new Handler(Looper.getMainLooper());
    private final List<TrackingPoint> barPathSeries = new ArrayList<>();

    private String sourcePath;
    private boolean paused = true;
    private boolean prepared = false;
    private int durationMs = 0;
    private int videoWidth = 0;
    private int videoHeight = 0;
    private int trackingFrameWidthPx = 0;
    private int trackingFrameHeightPx = 0;
    private float fallbackMinX = 0f;
    private float fallbackMaxX = 0f;
    private float fallbackMinY = 0f;
    private float fallbackMaxY = 0f;
    private boolean hasFallbackBounds = false;

    private final Runnable progressRunnable = new Runnable() {
        @Override
        public void run() {
            if (!prepared) {
                return;
            }

            int currentTimeMs = videoView.getCurrentPosition();
            updateOverlayPointForTimeMs(currentTimeMs);
            emitProgress(currentTimeMs);
            // Keep polling while playback is not paused. VideoView.isPlaying() can
            // briefly return false during transient buffering and would otherwise
            // stop progress updates permanently.
            if (!paused) {
                progressHandler.postDelayed(this, PROGRESS_INTERVAL_MS);
            }
        }
    };

    public VideoAnalysisPlayerView(@NonNull ReactContext context) {
        super(context);
        videoView = new VideoView(context);
        LayoutParams layoutParams = new LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        );
        videoView.setLayoutParams(layoutParams);
        addView(videoView);
        overlayView = new OverlayDotView(context);
        overlayView.setLayoutParams(layoutParams);
        overlayView.setClickable(false);
        overlayView.setFocusable(false);
        addView(overlayView);
        configureListeners();
    }

    private void configureListeners() {
        videoView.setOnPreparedListener(new MediaPlayer.OnPreparedListener() {
            @Override
            public void onPrepared(MediaPlayer mediaPlayer) {
                prepared = true;
                durationMs = videoView.getDuration();
                videoWidth = mediaPlayer.getVideoWidth();
                videoHeight = mediaPlayer.getVideoHeight();
                emitLoad();
                if (!paused) {
                    videoView.start();
                    updateOverlayPointForTimeMs(videoView.getCurrentPosition());
                    startProgressLoop();
                } else {
                    videoView.pause();
                    updateOverlayPointForTimeMs(0);
                    emitProgress(0);
                }
            }
        });

        videoView.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
            @Override
            public void onCompletion(MediaPlayer mediaPlayer) {
                paused = true;
                stopProgressLoop();
                updateOverlayPointForTimeMs(Math.max(durationMs, videoView.getCurrentPosition()));
                emitEnd();
            }
        });

        videoView.setOnErrorListener(new MediaPlayer.OnErrorListener() {
            @Override
            public boolean onError(MediaPlayer mediaPlayer, int what, int extra) {
                emitError("MediaPlayer error " + what + ":" + extra);
                stopProgressLoop();
                paused = true;
                overlayView.clearPoint();
                return true;
            }
        });
    }

    public void setSourcePath(String path) {
        if (path == null || path.isEmpty()) {
            return;
        }
        if (path.equals(sourcePath)) {
            return;
        }

        sourcePath = path;
        prepared = false;
        stopProgressLoop();
        overlayView.clearPoint();

        String normalized = path.startsWith("file://") ? path.substring(7) : path;
        File file = new File(normalized);
        if (!file.exists()) {
            emitError("Video source not found: " + normalized);
            return;
        }

        videoView.setVideoURI(Uri.fromFile(file));
        videoView.requestFocus();
        videoView.start();
        if (paused) {
            videoView.pause();
        }
    }

    public void setPaused(boolean shouldPause) {
        paused = shouldPause;
        if (!prepared) {
            return;
        }

        if (paused) {
            videoView.pause();
            stopProgressLoop();
            int currentTimeMs = videoView.getCurrentPosition();
            updateOverlayPointForTimeMs(currentTimeMs);
            emitProgress(currentTimeMs);
        } else {
            videoView.start();
            updateOverlayPointForTimeMs(videoView.getCurrentPosition());
            startProgressLoop();
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
        if (prepared) {
            updateOverlayPointForTimeMs(videoView.getCurrentPosition());
        } else {
            overlayView.clearPoint();
        }
    }

    public void setTrackingFrameWidthPx(int widthPx) {
        trackingFrameWidthPx = Math.max(0, widthPx);
        if (prepared) {
            updateOverlayPointForTimeMs(videoView.getCurrentPosition());
        }
    }

    public void setTrackingFrameHeightPx(int heightPx) {
        trackingFrameHeightPx = Math.max(0, heightPx);
        if (prepared) {
            updateOverlayPointForTimeMs(videoView.getCurrentPosition());
        }
    }

    public void onDropView() {
        stopProgressLoop();
        videoView.stopPlayback();
        overlayView.clearPoint();
    }

    private void startProgressLoop() {
        stopProgressLoop();
        progressHandler.post(progressRunnable);
    }

    private void stopProgressLoop() {
        progressHandler.removeCallbacks(progressRunnable);
    }

    private void updateOverlayPointForTimeMs(int currentTimeMs) {
        if (barPathSeries.isEmpty()) {
            overlayView.clearPoint();
            return;
        }

        TrackingPoint nearestPoint = findNearestPointForTimeMs(currentTimeMs);
        if (nearestPoint == null) {
            overlayView.clearPoint();
            return;
        }

        float[] mappedPoint = mapPointToOverlay(nearestPoint);
        if (mappedPoint == null) {
            overlayView.clearPoint();
            return;
        }

        overlayView.setPoint(mappedPoint[0], mappedPoint[1]);
    }

    @Nullable
    private TrackingPoint findNearestPointForTimeMs(int targetMs) {
        if (barPathSeries.isEmpty()) {
            return null;
        }
        if (barPathSeries.size() == 1) {
            return barPathSeries.get(0);
        }

        TrackingPoint firstPoint = barPathSeries.get(0);
        TrackingPoint lastPoint = barPathSeries.get(barPathSeries.size() - 1);
        if (targetMs <= firstPoint.tMs) {
            return firstPoint;
        }
        if (targetMs >= lastPoint.tMs) {
            return lastPoint;
        }

        int low = 0;
        int high = barPathSeries.size() - 1;
        while (low <= high) {
            int middle = (low + high) / 2;
            TrackingPoint middlePoint = barPathSeries.get(middle);
            if (middlePoint.tMs == targetMs) {
                return middlePoint;
            }
            if (middlePoint.tMs < targetMs) {
                low = middle + 1;
            } else {
                high = middle - 1;
            }
        }

        int rightIndex = clampInt(low, 0, barPathSeries.size() - 1);
        int leftIndex = clampInt(rightIndex - 1, 0, barPathSeries.size() - 1);
        TrackingPoint leftPoint = barPathSeries.get(leftIndex);
        TrackingPoint rightPoint = barPathSeries.get(rightIndex);
        int leftDelta = Math.abs(targetMs - leftPoint.tMs);
        int rightDelta = Math.abs(rightPoint.tMs - targetMs);
        return leftDelta <= rightDelta ? leftPoint : rightPoint;
    }

    @Nullable
    private float[] mapPointToOverlay(TrackingPoint point) {
        int viewWidth = overlayView.getWidth();
        int viewHeight = overlayView.getHeight();
        if (viewWidth <= 0 || viewHeight <= 0) {
            return null;
        }

        float sourceWidth = videoWidth > 0 ? videoWidth : (trackingFrameWidthPx > 0 ? trackingFrameWidthPx : viewWidth);
        float sourceHeight = videoHeight > 0 ? videoHeight : (trackingFrameHeightPx > 0 ? trackingFrameHeightPx : viewHeight);
        if (sourceWidth <= 0f || sourceHeight <= 0f) {
            return null;
        }

        float scale = Math.min(viewWidth / sourceWidth, viewHeight / sourceHeight);
        float renderedWidth = sourceWidth * scale;
        float renderedHeight = sourceHeight * scale;
        float offsetX = (viewWidth - renderedWidth) / 2f;
        float offsetY = (viewHeight - renderedHeight) / 2f;

        float mappedX;
        float mappedY;
        if (trackingFrameWidthPx > 0 && trackingFrameHeightPx > 0) {
            mappedX = offsetX + point.x * (renderedWidth / trackingFrameWidthPx);
            mappedY = offsetY + point.y * (renderedHeight / trackingFrameHeightPx);
        } else if (hasFallbackBounds) {
            float xSpan = Math.max(1f, fallbackMaxX - fallbackMinX);
            float ySpan = Math.max(1f, fallbackMaxY - fallbackMinY);
            mappedX = offsetX + ((point.x - fallbackMinX) / xSpan) * renderedWidth;
            mappedY = offsetY + ((point.y - fallbackMinY) / ySpan) * renderedHeight;
        } else {
            mappedX = offsetX + (renderedWidth * 0.5f);
            mappedY = offsetY + (renderedHeight * 0.5f);
        }

        float clampedX = clampFloat(mappedX, 0f, viewWidth);
        float clampedY = clampFloat(mappedY, 0f, viewHeight);
        return new float[] {clampedX, clampedY};
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

    private int clampInt(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
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

    private void emitProgress(int currentTimeMs) {
        WritableMap payload = Arguments.createMap();
        payload.putInt("currentTimeMs", Math.max(0, currentTimeMs));
        payload.putInt("durationMs", Math.max(0, durationMs));
        dispatchEvent("onProgress", payload);
    }

    private void emitEnd() {
        dispatchEvent("onEnd", Arguments.createMap());
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

    private static class TrackingPoint {
        int tMs;
        float x;
        float y;
    }

    private static class OverlayDotView extends View {
        private static final float DOT_RADIUS_PX = 8f;

        private final Paint dotPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private float pointX = Float.NaN;
        private float pointY = Float.NaN;

        OverlayDotView(ReactContext context) {
            super(context);
            dotPaint.setColor(Color.argb(230, 255, 90, 90));
            setWillNotDraw(false);
        }

        void setPoint(float x, float y) {
            pointX = x;
            pointY = y;
            postInvalidateOnAnimation();
        }

        void clearPoint() {
            if (Float.isNaN(pointX) && Float.isNaN(pointY)) {
                return;
            }
            pointX = Float.NaN;
            pointY = Float.NaN;
            postInvalidateOnAnimation();
        }

        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            if (Float.isNaN(pointX) || Float.isNaN(pointY)) {
                return;
            }
            canvas.drawCircle(pointX, pointY, DOT_RADIUS_PX, dotPaint);
        }
    }
}
