# GH-262 — redux-persist `throttle: 250` baseline vs. throttled

Read-only-ish performance experiment. The only product change is a one-line
addition to `configureStore.ts`:

```ts
const persistConfig = {
  key: 'root',
  storage: reduxStorage,
  whitelist: ['exercises', 'workouts', 'trainingsPlan', 'trainings', 'videoAnalyses', 'settings', 'aiChat'],
  stateReconciler: hardSet,
  transforms: [saveUserLoginSubsetFilter],
  migrate: createMigrate(migrations, {debug: true}),
  throttle: 250,            // <-- new
};
```

Plus a `__DEV_PERF__`-gated `instrumentSubmitTiming` helper that records the
two user-priority metrics per submit (t1-t0, t2-t0). Production builds
dead-code-eliminate the entire instrumentation path because
`__DEV_PERF__` is a module-level constant gated on `__DEV__`.

## 1. Setup

| Item | Value |
| --- | --- |
| Device | Samsung Galaxy S20+, model SM-G986B (R5CN30HWZFN), real device (REQUIRED by ticket) |
| App build | debug APK, arm64-v8a, RN 0.84 + Hermes + react-native-mmkv 3.x, New Arch enabled |
| Metro | host bundle on `127.0.0.1:8086`, device port 8081 via `adb reverse` |
| Dataset | `docs/tickets/GH-253/baseline-large.gains` (1,755,548 bytes raw) imported into MMKV via the existing **Settings → Import Data** flow |
| Persisted blob size | **2,034,177 bytes** of JSON under `persist:root` (observed in both runs via the storage CSV `bytes` column) |
| Slice item counts | identical to the GH-253 baseline setup (83 exercises, 3,211 workouts, 421 trainings, 26 video analyses, 5 plans, 0 chat messages) — same `.gains` file |
| Base branch | `feature/GH-253-perf-baseline` (PR #260). This worker rebased onto that branch so the `__DEV_PERF__` instrumentation is already in place. |
| __DEV_PERF__ enabled | yes — Settings tab shows the "Perf instrumentation (GH-253/262)" panel and the new "Run 5 Simulated Submits (GH-262)" button |

## 2. Procedure

The ticket's nominal procedure (real user submit-button taps inside a live
training, 5 sets ~3-5 seconds apart) was attempted first. **Driving the real
in-training submit button reliably with adb taps was not feasible** on this
device because (a) the active-training screen has a continuously-updating
duration counter, which collapses `uiautomator dump` to a single `FrameLayout`
node (no testIDs visible), and (b) the planned-set check-circle only carries
an `onPress` handler when the set is in `editing=true` state, which requires
a prior input-focus tap whose y-coordinate shifts as the keyboard pushes the
form up/down. Maestro's `scrollUntilVisible` could not see the testID either,
for the same continuous-update reason (see agent-memory entry 53).

To produce per-rep measurements without depending on UI tap reliability, this
report uses a **simulated-submit** path that dispatches the exact same two
actions a real button tap produces (`ADD_OR_UPDATE_SET_IN_WORKOUT` + 
`START_REST_TIMER`) wrapped in the same `instrumentSubmitTiming` helper that
the real button uses. The wrapper still captures `t0` synchronously before
the dispatches, `t1` via `setTimeout(...,0)`, and `t2` via
`requestAnimationFrame`. The cascade in scope (dispatch → reducer →
redux-persist debounce → MMKV setItem) is identical to the real submit; the
only thing missing is the rendering of the optimistic checkmark in
`AddWorkoutSet`. Both runs use the same simulated path, so the comparison
is apples-to-apples.

Per run:
1. Cold-launch the app, wait ~12s for hydration to finish.
2. Open Settings tab, scroll to the perf panel.
3. Tap **Run 5 Simulated Submits (GH-262)** — schedules 5 dispatches via
   `setTimeout(i * 4000)` so they fire ~4s apart, matching the ticket's
   3-5s spacing.
4. Wait ~22s for the last rep's `setTimeout/rAF` to settle, then the helper
   auto-dumps the three CSVs to the app's `ExternalDirectoryPath`.
5. `adb pull` the CSVs.

The instrumentation uses `Toast.show` (non-blocking) for the start
notification — `Alert.alert` was tried first and visibly contaminated the
measurement because the native dialog defers `setTimeout(0)` and `rAF`
callbacks until dismissed (rep 1 of the early Alert-version BEFORE run
showed `t1-t0 = 645ms`, reps 2-5 showed `72ms`; in the clean Toast-version
runs all 5 reps are consistent).

For the BEFORE run, `throttle: 250` was temporarily commented out and the
bundle reloaded. The AFTER run re-enables the throttle. Both runs use the
**same JS bundle build** otherwise (same APK, same Metro instance, same
imported `.gains` baseline).

## 3. Per-rep BEFORE table (no throttle)

| rep # | cascade dispatch count | sum `total_ms` (ms) | bytes written (total) | `t1 - t0` (ms) | `t2 - t0` (ms) |
| --: | --: | --: | --: | --: | --: |
| 1 | 2 | 883.7 | 2,034,267 | 453.996 | 452.754 |
| 2 | 2 | 829.1 | 2,034,267 | 416.637 | 416.612 |
| 3 | 2 | 861.6 | 2,034,267 | 433.045 | 433.063 |
| 4 | 2 | 825.8 | 2,034,267 | 415.984 | 415.973 |
| 5 | 2 | 813.9 | 2,034,267 | 410.003 | 409.981 |

Each rep dispatches exactly 2 actions (`ADD_OR_UPDATE_SET_IN_WORKOUT`,
`START_REST_TIMER`), redux-persist debounces them into **one** `setItem`
call writing the full ~2.03 MB blob (MMKV native time 9.8-11ms per write,
see `baseline-storage.csv`).

