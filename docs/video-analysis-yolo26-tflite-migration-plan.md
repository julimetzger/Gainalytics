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
5. Video is analyzed at fixed `30 FPS` unless the source video itself has a lower frame rate, and is written to `analysis-<id>.json`.
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
- Analysis now runs at fixed `30 FPS` unless the source video itself has a lower frame rate.
- Legacy smoothing, ROI prediction, CSRT, Hough, EMA, velocity, and relock logic are removed from the active path.
- Model input buffers, pixel arrays, output tensors, and letterbox bitmaps are reused across detections.
- Native analysis writes `performanceMetrics` into the result JSON and logs stage metrics to `logcat`.
- JS import flow logs `copyMs`, `preflightMs`, `nativeAnalysisMs`, and `totalImportMs`.

## Emulator Benchmark Snapshot (March 20, 2026)
- Benchmark flow: `04_video_analysis_bar_path_done.yaml` (historical, since removed; import + analysis is now covered by `__tests__/e2e/maestro/flows/video_import_playback.yaml`)
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

## Fixed 12 FPS Verification (March 20, 2026)
- Verification run: same Maestro flow after removing the sample-budget logic and restoring fixed `12 FPS`
- Maestro result: passed in `2m 40s`
- Wall clock: `193.52s`
- JS import metrics:
  - `copyMs: 826`
  - `preflightMs: 3633`
  - `nativeAnalysisMs: 51254`
  - `totalImportMs: 69863`
- Native decoder metrics:
  - `analyzedFps: 12`
  - `plannedSampleCount: 96`
  - `trackingMs: 48307`
  - `totalAnalysisMs: 50901`
  - `decodedFrameCount: 95`
  - `acceptedFrameCount: 61`
  - `implausibleFrameCount: 34`
  - `queuedInputSampleCount: 240`
  - `dequeuedOutputFrameCount: 240`
  - `processedOutputFrameCount: 95`
  - `skippedDecodedFrameCount: 145`
  - `decoderSetupMs: 735`
  - `frameExtractionMs: 22891.052`
  - `decoderQueueInputMs: 5831.365`
  - `decoderDequeueOutputMs: 1811.108`
  - `frameConversionMs: 22891.052`
  - `inferenceMs: 13687.331`
  - `totalDetectionMs: 15302.388`
  - `avgFrameExtractionMs: 240.958`
  - `avgInferenceMs: 142.576`
  - `avgFrameConversionMs: 240.958`
- Tradeoff conclusion:
  - fixed `12 FPS` materially improves bar-path density and keeps the decoder path viable
  - compared to the `3 FPS` decoder run, native analysis time increased from `17467 ms` to `51254 ms`
  - the decoder path still keeps the run well below the old retriever-based implementation

## Plausibility Threshold Verification (March 20, 2026)
- Change under test:
  - previous threshold: `0.16`
  - new threshold: `0.30`
  - rejection diagnostics are now persisted under `analysisMeta.plausibilityRejections`
- Reason for the experiment:
  - at fixed `12 FPS`, the `0.16` threshold rejected `34` out of `95` decoded frames
  - this was considered too aggressive for the high-velocity portion of the lift
- Previous fixed-`12 FPS` run with threshold `0.16`:
  - `implausibleFrameCount: 34`
  - `acceptedFrameCount: 61`
  - `decodedFrameCount: 95`
  - `nativeAnalysisMs: 51254`
- Verification run with threshold `0.30`:
  - Maestro result: passed in `2m 48s`
  - Wall clock: `205.83s`
  - JS import metrics:
    - `copyMs: 913`
    - `preflightMs: 2487`
    - `nativeAnalysisMs: 56373`
    - `totalImportMs: 73606`
  - Native decoder metrics:
    - `analyzedFps: 12`
    - `plannedSampleCount: 96`
    - `trackingMs: 51692`
    - `totalAnalysisMs: 54510`
    - `decodedFrameCount: 95`
    - `acceptedFrameCount: 95`
    - `implausibleFrameCount: 0`
    - `queuedInputSampleCount: 240`
    - `dequeuedOutputFrameCount: 240`
    - `processedOutputFrameCount: 95`
    - `skippedDecodedFrameCount: 145`
    - `avgFrameExtractionMs: 256.846`
    - `avgInferenceMs: 154.274`
  - Result diagnostics:
    - `plausibilityRejections: []`
- Conclusion:
  - for this benchmark video, the `0.16` threshold was too strict
  - `0.30` behaves like a coarse teleport filter rather than an active motion constraint
  - the new diagnostics make future rejections inspectable per frame using:
    - `sampleIndex`
    - `tMs`
    - `previousX`, `previousY`
    - `candidateX`, `candidateY`
    - `deltaX`, `deltaY`
    - `jumpDistance`
    - `threshold`
    - `score`

## Fixed 30 FPS Verification (March 20, 2026)
- Verification run: same Maestro flow after raising the fixed analysis rate from `12 FPS` to `30 FPS`
- Maestro result: passed in `1m 23s`
- Test video: emulator squat import path, duration `8.001s`, source FPS `30.0`
- Native decoder metrics:
  - `analyzedFps: 30`
  - `plannedSampleCount: 240`
  - `trackingMs: 45143`
  - `totalAnalysisMs: 45737`
  - `decodedFrameCount: 238`
  - `acceptedFrameCount: 238`
  - `implausibleFrameCount: 0`
  - `queuedInputSampleCount: 240`
  - `dequeuedOutputFrameCount: 240`
  - `processedOutputFrameCount: 238`
  - `skippedDecodedFrameCount: 2`
  - `frameExtractionMs: 26413.819`
  - `inferenceMs: 16183.353`
  - `avgFrameExtractionMs: 110.982`
  - `avgInferenceMs: 67.713`
- Verification conclusion:
  - the 30 FPS path is active end-to-end and produces a much denser bar path (`238` points)
  - no plausibility rejections occurred on the benchmark video
  - native analysis time stays below one minute on the emulator for the short benchmark clip
  - the detail screen still shows a separate `Failed prop type` warning unrelated to tracking

## Remaining Work
1. Decide whether `t=0` preflight inference should be reused during the full analysis path to avoid duplicate work on the first frame.
2. Investigate and fix the separate `Failed prop type` warning shown in the analysis detail screen.
