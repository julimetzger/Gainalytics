# REHYDRATE storm — root-cause investigation (GH-279)

**Type:** read-only perf diagnostic. No reducer / selector / storage / component
behaviour was changed. The only code added is a tiny dev-gated trace middleware
(see *Method*).

**Date:** 2026-05-14 · **Device:** R5CN30HWZFN (physical, `ro.build.type=user`)
**Branch under test:** `feature/GH-279`, branched fresh from `origin/master`
(`f98f3715`) — deliberately **not** stacked on the perf branches
(`perf/profiler-coverage-investigation`, GH-253…GH-275).

---

## TL;DR — verdict

> **The 11× `persist/REHYDRATE` storm is an ARTEFACT of the instrumentation
> stack, NOT a master bug.**

On the clean, shipped `configureStore.ts`, a 5-set live-training cascade
dispatches **zero** `persist/*` actions. `persist/REHYDRATE` fires **exactly
once, ever — at app boot** (the normal redux-persist bootstrap), and never
again.

The causing component is **`app/redux/middleware/skipPersistOnHotActions.ts`**
(introduced on the perf branch by GH-270), wired in through the perf-branch
`configureStore.ts`. Its `flushHotActionState()` helper is the **only** place
in the entire repository — on any branch — that calls
`store.dispatch({type: 'persist/REHYDRATE', …})`.

---

## Background

The PERF-COVERAGE run (`perf/profiler-coverage-investigation`, 2026-05-13,
device R5CN30HWZFN) recorded in `coverage-dispatch-1948.csv`:

| action_type        | n  | mean total_ms |
|--------------------|----|---------------|
| `persist/PERSIST`  | 10 | 626           |
| `persist/REHYDRATE`| 11 | 608           |
| `persist/PAUSE`    | 10 | —             |
| `persist/FLUSH`    | 1  | —             |

redux-persist dispatches `persist/REHYDRATE` exactly **once** — at boot, when
`persistStore()` finishes reading storage back. 11× inside a single 22-second
5-set cascade is anomalous. The question: is it a real master bug, or an
artefact of the measurement stack (`app/utils/perf/*` + the GH-262/GH-270
modified `configureStore.ts`)?

## Method

1. Branched fresh from `origin/master` (`f98f3715`). Confirmed `app/utils/perf/`
   does **not** exist on master and `configureStore.ts` is the shipped version
   (single module-scope `persistStore()` call, `App.tsx:60`).
2. Added one minimal, independent, dev-gated middleware —
   `app/redux/middleware/persistActionTrace.ts` (~22 lines). It logs every
   action whose `type` starts with `persist/` as a single
   `[PERSIST_TRACE] #<n> <type> @ <epoch_ms>` line, readable via
   `adb logcat`. It is gated on `__DEV__` and added to the store middleware
   array only for `NODE_ENV === 'development'`, so production bundles are
   untouched. It does **not** use the `app/utils/perf/` stack.
3. Built the debug APK from this clean branch, installed it on R5CN30HWZFN
   (`baseline-large.gains` data was already imported from the GH-275 runs —
   the Training tab showed the "Push pull" plan with real micros/sets).
4. Opened the live training screen ("Push pull › Meso 2 / Micro 5 Push") and
   performed **5 real set submits** via `adb` taps into the
   Reps/Weight inputs + "Add" button — no R5 overlay, no instrumentation
   driver. Set counter advanced 22 → 27, confirming 5 sets were logged.
5. Bracketed the cascade with `PERSIST_TRACE_MARK` logcat markers and counted
   `persist/*` actions in the window. redux-logger output was kept on as an
   independent cross-check of the full action stream.

Evidence: `checks/persist-trace-extract.log`, `checks/logcat-full.log`,
`screenshots/03-live-training-after-cascade.png`.

## Measured counts

### Clean master — this run (R5CN30HWZFN, debug build of `f98f3715`)

| phase                 | REHYDRATE | PERSIST | PAUSE | FLUSH |
|-----------------------|-----------|---------|-------|-------|
| **app boot**          | 1         | 1       | 0     | 0     |
| **per 5-set cascade** | **0**     | **0**   | **0** | **0** |

The only two `[PERSIST_TRACE]` lines in the entire session:

```
[PERSIST_TRACE] #1 persist/PERSIST   @ 1778751330706   (boot)
[PERSIST_TRACE] #2 persist/REHYDRATE @ 1778751330773   (boot)
```

During the cascade the action stream was, per set, exactly:
`START_REST_TIMER` + `ADD_OR_UPDATE_SET_IN_WORKOUT` — and **nothing from the
`persist/` namespace**. 5 submits → 5 + 5 hot actions, 0 persist actions.

### PERF-COVERAGE — instrumentation stack (`coverage-dispatch-1948.csv`)

| phase                 | REHYDRATE | PERSIST | PAUSE | FLUSH |
|-----------------------|-----------|---------|-------|-------|
| **per 5-set cascade** | **11**    | **10**  | **10**| **1** |

## Root cause of the artefact

All four `persist/*` rows in the PERF-COVERAGE CSV are produced by the GH-270
hot-action-skip layer, **not** by redux-persist reacting to set submits:

### `PAUSE` (10) and `PERSIST` (10) — `persistor.pause()` / `persistor.persist()`

`skipPersistOnHotActions.ts` wraps every hot action:

```ts
if (HOT_ACTION_TYPES.has(type)) {        // includes BOTH
  a.persistor.pause();                   // → dispatches persist/PAUSE
  try { return next(action); }
  finally { a.persistor.persist(); }     // → dispatches persist/PERSIST
}
```

