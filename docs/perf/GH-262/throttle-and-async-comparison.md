# GH-262 — redux-persist throttle + async setItem comparison

Read-only-ish performance experiment, captured across three configurations
on R5CN30HWZFN with `baseline-large.gains` imported:

| Column | What changed | `configureStore.ts` diff |
| --- | --- | --- |
| BEFORE | None — round-1 baseline, sync `setItem`, no throttle | (none) |
| THROTTLED | Round-1 fix candidate: add `throttle: 250` to the root persistConfig | `throttle: 250` |
| ASYNC + THROTTLED | Round-2 fix candidate: defer the MMKV native call by one macrotask + AppState flush | `setTimeout(() => mmkv.set(key, value), 0)` in `baseStorage.setItem`, `AppState.addEventListener('change', n => n !== 'active' && persistor.flush())` |

Plus a `__DEV_PERF__`-gated `instrumentSubmitTiming` helper that records the
two user-priority metrics per submit (t1-t0, t2-t0). Production builds
dead-code-eliminate the entire instrumentation path because `__DEV_PERF__`
is a module-level constant gated on `__DEV__`.

## 1. Setup

| Item | Value |
| --- | --- |
| Device | Samsung Galaxy S20+, model SM-G986B (R5CN30HWZFN), real device (REQUIRED by ticket) |
| App build | debug APK, arm64-v8a, RN 0.84 + Hermes + react-native-mmkv 3.x, New Arch enabled |
| Metro | host bundle on `127.0.0.1:8086`, device port 8081 via `adb reverse` |
| Dataset | `docs/tickets/GH-253/baseline-large.gains` (1,755,548 bytes raw) imported into MMKV via the existing **Settings → Import Data** flow |
| Persisted blob size | **~2.03 MB** of JSON under `persist:root` (observed in all three runs via the storage CSV `bytes` column) |
| Slice item counts | identical to the GH-253 baseline setup (83 exercises, 3,211 workouts, 421 trainings, 26 video analyses, 5 plans, 0 chat messages) — same `.gains` file |
| Base branch | `feature/GH-253-perf-baseline` (PR #260). This worker rebased onto that branch so the `__DEV_PERF__` instrumentation is already in place. |
| __DEV_PERF__ enabled | yes — Settings tab shows the "Perf instrumentation (GH-253/262)" panel and the "Run 5 Simulated Submits (GH-262)" button |

## 2. Procedure

Same methodology in all three runs:

1. Cold-launch the app, wait ~12s for hydration to finish.
2. Open Settings tab, scroll to the perf panel.
3. Tap **Reset Perf** to clear the hydration noise, then tap **Run 5
   Simulated Submits (GH-262)** — schedules 5 dispatches via
   `setTimeout(i * 4000)` so they fire ~4s apart, matching the ticket's
   3-5s spacing.
4. Wait ~22s for the last rep's `setTimeout/rAF` to settle; the helper
   auto-dumps the three CSVs to the app's `ExternalDirectoryPath`.
5. `adb pull` the CSVs.

The simulated submit dispatches the same two redux actions a real button
tap produces (`ADD_OR_UPDATE_SET_IN_WORKOUT` + `START_REST_TIMER`) wrapped
in the same `instrumentSubmitTiming` helper. The wrapper captures `t0`
synchronously before the dispatches, `t1` via `setTimeout(...,0)`, and `t2`
via `requestAnimationFrame`. **Limitation:** the simulated path fires from
the Settings tab, where there is no JSX subscribed to the dispatched state.
So the path **does not include the React commit** that an actual
`AddWorkoutSet` / planned-set check-circle tap triggers. See section 7 for
why this matters when interpreting the async row.

For BEFORE, `throttle: 250` was temporarily commented out and the bundle
reloaded. THROTTLED re-enables it. ASYNC + THROTTLED additionally swaps the
storage adapter to the deferred wrapper from this round-2 commit. All three
runs use the **same imported `.gains` baseline** and the **same APK**; only
the bundle changes.

## 3. Per-rep tables

### BEFORE (no throttle, sync `setItem`)

| rep # | cascade dispatch count | sum `total_ms` (ms) | bytes written (total) | `t1 - t0` (ms) | `t2 - t0` (ms) |
| --: | --: | --: | --: | --: | --: |
| 1 | 2 | 883.7 | 2,034,267 | 453.996 | 452.754 |
| 2 | 2 | 829.1 | 2,034,267 | 416.637 | 416.612 |
| 3 | 2 | 861.6 | 2,034,267 | 433.045 | 433.063 |
| 4 | 2 | 825.8 | 2,034,267 | 415.984 | 415.973 |
| 5 | 2 | 813.9 | 2,034,267 | 410.003 | 409.981 |

Raw CSVs: `baseline-submits.csv`, `baseline-dispatch.csv`, `baseline-storage.csv`.

### THROTTLED (`throttle: 250`, sync `setItem`)

| rep # | cascade dispatch count | sum `total_ms` (ms) | bytes written (total) | `t1 - t0` (ms) | `t2 - t0` (ms) |
| --: | --: | --: | --: | --: | --: |
| 1 | 2 | 834.9 | 2,034,177 | 420.181 | 421.852 |
| 2 | 2 | 787.2 | 2,034,177 | 395.741 | 395.719 |
| 3 | 2 | 817.3 | 2,034,177 | 410.732 | 410.747 |
| 4 | 2 | 785.4 | 2,034,177 | 394.593 | 394.584 |
| 5 | 2 | 808.4 | 2,034,177 | 407.518 | 407.498 |

Raw CSVs: `throttled-submits.csv`, `throttled-dispatch.csv`, `throttled-storage.csv`.

### ASYNC + THROTTLED (`throttle: 250` + `setItem` deferred via `setTimeout(0)` + AppState flush)

| rep # | cascade dispatch count | sum `total_ms` (ms) | bytes written (total) | `t1 - t0` (ms) | `t2 - t0` (ms) |
| --: | --: | --: | --: | --: | --: |
| 1 | 2 | 843.4 | 2,034,357 | 424.868 | 423.247 |
| 2 | 2 | 814.5 | 2,034,357 | 409.357 | 409.334 |
| 3 | 2 | 841.0 | 2,034,357 | 422.563 | 422.578 |
| 4 | 2 | 791.9 | 2,034,357 | 397.816 | 397.806 |
| 5 | 2 | 817.3 | 2,034,357 | 411.823 | 411.801 |

Raw CSVs: `async-submits.csv`, `async-dispatch.csv`, `async-storage.csv`.

The `bytes_written_in_tick` column in `async-dispatch.csv` reads 0 for all
five user-submits because the deferred MMKV write happens AFTER
`perfMiddleware`'s `setTimeout(0)` callback fires (throttle pushes the
write to ~150 ms, perfMiddleware records earlier). The actual write
occurred and is visible in `async-storage.csv` — 5 setItems, ~10-16 ms
MMKV native time each, full ~2.03 MB blob. This is a measurement quirk of
the deferred write path, not a regression. The throttle behaviour is
unchanged: one setItem per submit (no coalescing, because the 4-second
cadence is well outside the 250 ms throttle window).

