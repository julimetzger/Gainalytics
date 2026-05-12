# GH-275 — Residual `set-list` cost analysis (Phase B)

## Starting point (R4 result)

After R4's `React.memo(SetRow, areSetRowPropsEqual)` + `useCallback([])` callback
stabilization + `shallowEqual`-narrowed `useSettings` selector in
`AddWorkoutSet`, `set-list` mean `actualDuration` dropped from **72.81 ms → 35.50 ms**
(2.1× faster). The target is **< 15 ms**, so ~20 ms of unexplained cost remained.

## What still triggers `set-list` updates?

Every row in `docs/perf/GH-275/after-render.csv` for `set-list` updates carries
a `last_action_type` of `persist/PERSIST`, `persist/FLUSH`, or `persist/REHYDRATE`
— **not** `ADD_OR_UPDATE_SET_IN_WORKOUT`.

These are redux-persist housekeeping actions that fire continuously when the
LiveCascade overlay runs. They do not mutate the `workouts` slice, so set data
is unchanged on every `set-list` re-render. The R4 work guaranteed that all 11
memoized `<SetRow>` children correctly bail. The residual ~35 ms therefore comes
from work that runs even when every child bails.

## What is inside the `set-list` Profiler boundary?

`set-list` wraps the entire `<AddWorkout>` (see
`app/components/Training/execute/ExecuteTraining.tsx:174–214`), not just the
`.map(...)` block. So the ~35 ms includes everything `<AddWorkout>` does on a
re-render:

1. The five `useSelector` hooks at the top of `<AddWorkout>`:
   - `useUnfinishedWorkout(exerciseId)` — returns a freshly spread object
     `{...byId[id], sets: [...joined]}` on every call → new reference every
     dispatch → equality fails → re-render is triggered.
   - `useAllLastWorkouts(exercise, 1)` — returns a freshly built array via
     `.slice().map(...)` → new reference every dispatch → same problem.
   - `useLastFinishedWorkout(exercise)` — returns the existing `byId[id]` ref
     → stable.
   - Inline `linkedSetIndices` `useSelector` (`AddWorkout.tsx:74`) — returns a
     freshly built `.map(...).filter(...).map(...)` array → new reference every
     dispatch → re-render is triggered.
2. The unmemoized `<AddWorkoutSet>` input form at `AddWorkout.tsx:153` (the
   "new set" entry row at the top of the list). It has three `TextInput`s, a
   `ToggleButton`, a `Tooltip`, and a `Button`. Each re-render walks all of it.
3. JSX construction for the 11 `<SetRow>` children. The children themselves
   bail (R4 work), but the parent still iterates the array and produces React
   elements; the comparator runs 11 times.
4. The `linkVideoMode` block (`AddWorkout.tsx:171–195`) which is only mounted
   when the user opens link mode — false on this measurement run, so skipped.

The unmemoized input `<AddWorkoutSet>` and the unstable `linkedSetIndices`
selector are the dominant contributors. Selectors that return new references
on every dispatch force `<AddWorkout>` itself to re-render even though the
sets array has not actually changed, and the input `<AddWorkoutSet>` then runs
a full Paper render cycle on every one of those re-renders.

## Targeted fixes (Phase B')

Two surgical changes, no reducer/data-shape/selector-logic changes:

1. **Wrap `AddWorkoutSet`'s default export with `React.memo`.**
   - The input form's props from `<AddWorkout>` are already stable: `onSubmit`
     is `useCallback([])`, `oneRepMax` is a primitive derived from a stable
     `useLastFinishedWorkout` ref, `date` is a `useState` ref from
     `ExecuteTraining`, and `onLiveInputChange` is `useCallback` from
     `ExecuteTraining`. The `workoutSet` prop is `undefined` for the input
     form, which is stable.
   - Inside `<SetRow>`, `React.memo`'s outer comparator already bails before
     the inner `AddWorkoutSet` is even visited, so the new inner memo never
     hurts there. The redundant inner check costs only an `Object.is` walk
     across a few props.
   - At the one other call site (`PlanTraining.tsx:47`) the parent passes an
     inline arrow `onSubmit`, so the inner memo will fail equality every
     render — same behavior as today, no regression, just no benefit there.

2. **Add `shallowEqual` to the inline `linkedSetIndices` `useSelector` in
   `AddWorkout.tsx`.**
   - The selector body still returns a freshly built array, but with
     `shallowEqual` React-Redux compares the new array's elements pairwise
     against the previous one. Since no `videoAnalyses` rows change during the
     live cascade, the comparison short-circuits and `<AddWorkout>` skips the
     re-render entirely.
   - This is the smallest possible "tighten useSelector returns" change from
     the R5 acceptable list.

The two other unstable selectors (`useUnfinishedWorkout`, `useAllLastWorkouts`)
are shared with six other components, so changing their equality is out of
scope under the "ZERO selector changes" hard constraint. Tightening only the
inline call site keeps the surface area minimal.

## Expected effect

If `<AddWorkout>` re-renders far less often, `set-list` Profiler
`actualDuration` falls toward the cost of the eventual *real*
`ADD_OR_UPDATE_SET_IN_WORKOUT` re-render, which is exactly the case the SetRow
memo + stable callbacks were designed for.

The Phase C run measures whether this holds on the real device.