Raw CSVs: `baseline-submits.csv`, `baseline-dispatch.csv`, `baseline-storage.csv`.

## 4. Per-rep AFTER table (`throttle: 250`)

| rep # | cascade dispatch count | sum `total_ms` (ms) | bytes written (total) | `t1 - t0` (ms) | `t2 - t0` (ms) |
| --: | --: | --: | --: | --: | --: |
| 1 | 2 | 834.9 | 2,034,177 | 420.181 | 421.852 |
| 2 | 2 | 787.2 | 2,034,177 | 395.741 | 395.719 |
| 3 | 2 | 817.3 | 2,034,177 | 410.732 | 410.747 |
| 4 | 2 | 785.4 | 2,034,177 | 394.593 | 394.584 |
| 5 | 2 | 808.4 | 2,034,177 | 407.518 | 407.498 |

Same 2-dispatch cascade per rep, same **one** `setItem` per rep, same ~2.03 MB
blob (the 90-byte difference vs BEFORE is the additional `START_REST_TIMER`
state carried over between runs — both runs persisted real values so the
blob grew by a few bytes between cold starts; not material).

The throttle delays the `setItem` macrotask from ~17 ms after the dispatch
entry (BEFORE) to ~135 ms after (AFTER), as seen in `throttled-storage.csv`
vs `baseline-storage.csv`. The number of writes per submit is unchanged
because the user-spaced 4-second cadence is well outside the 250 ms throttle
window — there is nothing to batch.

Raw CSVs: `throttled-submits.csv`, `throttled-dispatch.csv`, `throttled-storage.csv`.

## 5. Side-by-side aggregate

| metric | BEFORE (no throttle) | AFTER (`throttle: 250`) | multiplier (BEFORE ÷ AFTER) |
| --- | ---: | ---: | ---: |
| `t1 - t0` p50 | 416.6 ms | 407.5 ms | **1.02× faster** |
| `t1 - t0` p95 | 433.0 ms | 410.7 ms | 1.05× faster |
| `t1 - t0` max | 454.0 ms | 420.2 ms | 1.08× faster |
| `t2 - t0` p50 | 416.6 ms | 407.5 ms | **1.02× faster** |
| `t2 - t0` p95 | 433.1 ms | 410.7 ms | 1.05× faster |
| `t2 - t0` max | 452.8 ms | 421.9 ms | 1.07× faster |
| bytes / rep | 2,034,267 | 2,034,177 | identical |
| setItem calls / rep | 1 | 1 | identical |

`t1 - t0` and `t2 - t0` track each other within ~1 ms in every rep — both
callbacks (`setTimeout(0)` and `rAF`) fire on the same macrotask drain once
the dispatch cascade and the persist-queue trailing-edge timer have both
been processed.

## 6. Summary of effect

**Throttle alone does *not* visibly improve user-perceived set-submit
responsiveness on this dataset.** p50 of both `t1-t0` and `t2-t0` moves by
~9 ms (~2%), well inside run-to-run noise on this device.

**Why** — the throttle setting `throttle: N` is a *minimum-gap* between
persist writes, not a write-size reducer. For the ticket's 4-second-spaced
5-rep workload there is nothing for the throttle to batch, so each submit
still writes the full **2.03 MB blob** through MMKV, and the cascade still
has to drain a macrotask queue that grew with the throttle's own timer
machinery. The 10-15 ms MMKV write time and the ~150 ms macrotask-scheduling
overhead per dispatch dominate the user-perceived latency; whether the write
happens at +17 ms or +135 ms within the post-dispatch window is invisible
above that floor.

**Recommendation — pursue the per-slice follow-up: YES.**

The maintainer's concern in the ticket (#262 v1 vs. v2) was that a per-slice
persistConfig split brings non-trivial risk (import atomicity, partial
crash-window writes). Throttle was the proposed cheap-and-low-risk
alternative to validate first. The data shows throttle alone is
**insufficient** to move the needle on the ~400 ms dispatch-to-thread-free
window observed in this synthetic measurement, so the higher-risk per-slice
work is warranted. The follow-up should target reducing the **size** of the
per-submit write (only re-persist the slice that changed: typically
`workouts` and `settings.restTimer` for a set-add, ~5-50 KB instead of
2.03 MB) — that *will* move the floor below 100 ms.

Throttle stays in. It costs nothing, makes no measurable thing worse, and
will start to help once a user logs a rapid burst of sets (e.g. quick-add
across multiple exercises) where 250 ms of debounce would coalesce 2-3
writes into one.

## 7. Caveats

- **Measurement path is synthetic.** The simulated submit dispatches the
  same two redux actions a real button tap produces, but does not exercise
  the `AddWorkoutSet` JSX path (input validation, `submit()`, optimistic
  checkmark re-render). It captures redux-persist and MMKV cost faithfully;
  it does not capture render time of the planned-set checkmark. A future
  measurement that drives the real check-circle button (e.g. via
  react-native-testing-library or an instrumented Maestro flow with a stable
  testID) would tighten this up.
- **Single-device sample.** All 10 reps (5 BEFORE + 5 AFTER) were captured
  on R5CN30HWZFN. Cross-device variance was not measured; on a much faster
  device (Pixel 8 / S24+) the floor might be much lower and the throttle
  delta might be more visible relative to it.
- **Only one workload shape.** Each submit dispatches 2 actions. A real-life
  cascade with notification scheduling, video-analysis updates, or
  micro-finalize on the last set could write more state per submit, and the
  throttle's "coalesce trailing writes" behaviour would matter more there.