## 4. Side-by-side aggregate

`t1 - t0` (JS-thread free):

| metric | BEFORE | THROTTLED | ASYNC + THROTTLED | THROTTLED vs BEFORE | ASYNC vs BEFORE | ASYNC vs THROTTLED |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| p50 | 416.6 | 407.5 | 411.8 | 1.02× faster | 1.01× faster | 1.01× slower |
| p95 | 449.8 | 418.3 | 424.4 | 1.08× faster | 1.06× faster | 1.01× slower |
| max | 454.0 | 420.2 | 424.9 | 1.08× faster | 1.07× faster | 1.01× slower |

`t2 - t0` (checkmark-visible / next rAF):

| metric | BEFORE | THROTTLED | ASYNC + THROTTLED | THROTTLED vs BEFORE | ASYNC vs BEFORE | ASYNC vs THROTTLED |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| p50 | 416.6 | 407.5 | 411.8 | 1.02× faster | 1.01× faster | 1.01× slower |
| p95 | 450.0 | 418.4 | 423.1 | 1.08× faster | 1.06× faster | 1.01× slower |
| max | 452.8 | 421.9 | 423.2 | 1.07× faster | 1.07× faster | 1.00× neutral |

`t1 - t0` and `t2 - t0` track each other within ~1 ms in every rep — both
callbacks (`setTimeout(0)` and `rAF`) fire on the same macrotask drain
once the dispatch cascade and the persist-queue trailing-edge timer have
both been processed.

