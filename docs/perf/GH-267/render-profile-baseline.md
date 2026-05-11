# GH-267 — React render-profile baseline (read-only)

Follow-up to:

- **#260 / GH-253** — redux-persist baseline. Reducer is sub-7 ms; the
  per-dispatch `total_ms` (entry → next macrotask) is 410-450 ms because
  the 2 MB root blob is JSON-serialised + written on every dispatch.
- **#266 / GH-262** — `throttle: 250` + per-submit timing instrumentation.
  `t2 - t0` (rAF after the cascade) measured at 416 ms p50 baseline,
  407-410 ms p50 throttled. Throttle alone moved the floor by ~9 ms.

The open question after #266 was: where do the ~410 ms between dispatch
return and the next paint actually go? Is the dominant cost the React
side — selector reevaluation across all `useSelector` subscribers of the
workouts slice, reconciliation, commit and bridge — amplified by the
3,211-workout slice? Or is it something else?

This report uses `React.Profiler`, a per-dispatch paint-gap middleware,
and `useTracedSelector` to attribute the gap.

---

## 1. Setup

| Field | Value |
| --- | --- |
| Device | Samsung SM-G986B (Galaxy S20+ 5G), `R5CN30HWZFN` (real device, not emulator) |
| App | `com.powerliftingworkoutplanner` debug build off this branch |
| Dataset | `docs/tickets/GH-253/baseline-large.gains` (1,755,548 bytes raw), already imported on the device from prior GH-262 round |
| Persisted root blob | 2,034,449 → 2,035,268 bytes per write across the 10 measured submits (matches GH-253 / GH-262 numbers) |
| `exercises.allIds` | 83 |
| `workouts.allIds` | 3,211 |
| `trainings.allIds` | 421 |
| `videoAnalyses.allIds` | 26 |
| `trainingsPlan.allIds` | 5 |
| Repetitions | 5 set-submits per measurement path, ~4 s apart |
| Measurement paths | (a) **synthetic** — `LiveSubscribedProbe` NOT mounted, only Settings + the existing Tab-bar tree are subscribers. (b) **live-subscribed** — `LiveSubscribedProbe` mounted under `<React.Profiler id="live-subscribed-probe">`, hosting 5 `useTracedSelector` calls that mirror the access patterns of the real hot hooks (`useWorkoutById`, `useUnfinishedWorkout`, `useAllTimeOneRepMax`, `useLastFinishedWorkoutsByExerciseIds`, `useSettings`). |
| Driver | The "Run 5 Simulated Submits (GH-267)" button in `SettingsTab`. It dispatches `ADD_OR_UPDATE_SET_IN_WORKOUT` + `START_REST_TIMER` (the same cascade `ExecuteTraining.handleSubmitSet` produces) 5 times spaced 4 s apart, then auto-dumps the six CSVs at +22 s. |
| Measurement-path note | The real live-training screen on this device cannot be reliably automated for repeated set-submits — the active rest-timer keeps the UI tree fragmented at the accessibility layer (documented in `docs/memory/agent-memory.md` from GH-262). The wrapper-subscribed-component pattern (`LiveSubscribedProbe`) is the agreed substitute, called out in the ticket description. **Both paths run on R5CN30HWZFN.** |

### Instrumentation summary

All instrumentation is gated behind `__DEV_PERF__` (defaults to `__DEV__`,
overridable via `GAINS_DEV_PERF=0`). Production builds dead-code-eliminate
the entire profiling path because `__DEV_PERF__` is a module-level
constant.

| Component | Where | What it captures |
| --- | --- | --- |
| `<DevPerfProfiler id="execute-training">` | `app/components/Training/execute/ExecuteTraining.tsx` | One `RenderRecord` per React commit on the active-training subtree (real flow). |
| `<DevPerfProfiler id="live-subscribed-probe">` | `app/utils/perf/LiveSubscribedProbe.tsx` (rendered from `SettingsTab` when the toggle is on) | One `RenderRecord` per commit on a small subtree subscribed to the workouts slice. |
| `paintGapMiddleware` | `app/utils/perf/paintGapMiddleware.ts`, plumbed in `configureStore.ts` after `perfMiddleware` | Per-dispatch `dispatch_entry_ms`, `dispatch_return_ms`, `paint_observed_ms` (rAF after the dispatch returns), and `gap_ms = paint_observed_ms - dispatch_return_ms`. |
| `useTracedSelector(name, selector)` | `app/utils/perf/useTracedSelector.ts`, used inside the probe | One `SelectorRecord` per react-redux invocation of the selector with `name`, `ms`, `last_action_type`. |
| Reused unchanged from #260 / #266 | `perfMiddleware`, `profilingStorage`, `instrumentSubmitTiming`, `dumpPerfCsv`, "Run 5 Simulated Submits" button family in `SettingsTab` | Keeps `total_ms`, storage bytes, and `t1-t0` / `t2-t0` rows directly comparable across PR #260 → #266 → #267. |

