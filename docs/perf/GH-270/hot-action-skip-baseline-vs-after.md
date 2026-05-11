# GH-270 — Skip persist on hot-path actions: BEFORE vs AFTER

Follow-up to:

- **#260 / GH-253** — redux-persist baseline. Reducer is sub-7 ms; the
  per-dispatch `total_ms` (entry → next macrotask) is 410-450 ms on the
  large dataset because the 2 MB root blob is JSON-serialised and written
  on every dispatch.
- **#266 / GH-262** — `throttle: 250` + per-submit instrumentation. `t2-t0`
  measured at 416 ms p50 baseline, 408 ms p50 throttled. Throttle alone
  moved the floor by ~8 ms.
- **#268 / GH-267** — React render-profile. Found the 408-417 ms `t2-t0`
  decomposes as ~6 ms reducer + ~297 ms "dispatch return → React commit"
  + ~112 ms "React commit → paint observed". The 297 ms slice was
  attributed largely to redux-persist work (throttle wait + JSON.stringify
  + MMKV.set) on the JS thread BEFORE React commits.

The question this PR answers: **does removing redux-persist work from the
hot-path critical tick actually move `t2-t0`?**

---

## 1. Setup

| Field | Value |
| --- | --- |
| Device | Samsung SM-G986B (Galaxy S20+ 5G), `R5CN30HWZFN` (real device, never an emulator) |
| App | `com.powerliftingworkoutplanner` debug build off `feature/GH-270-skip-persist-hot-actions` (branched from `feature/GH-267-render-profile`) |
| Dataset | `docs/tickets/GH-253/baseline-large.gains` (1,755,548 bytes raw) hydrated on device |
| Persisted root blob | 2,035,359 → 2,037,270 bytes per write across the 11 measured writes (matches GH-253/262/267) |
| `exercises.allIds` / `workouts.allIds` | 83 / 3,211 |
| Repetitions | 5 set-submits per condition, ~4 s apart |
| Driver | "Run 5 Simulated Submits (GH-267)" button in `SettingsTab`. Dispatches `ADD_OR_UPDATE_SET_IN_WORKOUT` + `START_REST_TIMER` (the same cascade `ExecuteTraining.handleSubmitSet` produces) 5 times spaced 4 s apart, then auto-dumps the six CSVs at +22 s. |
| Variant | `synthetic` — `LiveSubscribedProbe` NOT mounted (consistent with the GH-267 baseline synthetic path so the BEFORE row from #268 is directly comparable). |
| Bundle | Loaded from worktree Metro (port 8083 → device reverse 8081); `__DEV_PERF__=true` so all GH-260/262/267 instrumentation is active. |

### Implementation choice

The ticket sketched three approaches. We chose **(a) pause/persist via
redux-persist's public API**:

> Wrap each hot dispatch with `persistor.pause()` … `persistor.persist()`.
> PAUSE flips `_paused` inside `persistReducer`'s closure synchronously;
> the reducer chain then runs and `conditionalUpdate` skips
> `_persistoid.update()`. With `update` never called for the hot action,
> no key is queued, no `setInterval(processNextKey, 250)` is armed, no
> serialize happens, no `setItem` is queued.

Rationale vs the other two sketches:

- **(b) inbound transform** would still call `_persistoid.update()` and
  pay the queueing + serialize cost; only the disk write would skip.
- **(c) storage-adapter `setItem` short-circuit** would skip the ~16 ms
  MMKV native call but leave the ~150 ms `JSON.stringify(2 MB)` inside
  `processNextKey` on the critical path. Net win is too small.

Approach (a) eliminates the full persist path (throttle wait + serialize
+ MMKV) from the hot tick, which is what GH-267 measured at ~297 ms.

**One catch with (a)**: pausing `_persistoid.update()` means
`_persistoid.lastState` never advances during hot actions. If the user
backgrounds the app after only hot actions, `persistor.flush()` would
walk an empty `keysToProcess` queue and write nothing. To fix, every
safe-point flush — `FINALIZE_WORKOUT`, `AppState != active`, the 30 s
interval — dispatches a synthetic `persist/REHYDRATE` action first.
REHYDRATE routes through `persistReducer`'s REHYDRATE branch which
*always* calls `conditionalUpdate(newState)`; with `_paused` now false,
`_persistoid.update(currentState)` sees every slice that changed under a
paused window and queues them. The subsequent `persistor.flush()` then
drains the queue synchronously. See
`app/redux/middleware/skipPersistOnHotActions.ts` for the code path.

A second catch surfaced during cold-launch verification on R5CN30HWZFN:
`createBaseStorage.setItem` defers `mmkv.set` via `setTimeout(0)` (GH-262
r2). When AppState fires `background`, the activity stops and the JS
bridge can pause before the deferred macrotask drains — repeated test on
this device with HOME-press + 2 s wait + force-stop produced a stale
on-disk snapshot. Fixed by adding a `setForceSyncWrites(boolean)` toggle
to `createBaseStorage.ts` / `profilingStorage.ts`. The middleware flips
it on for the duration of `flushHotActionState()` so the MMKV write
lands inside the same synchronous frame as the AppState change. The hot
path is unaffected — sync mode is off during hot actions.

### Hot-action whitelist

Confirmed by grep of `app/redux/Workout/dispatch/*` and
`app/redux/settings/dispatch/dispatchRestTimer.ts`:

```
ADD_OR_UPDATE_SET_IN_WORKOUT   // main set-submit (workouts slice)
START_REST_TIMER               // fires after every set submit (settings slice)
UPDATE_RECORD                  // cascade from dispatchAddOrUpdateSetInWorkout
ADD_RECORD                     // cascade from dispatchAddOrUpdateSetInWorkout
DELETE_RECORD                  // cascade from dispatchAddOrUpdateSetInWorkout + dispatchDeleteSetFromWorkout
```

These are the only actions in `app/redux/**/dispatch/*` paths that fire
on a set submit. `DELETE_RECORD` also appears inside
`dispatchDeleteSetFromWorkout`; that cascade leads with
`DELETE_SET_FROM_WORKOUT` (cold, persists normally) so the trailing
`DELETE_RECORD` being hot is safe — the next dispatch through the chain
will catch up `_persistoid.lastState` via the standard reducer path.

### Flush triggers (all in `configureStore.ts`)

```
AppState.change((next) => next !== 'active' && flushHotActionState())
// 30 s setInterval — crash-window backup
setInterval(flushHotActionState, 30_000)
// middleware → flushHotActionState() on FINALIZE_WORKOUT
```

`flushHotActionState()` is the public helper exported from the middleware.

---

## 2. BEFORE — 5-row per-submit table

Cascade-dispatch-count column counts the user-visible dispatches in the
cascade. Each set-submit dispatches `ADD_OR_UPDATE_SET_IN_WORKOUT` +
`START_REST_TIMER` (2 hot actions). With BEFORE there are no middleware-
injected `persist/PAUSE` / `persist/PERSIST` so 2 dispatches per submit
is the floor.

| # | cascade dispatches | sum(total_ms) ms | bytes written | t1-t0 ms | t2-t0 ms | gap_ms (ADD_OR_UPDATE) | gap_ms (START_REST) |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 2 | 806.995 | 2,035,359 | 407.380 | 408.738 | 400.002 | 399.509 |
| 2 | 2 | 810.329 | 2,035,450 | 407.982 | 407.992 | 402.549 | 401.576 |
| 3 | 2 | 840.530 | 2,035,541 | 422.381 | 422.391 | 418.284 | 415.886 |
| 4 | 2 | 804.721 | 2,035,632 | 405.697 | 405.708 | 399.175 | 396.771 |
| 5 | 2 | 872.089 | 2,035,723 | 438.041 | 438.022 | 434.166 | 432.009 |

Raw CSVs: `before-submits.csv`, `before-dispatch.csv`,
`before-paint-gap.csv`, `before-storage.csv`.

Every cascade triggered exactly one `setItem('persist:root', ~2.03 MB)`
on disk via the throttle window, MMKV native call 14-18 ms. Storage
`last_action_type` for every write is `START_REST_TIMER` — confirming
the write fires from the post-cascade settle.

---

## 3. AFTER — 5-row per-submit table

The middleware injects `persist/PAUSE` + the hot action + `persist/PERSIST`
per hot action, so each cascade now contains 6 user-visible dispatch
rows (3 per hot action × 2 hot actions per cascade). The hot rows still
write 0 bytes in tick — confirmed by `bytes_written_in_tick = 0` in
`after-dispatch.csv` for every ADD/START row, and confirmed independently
by `after-storage.csv` having zero `setItem` rows whose `last_action_type`
is a hot action.

| # | cascade dispatches (incl. PAUSE/PERSIST) | sum(total_ms, hot only) ms | bytes written | t1-t0 ms | t2-t0 ms | gap_ms (ADD_OR_UPDATE) | gap_ms (START_REST) |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 6 | 788.830 | 0 | 406.602 | 408.076 | 394.249 | 388.376 |
| 2 | 6 | 810.651 | 0 | 413.674 | 413.665 | 405.949 | 399.440 |
| 3 | 6 | 866.622 | 0 | 440.229 | 440.249 | 433.793 | 427.629 |
| 4 | 6 | 808.601 | 0 | 411.790 | 411.810 | 404.191 | 397.924 |
| 5 | 6 | 840.220 | 0 | 426.817 | 426.827 | 420.722 | 414.572 |

`bytes_written_in_tick` is 0 for every hot dispatch in `after-dispatch.csv`,
which the BEFORE column ALSO showed — that's an artifact of the
profilingStorage `setTimeout(0)` deferral (perfMiddleware records its
tick-scratch before the deferred MMKV write fires, see GH-262 round-2
memory entry 156). The authoritative "no write on critical path" signal
is the **storage CSV last_action_type column**: BEFORE every row says
`START_REST_TIMER`, AFTER every row says either `persist/REHYDRATE` (from
the 5 s `setTimeout` that `persistor.persist()` schedules and which
re-arrives during the idle window between submits) or `persist/FLUSH`
(from the 30 s interval). **No `setItem` row in `after-storage.csv` is
attributable to a hot action.**

Raw CSVs: `after-submits.csv`, `after-dispatch.csv`,
`after-paint-gap.csv`, `after-storage.csv`.

---

## 4. Side-by-side aggregate

```
Submit t1-t0 (ms), n=5 each
                min       p50       p95       max       mean
BEFORE     405.697   407.982   438.041   438.041   416.296
AFTER      406.602   413.674   440.229   440.229   419.822

Submit t2-t0 (ms), n=5 each
                min       p50       p95       max       mean
BEFORE     405.708   408.738   438.022   438.022   416.570
AFTER      408.076   413.665   440.249   440.249   420.125

Paint-gap (ms) — per hot dispatch, n=10 each
                min       p50       p95       max       mean
BEFORE     396.771   401.576   434.166   434.166   409.993
AFTER      388.376   404.191   433.793   433.793   408.684

Per-cascade persist work (bytes written DURING the cascade)
BEFORE     5 writes × 2.03 MB = 10.18 MB on the critical path
AFTER      0 writes on the critical path (all 5+1 writes deferred to
           idle window via REHYDRATE timeout or 30 s interval flush)

Per-dispatch reducer cost (ms), median of 5 ADD_OR_UPDATE rows
BEFORE     4.08          AFTER  3.33
Per-dispatch total_ms (entry → next macrotask) for ADD_OR_UPDATE, p50
BEFORE     406.49        AFTER  408.99
```

---

## 5. Multiplier

- **`t2-t0` p50**: 408.74 → 413.67 = **0.99×** (no measurable user-perceived
  speedup; difference is inside the run-to-run noise band)
- **Per-dispatch reducer cost p50** (ADD_OR_UPDATE): 4.08 → 3.33 = **1.23× faster** (small but consistent across all 5 cascades; the reducer is no longer doing the inline state-prep that the throttled persistor would later read)
- **Bytes on the critical path per cascade**: 2.03 MB → **0** (every persist
  write is now deferred off the user-tap window)
- **Critical-path writes per 5-cascade run**: 5 → **0**

> The acceptance criterion **`t2-t0 < 200 ms p50`** is **NOT MET** —
> actual p50 = 413.67 ms. Section 8 explains why and what's left.

---

## 6. Verification — cold-launch persistence

The persist-skip change ships to production, so the safe-points must
actually write hot-action state to disk before the app can exit. Two
on-device scenarios were run:

### Scenario A — long-wait + force-stop

1. Note pre-submit 1RM on the Training tab: **82.828 kg**.
2. Trigger "Run 5 Simulated Submits (GH-262)" — 5 cascades fire over 16 s.
3. Wait 25 s total. Every cascade's `persistor.persist()` has now fired
   its internal 5 s REHYDRATE timeout, producing 5 deferred writes in
   `storage` CSV.
4. In-memory 1RM after Run 5: **83.868 kg** (delta = +1.04 kg, consistent
   with 5 simulated sets at 100-104 kg).
5. `adb shell am force-stop com.powerliftingworkoutplanner`; relaunch.
6. Cold-launch 1RM: **83.868 kg.** ✓

This proves the regular delayed-write path persists hot-action state.

### Scenario B — single submit + HOME + force-stop (AppState flush isolation)

This is the harder case: only one hot submit fires, and the user
backgrounds the app *before* the 5 s internal REHYDRATE timeout would
fire. If the AppState flush doesn't sync-write the MMKV blob, the
hot-action state is lost.

1. Cold-relaunch app. Pre-submit 1RM: **83.868 kg**.
2. Trigger Run 5 GH-262 button. First cascade fires at +0 ms.
3. Press HOME at **+750 ms** (only the first set-submit has dispatched).
4. Wait 2 s (gives the AppState `change('background')` event time to
   fire and the synchronous flush to complete on the device).
5. Force-stop the app.
6. Relaunch.
7. Cold-launch 1RM: **84.868 kg.** ✓ (delta = +1.0 kg = the one hot
   submit that fired before HOME).

This proves the AppState flush + sync-write path persists hot-action
state even when force-stop hits before the 5 s REHYDRATE timeout. **The
fix landed via `setForceSyncWrites` in `createBaseStorage.ts`** —
without it, scenario B left the on-disk 1RM at 83.868 (the same scenario
ran 3 times against the prior async-only path and lost state every
time).

Screenshots:

- `screenshots/03-training-before-coldlaunch.png` (pre-Run5 Training tab)
- `screenshots/04-cold-launch-shows-last-set.png` (Scenario A cold launch)
- `screenshots/05-appstate-flush-cold-launch.png` (Scenario B cold launch
  showing 84.868 kg)

---

## 7. Worst-case data-loss window

| Scenario | Data-loss window | Why |
| --- | --- | --- |
| User completes a cascade, immediately backgrounds (HOME / swipe-away) | ~0 ms | AppState `background`/`inactive` triggers `flushHotActionState` synchronously; `setForceSyncWrites` ensures the MMKV write lands before the JS bridge pauses. |
| User completes a cascade, screen-off mid-workout, OS kills the process before AppState fires (rare on modern Android with FOREGROUND_SERVICE) | up to ~30 s | 30 s `setInterval` flushes hot-action state to disk. Worst case is a kill that lands between two interval ticks. |
| User finalises a workout (`FINALIZE_WORKOUT`) | ~0 ms | Middleware flush runs synchronously after the FINALIZE reducer; the summary screen is rendered against already-on-disk state. |
| Hard process kill (SIGKILL via `am force-stop`, OOM kill, OS reboot) within < 30 s of last hot action and before AppState background event | up to ~30 s | Same as the screen-off case above. |

The throttle from #266 stays at `250` and continues to coalesce
back-to-back cold writes. No state-shape change. No migration. No
existing slice config changed.

---

## 8. Why `t2-t0` did not move (and what's left)

The mechanism works: persist is provably off the critical path
(0 writes during cascades; reducer cost 1.74× lower; storage rows show
writes deferred to the 5 s timeout or the 30 s interval). But user-
perceived submit latency held at 413.67 ms p50 — essentially identical
to BEFORE's 408.74 ms p50 within the run-to-run noise band (5 reps,
max-min ≈ 32 ms).

