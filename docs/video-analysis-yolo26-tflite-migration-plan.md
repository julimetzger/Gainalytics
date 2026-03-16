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
5. Video is analyzed at 12 FPS and written to `analysis-<id>.json`.
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