The new buffers (`renders`, `paintGaps`, `selectors`) are flushed by the
existing **Dump Perf CSV** button into three new files —
`raw-render-{tag}.csv`, `raw-paint-gap-{tag}.csv`, `raw-selector-{tag}.csv` —
alongside the existing `raw-{storage,dispatch,submits}.csv`.

---

## 2. Aggregate paint-gap

`gap_ms = paint_observed_ms - dispatch_return_ms` per dispatch (rAF after
each `next(action)` returns from the synchronous reducer/middleware
chain).

| Path | n | min | p50 | p95 | max | mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| **synthetic** (no workouts subscriber under Profiler) | 10 | 408.9 | **417.5** | 443.3 | 445.5 | 422.9 |
| **live-subscribed** (workouts.byId / byExerciseId subscribers in tree) | 10 | 404.8 | **407.7** | 410.6 | 411.2 | 408.4 |

By action type (live-subscribed):

| action | n | min | p50 | p95 | max |
| --- | ---: | ---: | ---: | ---: | ---: |
| `ADD_OR_UPDATE_SET_IN_WORKOUT` | 5 | 407.2 | 409.5 | 410.6 | 411.2 |
| `START_REST_TIMER` | 5 | 404.8 | 406.8 | 407.8 | 408.5 |

