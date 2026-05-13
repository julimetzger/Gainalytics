# GH-275 Summary

Status: needs_review.

Implemented the set-list rendering fix:

- Extracted `SetRow` from the `unfinishedWorkout.sets.map(...)` path.
- Wrapped it in `React.memo` with an explicit comparator over `setId`, `reps`,
  `weight`, `rir`, `isDone`, `isCurrent`, `date.getTime()`, `onSubmit`, and
  `onDelete`.
- Stabilized `AddWorkout` row callbacks with refs so row props do not churn on
  every parent render.
- Narrowed `AddWorkoutSet` from the full `settings` slice to only
  `toggles.disable1RMButton` and `toggles.disableToasts`, preventing unrelated
  settings updates from bypassing `React.memo` through each row's internal
  subscription.

Final real-device measurement:

- Device: `R5CN30HWZFN`.
- Dataset: `baseline-large.gains` imported; Micro 5 Push was populated through
  the app's existing suggestion action so a live planned workout could be
  started.
- Driver: GH-272 `LiveCascadeOverlay` red `R5` button.
- Final `set-list` mean actualDuration: `35.50 ms`.
- Acceptance target: `< 15 ms`.
- Result: failed target, so this is not ready for review acceptance.

Checks and evidence:

- Focused `SetRow` Jest spec passed:
  `docs/perf/GH-275/set-row-jest-focused.log`.
- `git diff --check` passed:
  `docs/perf/GH-275/git-diff-check.log`.
- Debug APK build passed:
  `docs/perf/GH-275/assembleDebug-final.log`.
- Clean install and launch reached live training on the assigned device:
  `docs/perf/GH-275/window-after-8087-launch.xml`.
- Final CSVs are in `docs/perf/GH-275/after-*.csv`.
- Proof screenshot:
  `screenshots/GH-275/gh275-live-r5-overlay.png`.
- Full `npm test` is still not green; the focused test passes, while the broader
  suite has pre-existing failures recorded in `set-row-jest-final.log`.

Measurement caveats:

- `after-submits.csv` is header-only, so the live-overlay `t2-t0` p50 could not
  be computed.
- After the synthetic cascade sequence, the dev build showed
  `TypeError: Cannot read property 'map' of undefined`. The CSV dump alert had
  already completed and this was not the earlier duplicate
  `RNGestureHandlerRootView` launch blocker.

Run directory caveat:

- The assigned run directory is still outside this worker's writable sandbox.
  Writes to
  `/home/jmetzger/projects/PowerliftingWorkoutPlanner/.codex-orchestrator/runs/GH-275`
  fail with `Read-only file system`, so this fallback status/summary is stored
  under `docs/perf/GH-275/`.

Git caveat:

- The requested commit/push/PR could not be completed from this sandbox. `git
  commit` fails because the parent repository metadata path
  `/home/jmetzger/projects/PowerliftingWorkoutPlanner/.git/worktrees/feature-GH-275`
  is read-only.