`HOT_ACTION_TYPES` contains **both** `ADD_OR_UPDATE_SET_IN_WORKOUT` *and*
`START_REST_TIMER`. Each set submit dispatches both → 2 pause + 2 persist per
submit → **10 PAUSE + 10 PERSIST for 5 submits**. Exactly the CSV counts.

### `REHYDRATE` (11) and `FLUSH` (1) — the synthetic "lastState resync"

`flushHotActionState()` in the same file deliberately fabricates a
`persist/REHYDRATE`:

```ts
store.dispatch({ type: 'persist/REHYDRATE', payload: undefined,
                 err: undefined, key: persistKey } as any);
…
return persistor.flush();                // → dispatches persist/FLUSH
```

This is the *only* `dispatch('persist/REHYDRATE')` in the whole codebase
(verified with `git grep` across `master` and the perf branch — redux-persist
itself only emits REHYDRATE once, from `persistStore()` at boot). `FLUSH = 1`
confirms `flushHotActionState()` ran at least once during the coverage window.

`flushHotActionState()` is invoked from three perf-branch wirings — all absent
on master:

1. `skipPersistOnHotActions`'s `FLUSH_ON_ACTION_TYPES` branch on `FINALIZE_WORKOUT`.
2. `configureStore.ts` (perf branch): `AppState.addEventListener('change', …)`
   → `flushHotActionState()` on every `active → background/inactive` transition.
   The PERF-COVERAGE run drove the cascade through the `LiveCascadeOverlay`
   (R5 overlay) + `dumpPerfCsv`, plus dev-menu / Alert / screencap activity —
   each of which can briefly toggle `AppState`, and each toggle fires another
   synthetic REHYDRATE.
3. `configureStore.ts` (perf branch): `setInterval(flushHotActionState, 30_000)`.

The REHYDRATE rows in the CSV additionally arrive in **pairs** (timestamps
482162×2, 486148×2, 490285×2, 494209×2, then 3 singles). Each synthetic
REHYDRATE is re-observed by *both* `perfMiddleware` and `paintGapMiddleware`,
and `perfRecorder.noteAction()` counts `persist/REHYDRATE` into `tickHardSet`
(the CSV `hardset_count` proxy) — i.e. the measurement layer is also
double-counting its own injected action. So "11" is `flushHotActionState()`
firings amplified by the profiling middleware chain; the exact multiplier is a
property of the instrumentation, not of the app.

### Conclusion on the PERF zahlen

Because `persist/PAUSE`, `persist/PERSIST`, `persist/REHYDRATE` and
`persist/FLUSH` in the coverage CSV are **100 % generated by the GH-270
instrumentation itself**, every `persist/*` row in the GH-253 → GH-275 /
PERF-COVERAGE CSVs is measurement self-noise. The shipped app does **zero**
persist-action dispatching during a set cascade — its persist cost lives
entirely in redux-persist's debounced `setItem` write path, which the
`persist/*` action rows do not represent at all. Any perf conclusion drawn
from those action rows (e.g. "REHYDRATE costs 608 ms × 11") is invalid.

## Secondary risk worth noting

`skipPersistOnHotActions.ts` dispatches a *real* `persist/REHYDRATE` action
into the live store. Any reducer or effect keyed on REHYDRATE will run on
every safe-point flush, not just at boot. `TrainingsPlanNode.tsx:75` already
carries a comment "exercises arrive after Redux REHYDRATE — re-initialize if
still unset"; a synthetic REHYDRATE mid-workout could re-trigger that kind of
boot-only logic. This is a correctness smell in GH-270 (still unmerged), not a
master bug — but it is the strongest argument for the follow-up below.

## Follow-up ticket proposal (ONE)

**`GH-280` — GH-270: replace the synthetic `persist/REHYDRATE` resync in
`skipPersistOnHotActions` with a non-action-dispatching flush**

> The GH-270 hot-action-skip layer flushes accumulated hot-action state by
> `store.dispatch({type: 'persist/REHYDRATE'})` to force
> `persistReducer → conditionalUpdate → _persistoid.update()`. This (a) pollutes
> every perf-coverage CSV with 10–11 phantom `persist/*` rows per cascade —
> shown by GH-279 to be 0 on master — and (b) injects a real REHYDRATE action
> into the running store, risking re-fire of boot-only REHYDRATE-keyed logic
> (e.g. `TrainingsPlanNode`). Before GH-270 merges: drive the persistoid resync
> without a fake action — e.g. call `persistor.persist()` then a targeted
> `_persistoid.update(store.getState())`, or restructure so the flush path
> doesn't masquerade as REHYDRATE. Re-run the perf-coverage measurement
> afterwards and re-baseline the GH-253…GH-275 persist numbers, which are
> currently contaminated.

## Artefacts

Committed alongside this report:

| file | what it shows |
|------|---------------|
| `docs/perf/investigation/rehydrate-storm-trace.log` | all `[PERSIST_TRACE]` lines + per-cascade & boot counts (clean master) |
| `docs/perf/investigation/coverage-dispatch-1948.csv` | reference copy of the PERF-COVERAGE run that recorded the 11× storm |
| `app/redux/middleware/persistActionTrace.ts` | the dev-gated trace middleware used for this measurement |
| `screenshots/GH-279/01-training-home.png` | Training home, baseline data loaded ("Push pull" plan) |
| `screenshots/GH-279/03-live-training-after-cascade.png` | live training screen after the 5-set cascade (Set 22 → Set 27) |

Run-only (not committed — in the orchestrator run dir `.codex-orchestrator/runs/GH-279/`):
`checks/logcat-full.log` (full device logcat: boot trace, redux-logger action
stream, cascade markers).