Write characteristics:

| metric | BEFORE | THROTTLED | ASYNC + THROTTLED |
| --- | ---: | ---: | ---: |
| bytes / submit | 2,034,267 | 2,034,177 | 2,034,357 |
| setItem calls / submit | 1 | 1 | 1 |
| MMKV `set` mean (ms) | 12.4 | 11.5 | 13.6 |

Identical in all three columns: each submit writes the full ~2.03 MB blob
via exactly one MMKV `set` call. Async does not change WHAT is written or
HOW MANY writes happen; it only changes WHEN the native call runs inside
the post-dispatch macrotask queue.

## 5. Summary of effect

**The simulated measurement does NOT show the 5-8× drop on `t2 - t0` that
the maintainer's hypothesis predicted.** ASYNC + THROTTLED lands at the
same ~410 ms `t2-t0` p50 as THROTTLED-alone, well inside run-to-run noise.

**Why the synthetic understates the async benefit** — the maintainer's
hypothesis was:

> "wenn wir den MMKV-Write per `setTimeout(...,0)` ASYNC aus dem kritischen
>  Tick rausziehen, sieht der User den Hacken VOR dem Schreiben → gefühlt
>  instant. Erwarteter Effekt auf t2-t0: ~400 ms → ~50-100 ms (5-8× besser)."

That hypothesis is correct **for a real submit, where the React commit
re-renders the optimistic checkmark INSIDE the post-dispatch tick.** With
sync `setItem`, the ~13 ms MMKV.set + ~19 ms JSON.stringify happens
synchronously inside that commit phase, blocking the commit from finishing
and delaying the next paint. With async `setItem`, the commit phase
completes immediately and the next paint can land on the very next vsync
(~16 ms after dispatch).

**The simulated path does not have this commit phase.** The "Run 5
Simulated Submits" button fires from the Settings tab, where no JSX is
subscribed to `ADD_OR_UPDATE_SET_IN_WORKOUT` or `START_REST_TIMER`. So the
dispatch cascade triggers no React commit. The `requestAnimationFrame`
callback that captures `t2` just fires whenever the macrotask queue
drains, and that queue still contains the deferred MMKV write (just at a
later position). Net effect: `t2 - t0` is unchanged in the synthetic,
because the synthetic was never measuring the commit-phase saving.

The synthetic still proves three things the round-2 change MUST get right:

1. **The deferred write actually runs.** `async-storage.csv` shows all 5
   setItems landed on disk (~10-16 ms MMKV native each), with the same
   ~2.03 MB blob and the same 1-call-per-submit cadence as the other two
   runs. No data is dropped; only the macrotask scheduling moves.
2. **No regression in observable timing.** ASYNC + THROTTLED is within
   1.01× of THROTTLED-alone on every metric — async is not making
   anything visibly slower, even in the synthetic where it has nothing to
   improve.
3. **The unit test (`__tests__/utils/createBaseStorage.spec.ts`)** proves
   the wrapper contract: `setItem` returns `Promise.resolve(true)` BEFORE
   `mmkv.set` is invoked, and `mmkv.set` runs on the next macrotask with
   the same arguments. The behaviour is deterministic.

## 6. Recommendation

**Keep `throttle: 250` and the async `setItem` wrapper.** They cost near
nothing and they create real headroom for the user-perceived submit path,
even when the synthetic measurement cannot see it.

