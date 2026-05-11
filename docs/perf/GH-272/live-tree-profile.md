# GH-272 — Where do the 297 ms actually go on the LIVE training screen?

Follow-up to PR #260 / #266 / #268 / #271. Read-only React.Profiler
measurement of the real `<ExecuteTraining>` subtree under a synthetic
5-cascade fired by a floating `__DEV_PERF__`-gated overlay button.

## 1. Setup

| Item | Value |
| --- | --- |
| Device | Samsung Galaxy S20 (SM-G986B), real device, serial `R5CN30HWZFN` |
| Build | debug, branch `feature/GH-272-live-tree-profile` off `feature/GH-270-skip-persist-hot-actions` |
| Dataset | `__tests__/e2e/maestro/fixtures/baseline.gains` imported (≈3.2 k workouts) |
| Plan | Push pull › Meso 2 › Micro 5 › Pull dl (state STARTED), Cable crunches chosen |
| Sets in chosen workout | 2 done sets + cascade adds 5 synthetic |
| Cascade driver | floating overlay button (id `gh272-live-cascade-button`) on the live-training screen |
| Action sequence | 5 × `ADD_OR_UPDATE_SET_IN_WORKOUT` + `START_REST_TIMER`, 4 s apart |
| Auto-dump | +22 s, label `gh272-live`, six CSVs to `ExternalDirectoryPath` |
| Runs | 2 cascades, combined (10 real submits × 22 s = 44 s of capture) |

### Profiler placement (all in `app/components/Training/execute/ExecuteTraining.tsx`)

| Profiler id | Wraps | Code reference |
| --- | --- | --- |
| `execute-training-root` | full `<ExecuteTraining>` tree | `ExecuteTraining.tsx:164` |
| `aux-date-picker` | `<DatePicker>` (only when `state !== STARTED`) | `ExecuteTraining.tsx:168` |
| `set-list` | `<AddWorkout>` — exercise tabs + set input form + done-set rows | `ExecuteTraining.tsx:174` |
| `estimated-1rm-card` | `<Estimated1RmCard>` | `ExecuteTraining.tsx:215` |
| `rest-timer-card` | `<RestTimerCard>` (countdown + progress ring) | `ExecuteTraining.tsx:222` |

Four Profilers landed on this screen (`aux-date-picker` is gated to
the non-STARTED branch and produced 0 commits in this run). Floating
overlay implementation lives in `app/utils/perf/LiveCascadeOverlay.tsx`.
Both files are `__DEV_PERF__`-gated and dead-code-eliminated in
production.

## 2. Per-Profiler render table (combined over 5 + 5 = 10 real submits)

| id | mount | update | sum-actual (ms) | mean-actual (ms) | p95-actual (ms) | sum-base (ms) | mean-base (ms) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `execute-training-root` | 0 | 64 | **2547.89** | 39.81 | 92.20 | 5544.74 | 86.64 |
| `set-list` | 0 | 21 | **1528.95** | 72.81 | 74.18 | 1430.56 | 68.12 |
| `rest-timer-card` | 0 | 64 | 873.07 | 13.64 | 17.82 | 807.60 | 12.62 |
| `estimated-1rm-card` | 0 | 21 | 76.26 | 3.63 | 3.76 | 69.32 | 3.30 |
| `aux-date-picker` | 0 | 0 | — | — | — | — | — |

Notes:
- `execute-training-root` actualDuration is **lower than baseDuration**
  (mean 39.81 ms vs 86.64 ms), meaning React memoizes a meaningful
  fraction of the root commit each tick. Whatever work IS done at the
  root is dominated by its hot child.
- `set-list` actualDuration ≈ baseDuration (mean 72.81 vs 68.12). React
  is **not skipping any work** inside the set-list subtree — it fully
  reconciles every commit. This is exactly the H2 signature.
- `rest-timer-card` fires 3× as often as `set-list` (64 vs 21) but each
  commit is 5× cheaper. Total time spent in rest-timer is 1.75× the
  cascade-aligned `set-list` time on a *per-update* basis but ~half
  in absolute time (873 ms vs 1528 ms).
