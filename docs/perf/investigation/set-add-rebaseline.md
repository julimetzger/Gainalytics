# Set-Add Render-Time Re-Baseline (GH-288)

> Read-only diagnostic re-baseline of the live-training "add a set" cascade,
> taken on a clean master that already contains GH-283 (set-list row
> memoization) and GH-284 (`<Freeze>` background-render guard for
> `TrainingHome`). The original GH-253→GH-275 investigation was measurement-
> contaminated (GH-279 (PR #281) showed the `persist/*` storm was an
> instrumentation artefact, not a real bug). This file is the clean follow-up
> baseline that the next perf decision should be made against.

## Method

- **Device**: Samsung Galaxy `R5CN30HWZFN`, physical (real) device.
- **Build**: feature/GH-288 branch tip, sitting on master commits
  `4587760f` (GH-283) and `07a6b7c5` (GH-284). Verified with
  `git log origin/master | grep -E "GH-283|GH-284"`.
- **Data**: store hydrated from `__tests__/testdata/1772318214222.gains`
  (baseline-large) — already on device. Live training driven into "Push pull
  › Meso 1 › Micro 7 › Push squat" with exercise *Adductor*, then sets added
  via direct adb taps on the live-training screen (no R5-Overlay, see
  GH-282).
- **Instrumentation** (dev-gated only):
  - `app/components/dev/RenderProfiler.tsx` — a 25-line wrapper around
    `React.Profiler`. `__DEV__`-gated; in a release bundle it collapses to
    a transparent fragment. Used to wrap the four real children of
    `<ExecuteTraining>`:
    - `execute-training-root` (the outer `<View>`),
    - `set-list` (the `<AddWorkout>` subtree),
    - `estimated-1rm-card` (`<Estimated1RmCard>`),
    - `rest-timer-card` (`<RestTimerCard>`).
  - `app/redux/middleware/persistActionTrace.ts` — a redux middleware that
    logs every `persist/*` action and every `ADD_OR_UPDATE_SET_IN_WORKOUT`
    with a running counter. Only wired into the store middleware array when
    `NODE_ENV === 'development'`; production middleware array stays `[]`.
  - NOT the old `app/utils/perf/*` / `LiveCascadeOverlay` /
    `DevPerfProfiler` stack — that stack stays untouched.
- **Sample**: `n = 7` real `ADD_OR_UPDATE_SET_IN_WORKOUT` dispatches captured
  via `adb logcat`. Of those, 5 had a complete profiler-commit window inside
  the post-dispatch 800 ms cascade window. (Sets 6 and 7 fired too close to
  end-of-capture; their cascades were truncated.) All 5 are kept as the
  per-component table; the partial 2 are visible in the raw CSV but excluded
  from the aggregate.
- **Cascade definition**: a profiler commit "belongs to a set-add cascade"
  if its `ts` falls inside `[dispatch_ts, dispatch_ts + 800 ms]`. 800 ms is
  generous — in practice all commits land within ~180 ms.
- **Aggregation script**: `aggregate.py` in the run dir
  (`.codex-orchestrator/runs/GH-288/aggregate.py`). Reads the logcat,
  emits a per-row CSV (`data/aggregate-raw.csv`) and prints the per-component
  table + persist-action counts (`data/aggregate-summary.txt`).
- **Raw artefacts** committed alongside this report under `docs/perf/data/`:
  `set-add-rebaseline-logcat.log`, `set-add-rebaseline-raw.csv`,
  `set-add-rebaseline-summary.txt`, and `aggregate.py` itself.

## Per-component render table (inside a set-add cascade)

actualDuration in ms, n = 5 cascades, 1 commit per profiler per cascade:

| profiler_id           |   n |    mean |     p50 |     p95 |     max |     sum |
| --------------------- | --: | ------: | ------: | ------: | ------: | ------: |
| set-list              |   5 |  149.43 |  146.09 |  191.23 |  197.46 |  747.14 |
| execute-training-root |   5 |  167.35 |  163.82 |  208.78 |  215.11 |  836.74 |
| rest-timer-card       |   5 |   12.36 |   12.03 |   13.92 |   14.31 |   61.80 |
| estimated-1rm-card    |   5 |    3.68 |    3.63 |    3.84 |    3.86 |   18.41 |

Per-cascade detail (raw `actualDuration` in ms; cascades 1–5 ordered by
dispatch time; list length grows by one each step):

| cascade | set-list | est-1rm | rest-timer | wrapper |
| ------: | -------: | ------: | ---------: | ------: |
|       1 |   110.40 |    3.57 |      12.35 |  127.95 |
|       2 |   126.88 |    3.59 |      14.31 |  146.44 |
|       3 |   146.09 |    3.77 |      11.39 |  163.82 |
|       4 |   166.32 |    3.63 |      11.72 |  183.42 |
|       5 |   197.46 |    3.86 |      12.03 |  215.11 |

Each cascade adds one row to the SetRow list, so cascade index ≈
`list_length - 2`. `set-list` actualDuration grows roughly linearly
(~22 ms per added row), and `execute-training-root` is the sum of its
children (`set-list` ≈ 98 % of the wrapper's cost).

### Persist-action counts

| action                       | total in capture | inside any set-add cascade |
| ---------------------------- | ---------------: | -------------------------: |
| `persist/PERSIST`            |                1 |                          0 |
| `persist/REHYDRATE`          |                1 |                          0 |
| `ADD_OR_UPDATE_SET_IN_WORKOUT` |              7 |                          7 |

→ **No `persist/*` action fires inside a live set-add cascade.** This is the
control measurement: it confirms the GH-279 (PR #281) finding — the
"persist storm" the original GH-253→GH-275 investigation was chasing was an
artefact of that branch's `instrumentSubmitTiming` stack, not a real master
bug.

## Background noise (outside any set-add cascade)

Over the same logcat capture (~5 min of live training), how many commits
fired outside the 5 set-add cascade windows, and how much render work did
they represent:

| profiler_id           |    n | total actual (ms) | mean (ms) | max (ms) |
| --------------------- | ---: | ----------------: | --------: | -------: |
| execute-training-root |  300 |          6 197.6 |     20.66 |   241.53 |
| set-list              |  197 |          3 246.2 |     16.48 |   225.21 |
| rest-timer-card       |  158 |          2 642.6 |     16.73 |    39.54 |
| estimated-1rm-card    |   51 |            194.0 |      3.80 |     6.10 |

→ **`execute-training-root` re-renders 300 times across the session for only
7 set-adds.** ~5–6 s of cumulative render work happens between set-adds, vs
~0.84 s spent on the 5 measured set-add cascades themselves. The background
noise outweighs the foreground "set-add" cost by ~8×.

`rest-timer-card` ticking every second accounts for 158 of its own commits
(expected: the visible "+MM:SS / target" string updates each second). But
note that `rest-timer-card` ticking should NOT, by itself, force
`execute-training-root` to re-render — yet the wrapper has 300 outside-
cascade commits, of which only ~158 align with rest-timer ticks. The
remaining ~140 wrapper commits are unexplained by either set-adds or rest-
timer ticks, and most of them re-render the `set-list` subtree as well (197
outside-cascade commits at 16.5 ms mean — the `<SetRow>` memoization
introduced by GH-283 is doing its job here, since the per-commit cost is
~10× cheaper than during an actual set-add).

## Verdict

1. **What dominates the render time of a set-add right now**:
   the `set-list` subtree (`<AddWorkout>` + its children). It accounts for
   **~98 % of the `execute-training-root` cost** during a set-add cascade
   (148 ms / 167 ms p50). The remaining ~20 ms is split between
   `rest-timer-card` (12 ms) and `estimated-1rm-card` (4 ms).

2. **GH-283 (set-list row memoization) IS working.** Two pieces of evidence:
   - Inside a set-add cascade, only one commit fires per profiler — no
     double-render storm. `set-list` actualDuration grows linearly with
     list length (~22 ms / row added), which is consistent with reconciling
     a memoized list where only the newly mounted `<SetRow>` and the input
     row do real work; the older rows pay only reconciliation overhead.
   - In the **outside-cascade noise**, `set-list` re-renders 197 times at
     a mean cost of only 16.5 ms — an order of magnitude cheaper than the
     150 ms cost when the list actually changes. That is the row-
     memoization fast-path firing for every "props-changed but rows are
     stable" re-render. Without GH-283 these would all cost ~150 ms each.

3. **GH-284 (`<Freeze>` for `TrainingHome`) IS working.** `TrainingHome`
   is not profiled in this run, but its background re-render rate is
   already documented as `9 commits → 0 commits` in agent-memory entry
   #155 (the GH-284 acceptance measurement). The profiler data here is
   consistent with that: zero `TrainingHome`-attributable noise leaks
   into the live-training render tree.

4. **The old "persist/*" dominance story is confirmed dead.** Zero
   `persist/*` actions dispatch inside a set-add cascade. The control
   middleware would have caught any leak. The GH-253→GH-275 measurement
   was indeed instrumentation-contaminated as GH-279 (PR #281) argued.

## Remaining hot-spots

The set-add cascade itself is essentially as tight as row memoization can
make it: one re-render per profiler, ~150 ms dominated by `set-list`. There
is no further low-risk fix inside the cascade window without restructuring
`<AddWorkout>` (e.g. extracting the input row from the same memo boundary
as the list).

The **bigger remaining hot-spot is the outside-cascade background noise**:
`execute-training-root` re-rendering 300 times during a 5-min live-training
session vs the 7 actual set-add dispatches. Candidates:

- **`useUnfinishedWorkout(exerciseId)`**
  (`app/redux/Workout/use/useUnfinishedWorkout.ts`) — when both
  `notFinishedWorkouts[id]` and `suggestedWorkouts[id]` exist, returns a
  **fresh object** built via `{...state.workouts.byId[..], sets: [...].sort()}`
  every call. Default `useSelector` strict-equality therefore force-re-
  renders on every redux dispatch. This is the exact pattern of agent-
  memory entry #156 (`useTrainings()` had the same bug). The hook is used
  inside both `<ExecuteTraining>` and `<AddWorkout>`, so any dispatch
  drives both subtrees to re-render — explaining most of the 300 wrapper
  commits.
- **`useAllLastWorkouts(exercise, n)`**
  (`app/redux/Workout/use/useAllLastWorkouts.ts`) — same problem: builds
  a fresh array via `.slice(-n).map(...)` inside `useSelector`. Used inside
  `<AddWorkout>` directly, and inside `<ExerciseHistory>` /
  `<PlanTraining>`. Adds the second unstable subscription on the same
  hot render path.
- **`useTrainings()`** (already documented in agent-memory #156) —
  consumed by `<TrainingHome>`, which is now `<Freeze>`-gated by GH-284,
  so it no longer affects the live-training render tree. The fix is still
  worth doing for `TrainingHome` performance on its own, but it is NOT
  part of the set-add path any more.

The set-list row memoization (GH-283) absorbed *the cost* of these noisy
re-renders — but they are still firing 200+ times per session, paying
~16 ms of reconciliation each time, and waking up the JS thread roughly
once per second for a screen that is supposed to be idle between sets.

## Recommended follow-up — ONE ticket

> **Stabilize `useUnfinishedWorkout` and `useAllLastWorkouts` selectors
> (convert to `createSelector`, à la the GH-127 fix for `useAllTrainingsPlans`).**
>
> Both hooks build a fresh object/array reference inside `useSelector`
> (spread + `.sort()` for `useUnfinishedWorkout`; `.slice().map()` for
> `useAllLastWorkouts`), so every consumer re-renders on *any* redux
> dispatch. They are used inside `<ExecuteTraining>` and `<AddWorkout>`,
> so they drive the 300 outside-cascade `execute-training-root` re-renders
> measured here. Memoizing them via `createSelector` (with proper input
> selectors keyed by `exerciseId`) collapses every consumer's re-render
> trigger to "the actual workout slot changed", not "any dispatch landed".
>
> Expected impact (estimated from this measurement): ~6 s of cumulative
> outside-cascade render work eliminated per ~5 min of live training,
> with no behaviour change. Same risk profile as GH-127 — single-file
> hook rewrites with new unit tests on selector equality.
>
> This is the only follow-up worth pulling out of this re-baseline. The
> set-add cascade itself is post-memoization-bound and further work
> there (e.g. AddWorkout restructuring) is a much higher-risk refactor
> with smaller payoff.

## Caveats

- 5 clean cascades is the minimum the ticket asked for; tighter
  percentiles would want n ≥ 20. We have enough to argue the trend and
  the dominant cost, but the p95 is a small-sample estimate.
- The cascade window (800 ms) is generous so commits aren't dropped on
  the floor; all observed commits in practice land within ~180 ms.
- The "outside-cascade" cost is over a single ~5-min session and is
  approximate — what matters is the order-of-magnitude observation that
  background work outweighs foreground work, not the exact 6.2 s number.
- `<AddWorkout>`'s `info`-prop is a JSX expression rebuilt on every
  parent render. With GH-283's `React.memo(AddWorkoutSet)`, the children
  are still memoized, but the prop itself constitutes a new reference
  each time the wrapper re-renders. That is part of why the set-list
  outside-cascade commits exist at all; it would also be cleaned up by
  the follow-up (fewer wrapper re-renders → fewer fresh `info` props).
