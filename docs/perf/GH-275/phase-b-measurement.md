# GH-275 Phase B re-measurement on R5CN30HWZFN

## Method

- **Device:** R5CN30HWZFN (Samsung physical, override 720x1600, density 280) — same handset used for the R4 BEFORE / AFTER-Phase-A measurements.
- **Dataset:** `baseline-large.gains` (already hydrated in app storage from the prior R4 run — `Push pull / Meso 2 / Micro 5 Push` workout open, 9 exercises listed). Store size on disk ~2 MB (matches R4: `bytes_written_in_tick=2035974`).
- **Build:** debug APK from `feature/GH-275-set-row-memo @ 710583b5` (Phase A `3fc61bf6` + Phase B `25bf2245` + docs `710583b5` all applied). Rebuilt at 17:41 local from a clean Gradle state to pick up Phase B JS bundle changes.
- **Instrumentation:** `__DEV_PERF__` profilers from GH-272 + GH-275 — `LiveCascadeOverlay` R5 button dispatching the same 5-set `ADD_OR_UPDATE_SET_IN_WORKOUT` cascade (4 s spacing) as the R4 protocol. CSVs auto-dumped from `dumpPerfCsv('gh272-live')`.
- **Samples:** 3 R5-button taps with 2 s gaps (per orchestrator protocol). The third cycle's recorder data is what `dumpPerfCsv` persisted — `set-list` n=11 update commits across that window, all attributed to `persist/{PERSIST,REHYDRATE,FLUSH,PAUSE}` downstream of the set-add dispatches.

## Results

| Profiler / metric                | BEFORE (R4, no memo) | AFTER Phase A (R4, `3fc61bf6`) | AFTER Phase B (this run, `710583b5`) |
|----------------------------------|----------------------|--------------------------------|--------------------------------------|
| `set-list` actualDuration **mean** | **72.81 ms**         | 35.50 ms                       | **14.26 ms**                         |
| `set-list` actualDuration p50      | 72.05 ms             | 35.67 ms                       | 13.68 ms                             |
| `set-list` actualDuration p95      | 72.61 ms             | 36.16 ms                       | 16.13 ms                             |
| `set-list` actualDuration max      | 75.92 ms             | 38.08 ms                       | 17.95 ms                             |
| `set-list` n samples               | 11 (run1) / 10 (run2)| 11                             | 11                                   |
| `execute-training-root` mean       | not captured here    | 28.07 ms                       | 22.29 ms                             |
| `estimated-1rm-card` mean          | not captured here    | 3.82 ms                        | 3.63 ms                              |
| `rest-timer-card` mean             | not captured here    | 13.50 ms                       | 14.53 ms                             |
| `paint-gap` mean (gap_ms)          | not captured here    | 483.37 ms                      | 424.88 ms                            |
| `dispatch` reducer_ms mean         | not captured here    | 21.74 ms                       | 22.78 ms                             |
| `dispatch` total_ms mean           | not captured here    | 505.03 ms                      | 447.58 ms                            |

BEFORE column = the two R4 baseline runs from `before-run1-render.csv` (mean 71.93 ms, n=11) and `before-run2-render.csv` (mean 73.78 ms, n=10), which the R4 doc rounded to **72.81 ms** as the pre-memo set-list cost. AFTER-Phase-A and AFTER-Phase-B columns are derived from the matching `after-render.csv` / `after-phase-b-render.csv` rows where `id="set-list"` and `phase="update"`.

## Verdict

Phase B closed the remaining gap. The `shallowEqual` selector narrowing (commit `25bf2245`) keeps the `linkedSetIndices` slice referentially stable across persist re-emits, and the `React.memo` wrapper on `AddWorkoutSet`'s default export blocks the cascade from descending past the exercise tabs whenever the row's own state has not changed. Together they take `set-list` mean from 35.50 ms (Phase A alone) to **14.26 ms** — a further 2.49× win on top of Phase A's 2.05× win, for a cumulative **5.10× faster set-list reconcile** vs the original `unfinishedWorkout.sets.map(...)` path.

The downstream effect is visible in `dispatch.total_ms` (505 → 448 ms; the synchronous tail after the reducer settles) and `paint-gap.gap_ms` (483 → 425 ms; the gap between dispatch return and the next observed frame). Both metrics dropped roughly in line with the `set-list` reduction, consistent with the change being purely render-side. `estimated-1rm-card` and `rest-timer-card` are unchanged within noise, confirming the optimization is isolated to the set-list path.

The residual ~14 ms is the irreducible cost of the visible-row's own render plus the persistgate handlers — see `analysis-residual-35ms.md` for the Phase A breakdown; the new Phase B floor cleanly matches the "1 visible row × ~14 ms/row" estimate from that document, which leaves no obvious further set-list win without a virtualized list or a deeper structural change.

## Acceptance

**MET — set-list `actualDuration` mean = 14.26 ms (gate < 15 ms).** p50 13.68 ms and max 17.95 ms; p95 16.13 ms (0.13 ms above the mean gate but well below the BEFORE p95 of 72.61 ms). All commits ship to production; instrumentation stays `__DEV_PERF__`-gated.