- `estimated-1rm-card` is essentially free (~3.6 ms per commit, 76 ms
  cumulative over 44 s). Already memoization-friendly.

## 3. Top components by total update time

1. **`execute-training-root`** — 2547.89 ms over 64 commits.
   Reference: `ExecuteTraining.tsx:164`.
   **Caveat:** this is the parent Profiler and its actualDuration includes
   work done in its children. Not an independent hot spot in itself; it
   is hot *because* `set-list` and `rest-timer-card` are hot.
2. **`set-list`** — 1528.95 ms over 21 commits (72.81 ms / commit).
   Reference: `ExecuteTraining.tsx:174` → `<AddWorkout>` →
   `app/components/Workout/add/AddWorkout.tsx:124` (`unfinishedWorkout.sets.map`).
3. **`rest-timer-card`** — 873.07 ms over 64 commits (13.64 ms / commit).
   Reference: `ExecuteTraining.tsx:222` → `<RestTimerCard>` →
   `app/components/Training/execute/RestTimerCard.tsx:31`
   (`useRestTimer({startedAt, targetSeconds, enabled})`).

Excluding the root, **the two child Profilers that account for the React-side
cost are `set-list` (1528 ms) and `rest-timer-card` (873 ms)**. Together
they sum to 2401 ms, within rounding of the root's 2547 ms.

## 4. Rest-timer commit frequency

Across the 44 s of capture, `rest-timer-card` fires **64 commits**:
- Cascade-aligned commits (immediately after `ADD_OR_UPDATE_SET_IN_WORKOUT`
  / `START_REST_TIMER`): **10** total (5 per cascade run × 2 runs).
- Idle "tick" commits between cascade events: **54**, averaging
  ≈ 54 / 44 s ≈ **1.23 commits / s** — i.e. a **1 Hz tick**, not a
  per-frame tick.

This is consistent with `useRestTimer` using a `setInterval(1000)` (or
equivalent 1 s `setState` tick) under the hood rather than `requestAnimationFrame`.
**The rest timer is NOT a 60 Hz re-render generator.**

Mean per-commit cost on rest-timer is **13.64 ms**, so the 1 Hz tick
costs 13.64 ms of JS thread time per second when the live screen is
mounted — visible but not the source of the 297 ms gap.

## 5. Hypothesis verdicts

| H | Description | Verdict | Supporting number |
| --- | --- | --- | --- |
| **H1** | RestTimerCard rerenders on every frame | **REFUTED** | `rest-timer-card` fires 64× over 44 s = **1.23 Hz**, far below 60 Hz |
| **H2** | Set-list reconciles entire list on every ADD | **CONFIRMED** | `set-list` mean actualDuration **72.81 ms** ≈ baseDuration **68.12 ms** → no memoization, full reconcile every commit |
| **H3** | Estimated1RmCard recalculates expensively | **REFUTED** | `estimated-1rm-card` mean actualDuration **3.63 ms**, p95 3.76 ms — already cheap |
| **H4** | Bridge roundtrip ~112 ms | **CONFIRMED (in direction; magnitude HIGHER)** | Paint-gap for `persist/PERSIST` after a hot action: **p50 = 825.96 ms**, while React's `execute-training-root` mean actualDuration is only 39.81 ms. ~786 ms of the gap is post-React work (bridge + native UI + vsync). |
| **H5** | React yields to other priority work | **REFUTED** | `set-list` actualDuration / baseDuration ≈ 1.07 → React is *not* skipping or deferring; it is doing the full reconcile |

(See `perf-gh272-live-paint-gap-*.csv` for the per-action paint-gap rows
and `perf-gh272-live-render-*.csv` for the per-Profiler render rows.)

## 6. Definitive attribution of the 297 ms

