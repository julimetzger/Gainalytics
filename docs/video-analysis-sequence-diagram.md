# Video Analysis Sequence Diagram

## Production flow (`VideoAnalysisModule`)

```mermaid
sequenceDiagram
    autonumber
    participant UI as React Native UI
    participant VAM as VideoAnalysisModule
    participant MMR as MediaMetadataRetriever
    participant OCV as OpenCV + Hough
    participant REP as Rep Estimation
    participant FS as File System

    UI->>VAM: analyzeSquatVideo(localVideoPath, analysisId, manualSeed?)
    VAM->>VAM: ensureOpenCvReady()
    VAM->>MMR: read duration + source fps
    VAM->>VAM: extractMotionTrackedSeries(...)

    loop sampled frames (~8 FPS)
        VAM->>MMR: getFrameAtTime(t)
        VAM->>VAM: toFrameData() (scale, gray, blur)
        VAM->>VAM: buildEdgeMagnitude()
        VAM->>VAM: buildMotionMagnitude()
        VAM->>VAM: predict center/radius from previous state
        VAM->>OCV: detectPlateCenterWithHough(ROI HoughCircles + scoring)
        OCV-->>VAM: best detection + confidence
        VAM->>VAM: accept/reject (jump/radius checks)
        VAM->>VAM: EMA smoothing + velocity update + lock/unlock logic

        alt first sample
            VAM->>OCV: detectInitialFrameCircles(...)
            OCV-->>VAM: detectedCirclesAtStart
        end
    end

    alt too few stable samples
        VAM->>VAM: buildFallbackTrackingSeries(...)
    end

    VAM->>REP: estimateRepCountFromSeries() (autocorrelation)
    REP-->>VAM: estimated rep count
    VAM->>REP: buildRepSegmentsFromSeries()
    VAM->>REP: buildRepMetrics()

    alt no manual seed and low confidence/fallback
        VAM-->>UI: ERR_VIDEO_ANALYSIS_NEEDS_MANUAL_SEED
    else valid tracking
        VAM->>FS: write analysis-<id>.json
        VAM-->>UI: path to result json
    end
```

## Current behavior on your two videos (run on March 6, 2026)

```mermaid
sequenceDiagram
    autonumber
    participant T as Android Instrumentation Test
    participant VAM as extractMotionTrackedSeries(...)
    participant C as detectedCirclesAtStart (Top-3 check)

    T->>VAM: Run Video 1 t=0
    VAM-->>C: initial circle candidates
    C-->>T: Top-3 contains plate-near candidate (PASS)

    T->>VAM: Run Video 2 t=0
    VAM-->>C: initial circle candidates
    C-->>T: Top-3 misses expected plate (FAIL)
    Note over T,C: Top-1 in failure log: x=689.1, y=284.6, r=253.7, dist=429.8px
```

## Related debug outputs

- `/tmp/hough-debug-tests/video1_t0-overlay.png`
- `/tmp/hough-debug-tests/video2_t0-overlay.png`