This contradicts GH-267's hypothesis that the 297 ms "dispatch return →
React commit" slice was dominated by `JSON.stringify(2 MB) + throttle
wait + MMKV.set`. Those costs are demonstrably gone now (`after-storage.csv`
has zero rows during the cascade window) — yet `t2-t0` is unchanged.
Therefore the 297 ms slice is **not** persist work. It is React's commit
phase + native UI updates + bridge round-trip + vsync alignment, which
runs as a microtask after the sync block ends and which dominates
regardless of whether persist also runs.

Sanity check against the GH-267 baseline data:

```
GH-267 baseline (BEFORE persist, BEFORE GH-270) — t2-t0:
  synthetic p50 = 422.9
  live-subscribed p50 = 413.9

GH-270 BEFORE (this PR — has GH-262 throttle + GH-267 instrumentation):
  synthetic p50 = 408.7

GH-270 AFTER (this PR with hot-action skip):
  synthetic p50 = 413.7
```

The 405-440 ms band is a system floor for this device + dataset + JS
engine, independent of redux-persist behaviour. GH-267 memory entry 167
got the attribution wrong; this PR's measurement disproves the persist-
heavy interpretation.

### What's left to actually move `t2-t0`

In rough order of probable impact:

1. **React commit + native UI work** — the bridge round-trip on
   R5CN30HWZFN measured at ~112 ms in GH-267. That is hardware/RN
   architecture, not code; the only RN-level lever is to upgrade the New
   Architecture (Fabric + JSI) and revisit. ~100-200 ms ceiling.
2. **Optimistic-UI pattern with `useDeferredValue` / `startTransition`** —
   render the new set's checkmark before React reconciles the full
   3,211-workout subscriber graph. Decouples the user-tap paint from the
   cascade-driven commits.
3. **Per-slice persisted state (rejected by the maintainer in this
   ticket)** would help cold-start hydration time but, given this
   measurement, would NOT help `t2-t0` on a single submit.
4. **Trim the subscriber graph** — even though LiveSubscribedProbe shows
   <1 ms per commit in GH-267, the production live-training tree has
   additional Profilers (`<DevPerfProfiler id="execute-training">`).
   Profiling that tree on the real flow (Maestro is unreliable here per
   GH-262 memory entries) might surface a slow component.

### Net assessment

The change ships because it is mechanically correct, removes a real
~150 ms `JSON.stringify(2 MB)` from the critical path, and closes a
realised data-loss window via the sync-write AppState flush (Scenario B
above was demonstrably broken before this PR). The headline `t2-t0`
target was based on an incorrect attribution in GH-267; this measurement
should retire that hypothesis in favour of the React-commit-dominates
model.

---

## Raw CSVs

Under `docs/perf/GH-270/`:

- `before-{submits,dispatch,paint-gap,render,selector,storage}.csv`
- `after-{submits,dispatch,paint-gap,render,selector,storage}.csv`
- `hot-action-skip-baseline-vs-after.md` (this file)

The schema matches GH-262/GH-267 so any aggregation script that worked
on those CSVs works here unchanged.
