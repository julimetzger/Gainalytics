# Video Analysis Hough + CSRT Implementation Plan

## Summary

The tracking pipeline will be split into two stages:

1. A mandatory seed preflight before full analysis starts
2. Full analysis with Hough-based initialization and CSRT-based tracking

The seed preflight runs hintless Hough on the initial frame, persists the preview frame and the top candidates, and waits for explicit user confirmation before processing the full video.

## Current Status

Implemented in this branch:

1. Native seed preflight via `prepareSquatVideoSeed(...)`
2. Redux/entity persistence for preview frame plus top seed candidates
3. New `awaiting_seed_confirmation` state in the analysis flow
4. Detail-screen seed confirmation UI with suggested circles and free tap fallback
5. Manual seed payload extended with optional `normalizedRadius`
6. Import flow updated so full analysis no longer auto-starts after import
7. Android OpenCV dependency switched to a contrib build that exports `TrackerCSRT`
8. Native tracking path now uses `TrackerCSRT` as the primary tracker after initialization

Not implemented yet:

1. Tracker-specific metadata such as reacquire counts and lost-frame ratio
2. Wider test coverage for tracker-loss and reacquire scenarios

## Dependency Decision

The previous Android dependency `org.opencv:opencv:4.10.0` did not expose `TrackerCSRT` in the Java API. This branch switches the app to:

- `com.quickbirdstudios:opencv-contrib:4.5.3.0`

This package exports:

- `org.opencv.tracking.TrackerCSRT`
- `org.opencv.tracking.TrackerKCF`

The native implementation in this branch is now based on `TrackerCSRT`.

## Product Decisions

1. Full analysis never starts automatically after import.
2. The user always confirms a seed first.
3. Seed confirmation supports both suggested circles and free tapping.
4. Tracking after initialization will use CSRT as the primary tracker.
5. Hough remains available for initialization and tracker reacquire only.
6. A dedicated Redux/UI status represents the preflight state.

## Implementation Changes

### Seed preflight

- Add a native `prepareSquatVideoSeed(localVideoPath, analysisId)` method.
- Extract the first preview frame and persist it under the existing preview path.
- Run hintless Hough on the first frame and return up to three ranked seed candidates.
- Return preview path, analysis-frame dimensions, candidates, and tracker version metadata.

### JS and Redux flow

- Add `awaiting_seed_confirmation` to `VideoAnalysisStatus`.
- Persist preflight data on the `VideoAnalysis` entity:
  - `manualSeedFramePath`
  - `seedCandidates`
  - `seedFrameWidthPx`
  - `seedFrameHeightPx`
- Update the import flow to call `prepareSquatVideoSeed(...)` instead of immediately starting analysis.
- Move the imported analysis to `awaiting_seed_confirmation` after successful preflight.
- Keep `needs_manual_seed` for failures after the analysis has already started.

### Seed confirmation UI

- Show a dedicated seed confirmation card in the detail screen for `awaiting_seed_confirmation`.
- Render suggested circles on the preview image.
- Allow selecting a suggestion or tapping freely on the image.
- Send `normalizedRadius` when a suggestion is chosen.
- Reuse the same interaction component for post-failure manual seed recovery.

### Full analysis tracking

- Extend the manual seed payload with optional `normalizedRadius`.
- Use the confirmed seed to initialize the first-frame Hough snap and the initial tracking radius.
- Replace repeated Hough-only tracking for `t > 0` with CSRT as the primary tracker.
- Use Hough only for initialization and explicit reacquire after tracker loss.

## Acceptance Criteria

1. Importing a video stores a preview frame and opens a seed confirmation step instead of immediately completing analysis.
2. Suggested seed circles are visible on the preview image.
3. The user can start analysis by either selecting a suggestion or tapping freely.
4. Existing manual-seed recovery for failed analyses still works.
5. The current Android Hough tests remain green while the preflight flow is introduced.
6. New reducer and flow tests cover the preflight persistence path.

## Defaults

- Android remains the only target in this step.
- Existing preview storage paths are reused.
- The Hough debug overlay/test infrastructure remains in place during the CSRT migration.