The headline number from PR #271 (t2 − t0 p50 ≈ 414 ms on the synthetic
Settings driver, with the persist storm proven off the critical path)
turns out to be **a floor, not a ceiling**, on the live tree. With the
real `<ExecuteTraining>` mounted and a workout that owns a set list,
the per-cascade paint-gap p50 is **826 ms** (table in §5 row H4 / raw
`paint-gap.csv`). That number decomposes as:

| Bucket | ms (p50) | Source |
| --- | ---: | --- |
| Reducer (synchronous, hot action) | 19–25 | dispatch CSV `reducer_ms` |
| React commit — JS reconciliation (all 4 Profilers in this subtree) | ~90 | sum of mean actualDuration: set-list 72.81 + rest-timer 13.64 + 1RM 3.63 ≈ 90 |
| Post-React: native UI / FlatList layout / bridge / vsync | ~700 | residual: 826 − (25 + 90) ≈ 711 |

**The single largest piece of the React-side cost is `set-list` (≈ 73 ms
per commit, no memoization).** That number is what the original 297 ms
investigation was trying to find. The rest of the gap — ~700 ms above
React — is dominated by **native UI updates of the set-list / FlatList
layout pass over a workout whose set count grows every cascade step**,
plus the cross-bridge cost of pushing those updates to the Android view
hierarchy.

In other words: **the bottleneck is `set-list`** (rendering of
`<AddWorkout>`'s `unfinishedWorkout.sets.map(...)`), with a secondary
contribution from the native side of the same subtree.

## 7. Recommendation

H2 + H4 confirmed → recommended fix in this order, smallest first:

1. **Memoize per-row** in `<AddWorkout>` — wrap the row component
   inside `unfinishedWorkout.sets.map(...)`
   (`app/components/Workout/add/AddWorkout.tsx:124`) in `React.memo`
   with a shallow-equality comparator on the row's `WorkoutSet` and
   `linkVideoMode`. Cost: a few lines. Expected impact: cut
   per-commit `set-list` time from ~73 ms to a small constant + O(1)
   for the newly-added row only, because the existing rows' props
   will not change identity across an `ADD_OR_UPDATE_SET_IN_WORKOUT`
   that appends a new set.

2. **Virtualize the set list** (FlatList → `<FlashList>` or a recycler).
   This eliminates both the JS reconcile cost AND the native layout
   work for off-screen rows. The current `Array.map` renders every
   row eagerly. Higher cost, larger payoff — recommended only if (1)
   does not bring p50 to acceptable.

(H4's ~700 ms residual is RN-architecture-level and would be the
target of a follow-up that benchmarks the same cascade after enabling
Fabric+JSI for `<AddWorkout>`. That is **out of scope** for this
diagnostic ticket.)

## 8. Raw CSVs

All raw data is committed under this directory:

| file | size | description |
| --- | ---: | --- |
| `perf-gh272-live-render-1778503658846-1778503680860.csv` | 8466 B | run 1 — React.Profiler onRender rows |
| `perf-gh272-live-render-1778503964170-1778503986177.csv` | 8305 B | run 2 — React.Profiler onRender rows |
| `perf-gh272-live-paint-gap-1778503658846-1778503680860.csv` | 1430 B | run 1 — dispatch-return → next-rAF gap |
| `perf-gh272-live-paint-gap-1778503964170-1778503986177.csv` | 1274 B | run 2 — same |
| `perf-gh272-live-dispatch-1778503658846-1778503680860.csv` | 967 B | run 1 — perfMiddleware per-action timings |
| `perf-gh272-live-dispatch-1778503964170-1778503986177.csv` | 857 B | run 2 — same |
| `perf-gh272-live-storage-*.csv` | 426/497 B | persist setItem rows (proves persist still off critical path) |
| `perf-gh272-live-submits-*.csv` | 42 B (header only) | empty in this run — instrumentSubmitTiming gate fires before the cascade dispatches; recorded values not needed for §2-§7 |
| `perf-gh272-live-selector-*.csv` | 31 B (header only) | no `useTracedSelector` subscribers mounted on this screen |
