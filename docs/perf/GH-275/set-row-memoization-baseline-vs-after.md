# GH-275 - Set-row memoization baseline vs after

## Setup

| Item | Value |
| --- | --- |
| Device | Samsung Galaxy S20 (SM-G986B), real device, serial `R5CN30HWZFN` |
| Dataset | `docs/tickets/GH-253/baseline-large.gains` imported on the device |
| Parent branch | `feature/GH-272-live-tree-profile` |
| Instrumentation | Existing GH-272 `__DEV_PERF__` `DevPerfProfiler` wrappers and `LiveCascadeOverlay` button |
| Driver | Floating red `R5` overlay on `<ExecuteTraining>` |
| Final run | 2026-05-12 21:33 Europe/Berlin |
| Raw files | `after-render.csv`, `after-paint-gap.csv`, `after-dispatch.csv`, `after-submits.csv`, `after-storage.csv`, `after-selector.csv` |
| Proof screenshot | `screenshots/GH-275/gh275-live-r5-overlay.png` |

The final device run used the imported baseline-large state, then populated the empty Micro 5 Push slot with the app's existing "Suggest based on last Training" action so a planned workout could be started and measured through the live `R5` overlay.

## BEFORE - GH-272 baseline

Copied from `docs/perf/GH-272/live-tree-profile.md`, combined over 10 live submits.

| id | mount | update | sum-actual (ms) | mean-actual (ms) | p95-actual (ms) | sum-base (ms) | mean-base (ms) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `execute-training-root` | 0 | 64 | 2547.89 | 39.81 | 92.20 | 5544.74 | 86.64 |
| `set-list` | 0 | 21 | **1528.95** | **72.81** | 74.18 | 1430.56 | 68.12 |
| `rest-timer-card` | 0 | 64 | 873.07 | 13.64 | 17.82 | 807.60 | 12.62 |
| `estimated-1rm-card` | 0 | 21 | 76.26 | 3.63 | 3.76 | 69.32 | 3.30 |
| `aux-date-picker` | 0 | 0 | - | - | - | - | - |

## AFTER - final R5CN30HWZFN capture

This is the final capture from the rebuilt debug APK installed on `R5CN30HWZFN`.

| id | mount | update | sum-actual (ms) | mean-actual (ms) | p95-actual (ms) | sum-base (ms) | mean-base (ms) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `execute-training-root` | 0 | 32 | 898.16 | 28.07 | 54.60 | 2225.37 | 69.54 |
| `set-list` | 0 | 11 | **390.49** | **35.50** | 38.08 | 562.23 | 51.11 |
| `rest-timer-card` | 0 | 32 | 431.98 | 13.50 | 21.09 | 398.33 | 12.45 |
| `estimated-1rm-card` | 0 | 11 | 42.04 | 3.82 | 6.76 | 38.41 | 3.49 |

Acceptance gate result: **not met**. `set-list` mean actualDuration is 35.50 ms, above the required `< 15 ms`.

## Side-by-side

| Profiler | BEFORE mean actual (ms) | AFTER mean actual (ms) | Multiplier |
| --- | ---: | ---: | ---: |
| `set-list` | 72.81 | 35.50 | 2.1x faster |
| `execute-training-root` | 39.81 | 28.07 | 1.4x faster |
| `rest-timer-card` | 13.64 | 13.50 | 1.0x faster |
| `estimated-1rm-card` | 3.63 | 3.82 | 0.9x |

## Per-submit `t2-t0`

The GH-272 and GH-275 live-overlay `submits.csv` files are header-only, so there are no emitted `t2-t0` rows for the live-overlay path. The historical GH-267/PR #271 synthetic benchmark reported `t2-t0` p50 around 414 ms, but this final GH-275 overlay run cannot compute an AFTER p50 from `after-submits.csv`.

| Metric | BEFORE | AFTER |
| --- | ---: | ---: |
| Live-overlay `t2-t0` p50 | not emitted (header-only GH-272 submits CSV) | not emitted (header-only GH-275 submits CSV) |
| Historical synthetic `t2-t0` p50 | about 414 ms | not comparable from this run |
| `set-list` mean actualDuration | 72.81 ms | 35.50 ms |

## Multiplier

`set-list` reconciliation improved from 72.81 ms to 35.50 ms, or **2.1x faster**. The user-perceived `t2-t0` multiplier is unavailable because the live overlay did not emit submit rows.

## Implementation audit

- `SetRow` is wrapped in `React.memo(SetRowComponent, areSetRowPropsEqual)`.
- Comparator props: `setId`, `reps`, `weight`, `rir`, `isDone`, `isCurrent`, `date.getTime()`, `onSubmit`, `onDelete`.
- `AddWorkout` passes stable `onSubmit` and `onDelete` callbacks using refs for the latest workout/date/dispatch closures.
- `AddWorkoutSet` no longer subscribes to the entire `settings` slice; it selects only `toggles.disable1RMButton` and `toggles.disableToasts` with `shallowEqual`.
- No reducer, storage, migration, or persisted data-shape changes were made.

## Verification

- Focused component test passed: `set-row-jest-focused.log`.
- `git diff --check` passed: `git-diff-check.log`.
- Android debug build passed with sandbox workarounds: `assembleDebug-final.log`.
- Clean install and real-device launch reached live training on `R5CN30HWZFN`.
- `R5` overlay was used for the final capture and dumped the CSVs listed below.
- Full `npm test` is not green in this worktree; the recorded failures are pre-existing suite drift and are captured in `set-row-jest-final.log`.
- Cold-launch hydration is unchanged by inspection: the memoization and selector narrowing are render-time changes only and do not touch reducers, storage, migrations, import/export shape, or persisted keys.

## Measurement notes

- The final `R5` run dumped all CSVs successfully.
- `after-submits.csv` is header-only (`submit: 0` in the dump alert), matching the GH-272 live-overlay limitation.
- After the synthetic cascade sequence, the dev build showed a React Native error, `TypeError: Cannot read property 'map' of undefined`. This is not the earlier duplicate `RNGestureHandlerRootView` launch blocker, and it appeared after the CSV dump path had completed.
- The assigned run directory still rejects writes with `Read-only file system`; status and summary therefore remain in this fallback docs directory.

## Raw CSVs

| File | Description |
| --- | --- |
| `before-run1-render.csv` | GH-272 run 1 render baseline |
| `before-run2-render.csv` | GH-272 run 2 render baseline |
| `before-run1-paint-gap.csv` | GH-272 run 1 paint-gap baseline |
| `before-run2-paint-gap.csv` | GH-272 run 2 paint-gap baseline |
| `after-render.csv` | Final GH-275 render capture |
| `after-paint-gap.csv` | Final GH-275 paint-gap capture |
| `after-dispatch.csv` | Final GH-275 dispatch capture |
| `after-storage.csv` | Final GH-275 storage capture |
| `after-submits.csv` | Header-only live-overlay submit capture |
| `after-selector.csv` | Header-only selector capture |
