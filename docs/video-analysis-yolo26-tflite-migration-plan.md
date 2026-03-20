# Video Analysis V2 Migration Plan (YOLO26 + TFLite)

## Summary
- Replace Hough/CSRT tracking with Android-native TensorFlow Lite detection (`outer_plate`).
- Keep Analyse tabs and overlay UX, but simplify flow to upload, seed resolution, analyze, done, playback, and t=0 static overlay.
- Hard reset legacy `videoAnalyses` persisted state (no backward compatibility path).

## V2 Flow
1. User imports video.
2. Native preflight detects `outer_plate` candidates at `t=0`.
3. If one candidate exists, analysis auto-starts.
4. If multiple candidates exist, user selects a candidate in detail view.
5. Video is analyzed at an adaptive FPS budget and written to `analysis-<id>.json`.
6. Entry transitions to `done` and is visible in the Analyse tab.
7. Playback overlay shows full bar path; static t=0 overlay shows all path points and initial seed rectangle.

## Core Technical Decisions
- Runtime: TensorFlow Lite on Android.
- Model location: `android/app/src/main/assets/models/outer_plate_yolo26n_float32.tflite`.
- Preflight candidate format: normalized bounding boxes.
- Manual seed scope (V1): selection from detected candidates only (no free-tap fallback).
- Failure mode: no t=0 candidates => `failed`.

## State and API
- Statuses: `queued`, `processing`, `awaiting_seed_selection`, `done`, `failed`.
- `SeedCandidate` is box-based (`normalizedX`, `normalizedY`, `normalizedWidth`, `normalizedHeight`, `score`).
- Native methods:
  - `prepareSquatVideoSeed(localVideoPath, analysisId)`
  - `analyzeSquatVideo(localVideoPath, analysisId, manualSeed?)`

## Test Scope
- Reducer transitions and seed preflight persistence.
- Import flow branches for 0/1/>1 candidates.
- Android module compiles and returns result payloads with V2 metadata.

## Current Implementation Status (March 20, 2026)
- Detection/tracking is now simplified to pure YOLO candidate selection plus a plausibility jump filter.
- Tracking confidence threshold is `0.2`.
- Legacy smoothing, ROI prediction, CSRT, Hough, EMA, velocity, and relock logic are removed from the active path.
- Model input buffers, pixel arrays, output tensors, and letterbox bitmaps are reused across detections.
- Native analysis writes `performanceMetrics` into the result JSON and logs stage metrics to `logcat`.
- JS import flow logs `copyMs`, `preflightMs`, `nativeAnalysisMs`, and `totalImportMs`.

## Emulator Benchmark Snapshot (March 20, 2026)
- Benchmark flow: `__tests__/e2e/maestro/flows/04_video_analysis_bar_path_done.yaml`
- Test video: emulator squat import path, duration `8.001s`, source FPS `30.0`
- Previous run before adaptive sampling change: Maestro timed out after `4m 47s`
- Current run after buffer reuse + adaptive sampling: Maestro passed in `2m 16s`
- Current native metrics:
  - `analyzedFps: 3`
  - `plannedSampleCount: 24`
  - `trackingMs: 75248`
  - `totalAnalysisMs: 76437`
  - `frameExtractionMs: 72524.661`
  - `totalDetectionMs: 2771.119`
  - `inferenceMs: 2458.395`
  - `avgFrameExtractionMs: 3021.861`
  - `avgInferenceMs: 98.336`
- Bottleneck conclusion: frame extraction via `MediaMetadataRetriever.getFrameAtTime(...)` dominates runtime by a wide margin; model inference is not the limiting factor.

## Sequential Decoder Verification (March 20, 2026)
- Verification run: same Maestro flow after switching the tracking path to `MediaExtractor + MediaCodec`
- Maestro result: passed in `1m 43s`
- Wall clock: `132.71s`
- JS import metrics:
  - `copyMs: 671`
  - `preflightMs: 2777`
  - `nativeAnalysisMs: 17467`
  - `totalImportMs: 28771`
- Native decoder metrics:
  - `analyzedFps: 3`
  - `plannedSampleCount: 24`
  - `trackingMs: 15386`
  - `totalAnalysisMs: 17457`
  - `queuedInputSampleCount: 240`
  - `dequeuedOutputFrameCount: 240`
  - `processedOutputFrameCount: 23`
  - `skippedDecodedFrameCount: 217`
  - `decoderSetupMs: 619`
  - `frameExtractionMs: 4223.119`
  - `decoderQueueInputMs: 4595.11`
  - `decoderDequeueOutputMs: 1709.679`
  - `frameConversionMs: 4223.119`
  - `inferenceMs: 2665.432`
  - `totalDetectionMs: 2934.023`
  - `avgFrameExtractionMs: 183.614`
  - `avgInferenceMs: 111.06`
  - `avgFrameConversionMs: 183.614`
- Verification conclusion:
  - no `Decoder tracking failed` fallback was logged
  - average frame extraction time dropped from `3021.861 ms` to `183.614 ms`
  - native analysis time dropped from `76444 ms` to `17467 ms`
  - the decoder rewrite removed the dominant retriever bottleneck

## Next Execution Phase
1. Replace repeated `MediaMetadataRetriever.getFrameAtTime(...)` calls in the tracking loop with sequential decoding via `MediaExtractor + MediaCodec`.
2. Keep `t=0` preflight on `MediaMetadataRetriever` for now to minimize risk and isolate the tracking-path rewrite.
3. Preserve current adaptive FPS and metrics logging so the before/after performance delta remains measurable.
4. Record decoder-specific metrics next:
   - decoder setup time
   - queued input sample count
   - dequeued output frame count
   - processed output frame count
   - skipped decoded frame count
   - conversion time from decoder output to model input
5. Re-run the Maestro benchmark on the emulator after the decoder rewrite and compare:
   - total flow time
   - native analysis time
   - frame extraction / decode time
   - model inference time
