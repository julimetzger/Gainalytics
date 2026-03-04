package com.powerliftingworkoutplanner;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.common.MapBuilder;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;

import java.util.Map;

public class VideoAnalysisPlayerViewManager extends SimpleViewManager<VideoAnalysisPlayerView> {
    public static final String REACT_CLASS = "VideoAnalysisPlayerView";

    public VideoAnalysisPlayerViewManager() {
    }

    @Override
    public String getName() {
        return REACT_CLASS;
    }

    @Override
    protected VideoAnalysisPlayerView createViewInstance(@NonNull ThemedReactContext themedReactContext) {
        return new VideoAnalysisPlayerView(themedReactContext);
    }

    @ReactProp(name = "source")
    public void setSource(VideoAnalysisPlayerView view, String source) {
        view.setSourcePath(source);
    }

    @ReactProp(name = "paused", defaultBoolean = true)
    public void setPaused(VideoAnalysisPlayerView view, boolean paused) {
        view.setPaused(paused);
    }

    @ReactProp(name = "barPathSeries")
    public void setBarPathSeries(VideoAnalysisPlayerView view, ReadableArray barPathSeries) {
        view.setBarPathSeries(barPathSeries);
    }

    @ReactProp(name = "trackingFrameWidthPx", defaultInt = 0)
    public void setTrackingFrameWidthPx(VideoAnalysisPlayerView view, int trackingFrameWidthPx) {
        view.setTrackingFrameWidthPx(trackingFrameWidthPx);
    }

    @ReactProp(name = "trackingFrameHeightPx", defaultInt = 0)
    public void setTrackingFrameHeightPx(VideoAnalysisPlayerView view, int trackingFrameHeightPx) {
        view.setTrackingFrameHeightPx(trackingFrameHeightPx);
    }

    @Override
    public void onDropViewInstance(@NonNull VideoAnalysisPlayerView view) {
        super.onDropViewInstance(view);
        view.onDropView();
    }

    @Override
    public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
        return MapBuilder.<String, Object>builder()
            .put("onLoad", MapBuilder.of("registrationName", "onLoad"))
            .put("onProgress", MapBuilder.of("registrationName", "onProgress"))
            .put("onEnd", MapBuilder.of("registrationName", "onEnd"))
            .put("onError", MapBuilder.of("registrationName", "onError"))
            .build();
    }
}