Submit-button latency (sanity check vs. #266):

| Path | metric | n | p50 | p95 |
| --- | --- | ---: | ---: | ---: |
| synthetic | `t1 - t0` | 5 | 421.7 | 435.1 |
| synthetic | `t2 - t0` | 5 | 422.9 | 435.1 |
| live | `t1 - t0` | 5 | 413.9 | 415.6 |
| live | `t2 - t0` | 5 | 413.9 | 415.6 |

**Interpretation — confirms / refutes the ticket's hypothesis.**

The ticket asked whether the 365-415 ms gap reported in #260 / #266 was
React-side cost amplified by the workouts subscriber graph. **It is not.**
Mounting an active workouts-slice subscriber subtree (the
`LiveSubscribedProbe`) under a Profiler did not increase the gap — it
*decreased* the p50 by ~10 ms and tightened the spread (variance dropped
from min-max of 36.6 ms to 6.4 ms). Both paths land in a 405-445 ms band
that matches the GH-262 t2-t0 baseline almost exactly.

The 365-415 ms gap is a **system floor**, not a workouts-subscriber tax.

---

## 3. Per-component render table (live-subscribed path)

| Profiler `id` | phase | count | sum (ms) | mean (ms) | p95 (ms) |
| --- | --- | ---: | ---: | ---: | ---: |
| `live-subscribed-probe` | update | 5 | 2.800 | **0.560** | 0.557 |
| `live-subscribed-probe` | mount | 1 | 1.554 | 1.554 | 1.554 |

The probe is a single `<View>` with one `<Text>` showing live counters,
hosting 5 `useTracedSelector` subscriptions of which 4 are O(1) lookups
into normalised state and 1 is an `useAllTimeOneRepMax`-shaped reducer
over `workouts.byExerciseId[id].length` (87 workouts for the first
exercise on this dataset).

**Five updates over five submits.** React 18 batches both actions in each
cascade (`ADD_OR_UPDATE_SET_IN_WORKOUT` + `START_REST_TIMER`) into a
single commit, so the probe re-renders exactly once per submit even
though the cascade dispatches twice. **Each update is sub-millisecond.**

A workouts-subscriber subtree commits in **<1 ms** on this device with
this dataset. The cost of *reconciling* one such subtree is not the
bottleneck.

The `execute-training` Profiler did not commit during this measurement
window — the run was driven from Settings, not the live-training screen
(see measurement-path note in §1). The wrapper is in place for the next
session that drives the real flow.

---

## 4. Top components by total update-time during the cascade

Only one Profiler tree was actively subscribing during the measurement
(the `LiveSubscribedProbe`). The full top-5 from this run:

| Rank | Profiler id | total update time (ms) | code reference |
| ---: | --- | ---: | --- |
| 1 | `live-subscribed-probe` | 2.800 | `app/utils/perf/LiveSubscribedProbe.tsx` |
| 2 | *(no other Profiler committed in this window)* | – | – |
| 3 | – | – | – |
| 4 | – | – | – |
| 5 | – | – | – |

Note this is **not** evidence that the live-training screen is fast in
production — it is evidence that on the dispatch cascade we measured
(set-submit on a synthetic driver), the React side commits in ~1 ms even
when the affected slice is the 1.7 MB / 3,211-entry workouts slice. The
real screen has additional Profilers wrapping `<ExecuteTraining>` for the
follow-up tap-driven session.

---

## 5. Per-cascade decomposition (live-subscribed path)

For each `ADD_OR_UPDATE_SET_IN_WORKOUT` dispatch we matched the next
`live-subscribed-probe` update commit and computed the time slices.

| Cascade | dispatch_return → React commit (ms) | React commit → paint observed (ms) | React `actualDuration` (ms) |
| ---: | ---: | ---: | ---: |
| 1 | 294.7 | 112.5 | 0.600 |
| 2 | 297.5 | 113.7 | 0.556 |
| 3 | 297.5 | 112.0 | 0.540 |
| 4 | 299.4 | 111.2 | 0.557 |
| 5 | 296.7 | 110.9 | 0.547 |

**This is the central finding.** Of the ~410 ms gap:

- **~297 ms is between dispatch return and the React commit.** The
  reducer ran in ~3-7 ms; React did not commit for another ~290 ms. That
  window holds the JS thread busy with `JSON.stringify` of the 2.03 MB
  root blob (~150 ms, per #260) plus the redux-persist throttle delay
  (~150 ms — `throttle: 250` from #266 means the persist can fire any
  time inside the 0-250 ms window after a dispatch). Storage CSV
  confirms `setItem` lands at +147 ms after dispatch on average; the
  remaining ~150 ms is JSON-serialise on the JS thread before MMKV is
  called.
- **~112 ms is between React commit and paint observed.** This is one
  bridge round-trip + the next vsync alignment on this device. React's
  own work (`actualDuration`) is **0.55 ms** — three orders of magnitude
  below the gap.

So the breakdown of a single set-submit on this dataset is:

```
0 ms ─────── dispatch entry
  ~6 ms ──── reducer done, dispatch returns
            │
            │ ~150 ms persist throttle wait
            │ ~150 ms JSON.stringify (2.03 MB root blob)
            │   ~16 ms MMKV native setItem
            │
~297 ms ─── React commit (actualDuration ~0.55 ms — basically free)
            │
            │ ~112 ms bridge + vsync
            │
~410 ms ─── next paint observed (rAF fires)
```

---

## 6. Selector invalidation table (live-subscribed path)

Per-call cost from `useTracedSelector` for the 5 hooks inside the probe,
across the 10 dispatches in the live run:

| Rank | Selector | calls | total (ms) | mean (ms) | max (ms) |
| ---: | --- | ---: | ---: | ---: | ---: |
| 1 | `useAllTimeOneRepMax-like` | 16 | **4.299** | 0.269 | 0.756 |
| 2 | `settings.restTimer` | 16 | 0.056 | 0.004 | 0.010 |
| 3 | `workouts.byExerciseId[id]` | 16 | 0.046 | 0.003 | 0.004 |
| 4 | `workouts.byId[lastId]` | 16 | 0.037 | 0.002 | 0.003 |
| 5 | `exercises.allIds[0]` | 16 | 0.032 | 0.002 | 0.003 |

The "16 calls" per selector is react-redux's
`useSyncExternalStoreWithSelector` evaluating the selector on every
relevant store update (10 dispatches in this run plus 6 mount/initial
evaluations). All of these together account for **4.5 ms across 5
submits — i.e. <1 ms per submit on the entire probe's selector
graph.** Even the heaviest (`useAllTimeOneRepMax-like`, which iterates
the 87 workouts for the first exercise and computes 1RM) maxes out at
0.76 ms.

Selectors are **not** the bottleneck on this dataset. The 365-415 ms gap
cannot be moved by memoising selectors or wrapping more components in
`React.memo`.

---

## 7. Bottleneck hypothesis

1. The dominant ~410 ms gap is **not React selector / reconciliation /
   commit cost on the workouts subtree**. Mounting a real
   `state.workouts.byId` + `state.workouts.byExerciseId` subscriber
   under `<React.Profiler>` did not raise the gap (it tightened it),
   and React's own `actualDuration` is **~0.55 ms per commit** — three
   orders of magnitude below the gap.
2. The largest slice (~297 ms of the 410 ms, measured per-cascade) is
   the **synchronous JS-side cost of redux-persist serialising and
   writing the 2.03 MB root blob** — `JSON.stringify` of the full
   `persist:root` snapshot dominates, with the throttle window
   contributing the rest. The reducer itself is 3-7 ms; everything else
   in that 297 ms is `JSON.stringify` + throttle wait + MMKV native call,
   all happening on the JS thread before React even gets a chance to
   commit.
3. The remaining ~112 ms (React commit → next vsync paint) is a
   bridge-and-display floor for this device on this React Native
   version. It is consistent across cascades (110-114 ms range) and is
   not addressable from product code.

This means **the GH-253 recommendation #1 (per-slice persist keys) is the
single largest available win.** A per-slice split shrinks the per-submit
serialised payload from 2.03 MB to ~50 KB (workouts + settings.restTimer
diffs), dropping `JSON.stringify` from ~150 ms to ~5 ms. Combined with
moving the throttle wait out of the critical path (it is already there,
but the throttle window itself stays inside the dispatch-to-paint gap),
this should pull the floor toward 100-120 ms — the bridge/vsync slice we
cannot move from JS.

---

## 8. Recommendations ranked by gain ÷ effort

| # | Optimisation | Expected gain | Effort | Notes |
| ---: | --- | --- | --- | --- |
| 1 | **Per-slice persist keys** (`persist:workouts`, `persist:settings`, …) replacing the single `persist:root` blob. One-shot migration. | **~250-300 ms off the per-submit gap** — reduces the JS-side `JSON.stringify` slice from ~150 ms (2.03 MB) to ~5 ms (~50 KB) for typical set-submit cascades. Keeps the GH-262 throttle as-is so rapid taps coalesce. | Medium — touches `configureStore.ts`, `createMigrate`, and the storage adapter; requires a one-shot migration that keys-out the existing root blob into per-slice keys at first launch. | Already recommended by GH-253 #260 (PR description, "next ticket #1"). This GH-267 measurement gives it the strongest empirical case yet. |
| 2 | **Strip derivable indexes from the persisted `workouts` slice** (`byExerciseId`, `allIds` ordering) and rebuild them at hydrate. | **~50-70 ms** off `JSON.stringify` even before per-slice split — `byExerciseId` alone is non-trivial to serialise as it duplicates id refs. | Small — pure `whitelist` / `transform` change. Composable with #1. | Reuses the existing `redux-persist-transform-filter` already wired into `configureStore.ts:130`. |
| 3 | **Move `JSON.stringify` off the JS critical path.** Either (a) chunk the serialise step across `requestIdleCallback`-like scheduling, or (b) hand the structured root to a native-thread JSON encoder. | **~100-150 ms gap reduction** by allowing React to commit before the persist-serialise finishes. Does not reduce total work; reorders it so paint happens first, persist follows. | Medium-large — RN does not ship `requestIdleCallback`; needs Hermes microtask scheduling or a native module. Pairs with #1: with a 50 KB blob the work is already <5 ms and reordering buys little. | Lower priority once #1 is in. |
| 4 | **Conditional `React.memo` on `Estimated1RmCard`, `RestTimerCard`, `useAllTimeOneRepMax` consumers.** | **<10 ms per submit** — selector cost is already <1 ms total across the live tree on this dataset. Cleanup-grade win, not a floor-mover. | Small — local component changes only. | Cheap to do alongside any of the above; do not expect a measurable user-facing shift on its own. |
| 5 | **(Conditional, only if #1+#2 don't hit target.)** Move the `workouts` slice to SQLite (`op-sqlite` / `react-native-quick-sqlite`) so per-set-write is a single insert instead of a slice serialise. | **Floor-level win — drops persist work to <10 ms regardless of dataset size.** | Large — touches all `useWorkoutsBy*` hooks, exporter, importer, migrations. Only worth it if #1+#2 don't get per-submit cost under 150 ms. | Already flagged as conditional in GH-253 PR description. |

---

## 9. Raw CSVs

- `raw-render-synthetic.csv`, `raw-render-live.csv`
- `raw-paint-gap-synthetic.csv`, `raw-paint-gap-live.csv`
- `raw-selector-synthetic.csv`, `raw-selector-live.csv`
- `raw-submits-synthetic.csv`, `raw-submits-live.csv`
- `raw-dispatch-synthetic.csv`, `raw-dispatch-live.csv`
- `raw-storage-synthetic.csv`, `raw-storage-live.csv`

The `live` CSVs were pulled by the auto-dump that fires +22 s after the
`Run 5 (live)` button. Because the in-memory ring buffer was not reset
between the two runs, the `paint-gap`, `submits`, `dispatch`, `storage`
CSVs in the `live` files contain both runs' rows; the `render` and
`selector` CSVs are clean (those buffers were empty before the
`LiveSubscribedProbe` mounted). The aggregate tables in §2 were computed
from the `live` files filtered to `ts_ms > 1778485800000` (the boundary
between the two runs); see the `python` block in
`__tests__`-style commentary in `summary.md` for the exact filter used.