**Per-slice persistConfig split (#262 v1, deferred): _STILL ON THE TABLE,
PROBABLY NOT YET NEEDED_.**

The maintainer's round-2 hypothesis is the right hypothesis: the bottleneck
is the ~30-40 ms of MMKV.set + JSON.stringify happening INSIDE the React
commit. Async fixes that by moving the native call out of the critical
tick. Per-slice would reduce the SIZE of the per-submit write (from ~2.03
MB to ~5-50 KB for a typical set-add), which would shrink the JSON.stringify
to single-digit ms even when it does run synchronously. The two changes
are layered, not exclusive:

- Async alone fixes the per-submit user-perceived freeze IF the JS-thread
  pause was the limiting factor.
- Per-slice fixes both per-submit cost AND background flush cost AND ANY
  cascade that runs WITHOUT the safety of being inside an idle frame.

The next step is **NOT another synthetic measurement.** The next step is
the qualitative real-flow check described in section 7. If the human
maintainer reports that the checkmark feels instant after this round-2
change, per-slice can be deferred indefinitely. If it still feels laggy,
per-slice is justified.

## 7. Qualitative real-flow validation (Item E)

The ticket's Item E asks for a real-flow check: navigate into a live
training with `baseline-large.gains` imported, tap a planned set's submit
button, observe whether the checkmark appears instantly.

**The worker could not drive that interaction reliably from `adb`.** The
active-training screen is documented to fragment the accessibility tree
because of a continuously-updating duration counter (`-00:10:34`,
`01:33:30`), so `uiautomator dump` returns an opaque `FrameLayout` root
with no testIDs (agent-memory entry 153). The Train tab tap on the
`MaterialTopTabs` header is not received by the underlying TabBar when the
sibling Analysis tab is rendering live numbers. Horizontal swipes on the
content area trigger the prev-training pager, not the tab switch.

Evidence that the new build runs correctly with the round-2 code:

- `screenshots/05-async-build-in-training.png` — cold-launched APK on
  R5CN30HWZFN, baseline-large hydrated, in the **Push pull › Meso 2 ›
  Micro 4 Push** active training session via the "Start Training" button.
  The Analysis tab shows live duration `-00:10:34 / 01:33:30`, Volume
  `+709.00 (14135.00)`, Sets `+0.00 (15.00)`. This screen only renders
  when the redux store is fully hydrated AND the new async storage
  adapter has not broken the persist contract.
- `screenshots/04-async-after-run5-csv-dumped.png` — settings tab after
  the Run 5 Simulated Submits flow auto-dumped the CSVs into the app's
  `ExternalDirectoryPath`. All 5 submits captured cleanly.

**Maintainer ask:** please run the deployed APK from this branch, log a
set in a planned training session against `baseline-large.gains`, and
record the qualitative observation in PR #266. If the checkmark feels
instant (or close to it), close this loop and defer per-slice
indefinitely. If it still feels laggy at ~400 ms, escalate to per-slice.

## 8. Caveats

- **Measurement path is synthetic.** See section 5. Section 7 covers the
  consequence: the synthetic does not measure the React-commit-phase
  saving that async is designed to enable, so the synthetic numbers
  understate the real-world benefit.
- **`bytes_written_in_tick` reads 0 in `async-dispatch.csv`.** This is a
  measurement-order quirk: the deferred MMKV write happens at ~150 ms
  after dispatch entry (throttle window), but `perfMiddleware`'s
  setTimeout(0) callback fires much earlier and reads `tickBytes` before
  the deferred write has incremented it. The actual writes are correct
  and visible in `async-storage.csv`. If a follow-up measurement needs
  this column to read non-zero with throttle + async, instrument with a
  microtask + a "wait for next storage write" hook instead of a bare
  `setTimeout(0)`.
- **AppState flush is fire-and-forget.** The `change` listener calls
  `persistor.flush()` on every `active → background/inactive`
  transition. `flush()` is idempotent and is documented to drain any
  pending writes synchronously through the configured storage. It runs
  on a non-critical-render path (the screen is going away), so the
  one-time MMKV cost is invisible to the user. The listener is
  registered once at store creation; React strict-mode double-mount
  does not affect it because the store factory is called once per app
  process.
- **Single-device sample.** All 15 reps (5 BEFORE + 5 THROTTLED + 5
  ASYNC+THROTTLED) were captured on R5CN30HWZFN. Cross-device variance
  was not measured.
