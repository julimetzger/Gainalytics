package com.powerliftingworkoutplanner;

import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.VideoView;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;

import java.io.File;

public class VideoAnalysisPlayerView extends FrameLayout {
    private static final int PROGRESS_INTERVAL_MS = 33;

    private final VideoView videoView;
    private final Handler progressHandler = new Handler(Looper.getMainLooper());

    private String sourcePath;
    private boolean paused = true;
    private boolean prepared = false;
    private int durationMs = 0;
    private int videoWidth = 0;
    private int videoHeight = 0;

    private final Runnable progressRunnable = new Runnable() {
        @Override
        public void run() {
            if (!prepared) {
                return;
            }

            emitProgress(videoView.getCurrentPosition());
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
                    startProgressLoop();
                } else {
                    videoView.pause();
                    emitProgress(0);
                }
            }
        });

        videoView.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
            @Override
            public void onCompletion(MediaPlayer mediaPlayer) {
                paused = true;
                stopProgressLoop();
                emitEnd();
            }
        });

        videoView.setOnErrorListener(new MediaPlayer.OnErrorListener() {
            @Override
            public boolean onError(MediaPlayer mediaPlayer, int what, int extra) {
                emitError("MediaPlayer error " + what + ":" + extra);
                stopProgressLoop();
                paused = true;
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
            emitProgress(videoView.getCurrentPosition());
        } else {
            videoView.start();
            startProgressLoop();
        }
    }

    public void onDropView() {
        stopProgressLoop();
        videoView.stopPlayback();
    }

    private void startProgressLoop() {
        stopProgressLoop();
        progressHandler.post(progressRunnable);
    }

    private void stopProgressLoop() {
        progressHandler.removeCallbacks(progressRunnable);
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
}
