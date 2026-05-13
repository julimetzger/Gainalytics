# Profiler Coverage Report — Per-Screen Render Breakdown

**Ticket:** PERF-COVERAGE  
**Branch:** perf/profiler-coverage-investigation  
**Date:** 2026-05-13

---

## 1. Method

| Field | Value |
|---|---|
| Device | R5CN30HWZFN (Samsung Galaxy S20+, override 720×1600, 60 Hz) |
| Dataset | baseline-large.gains (already in app storage from GH-275 Phase B runs) |
| Build commit | 7148d8b7 (`perf-coverage: add DevPerfProfiler wrappers around tab roots and major screens`) |
| Measurement | LiveCascadeOverlay R5 button tapped × 3 on 2026-05-13 at 23:41 CEST |
| Primary CSV | `coverage-render-1948.csv` — single-tap clean run (19:48, stamp 1778694476050-1778694498652, 22 s window) |
| Coverage CSV | `coverage-render.csv` — 3-tap verification run (23:41, stamp 1778708497010-1778708519041) |
| Samples per id | n = 11–46 update commits depending on profiler depth (see table) |

The 19:48 run is used for mean/p95/max values; it was a single R5 tap recording 5 `ADD_OR_UPDATE_SET_IN_WORKOUT + START_REST_TIMER` dispatches.  The 23:41 run (3 taps with 2 s spacing) confirms the same id coverage and is used for storage-write statistics.

---

## 2. Ranked Breakdown

Sorted by mean actual render time, update phase. All values in milliseconds.

### Update phase (component committed normally)

| id | n | mean (ms) | p95 (ms) | max (ms) |
|---|---|---|---|---|
| `app-root` | 46 | **160.68** | 721.94 | 750.05 |
| `tab-training` | 46 | **153.14** | 686.89 | 718.24 |
| `route-training-home` | 11 | **121.23** | 133.52 | 133.52 |
| `set-list` | 21 | 39.63 | 144.04 | 162.09 |
| `execute-training-root` | 21 | 37.95 | 164.56 | 183.18 |
| `rest-timer-card` | 23 | 14.89 | 22.73 | 22.97 |
| `estimated-1rm-card` | 11 | 3.55 | 3.76 | 3.76 |

### Nested-update phase (profiler received a commit from a child profiler)

| id | n | mean (ms) | p95 (ms) | max (ms) |
|---|---|---|---|---|
| `app-root` | 23 | 19.49 | 60.70 | 60.98 |
| `tab-training` | 11 | 16.83 | 36.82 | 36.82 |

### IDs absent from coverage-render.csv

`tab-exercises`, `tab-analyse`, `tab-settings`, and all `route-*` Analyse sub-screen ids (`route-dashboard`, `route-metrics`, `route-records`, `route-history`, `route-graphics`, `route-video-analysis`) produce **zero rows** during the training cascade. This is correct: those components live in inactive tabs and their selectors return unchanged state, so React never schedules a re-render for them.

**Reproduction commands** (for future re-measurement):

```bash
# awk-based means for each phase
awk -F',' 'NR>1 { sum[$2"/"$3]+=$4; cnt[$2"/"$3]++ }
     END { for(k in sum) printf "%s | %.2f | %d\n", k, sum[k]/cnt[k], cnt[k] }' \
     docs/perf/investigation/coverage-render-1948.csv | sort -t'|' -k2 -nr
```

---

## 3. Per-Screen Accounting

### Dispatch cycle costs (19:48 single-tap run, `coverage-dispatch-1948.csv`)

| action_type | n | mean total_ms | max total_ms |
|---|---|---|---|
| `persist/PERSIST` | 10 | 626 | 1 299 |
| `persist/REHYDRATE` | 11 | 608 | 777 |
| `ADD_OR_UPDATE_SET_IN_WORKOUT` | 5 | 91 | 95 |
| `persist/PAUSE` | 10 | 83 | 122 |
| `START_REST_TIMER` | 5 | 33 | 35 |

**Key observation — persist/REHYDRATE fires 11 times in a 22 s window, not only at boot.** Each occurrence carries a ~608 ms total_ms cost. This is the dominant contributor to the ~447 ms end-to-end update cycle gap observed in GH-275 Phase B.

### React render cost breakdown (update phase means, update commits only)

```
app-root           160.68 ms  ← full subtree (includes all below)
  tab-training     153.14 ms  ← Training tab + its navigation stack
    route-training-home 121.23 ms ← TrainingHome screen (mounted behind ExecuteTraining)
      execute-training-root  37.95 ms ← active workout screen
        set-list             39.63 ms ← AddWorkout component (set rows)
          rest-timer-card    14.89 ms ← rest timer overlay
          estimated-1rm-card  3.55 ms ← 1RM card
```

The React render costs on the right (37–160 ms) are **much smaller** than the dispatch.total_ms costs on the left (91–626 ms). The end-to-end update latency is dominated by redux-persist write activity, not by React rendering.

**Surprising finding — route-training-home re-renders on every set dispatch (121 ms mean):**  
`TrainingHome` is mounted in the React Navigation stack beneath `ExecuteTraining`. It re-renders on each `ADD_OR_UPDATE_SET_IN_WORKOUT` because it subscribes to workout state via its own selectors. At 121 ms mean this is the costliest single-screen render and was previously invisible (no profiler wrapper existed at that level before this ticket).

**Storage writes (23:41 run, `coverage-storage.csv`):**  
Each persist cycle writes ~2.04 MB (`persist:root`) to MMKV. MMKV call itself takes ~11 ms; the remaining ~615 ms in `persist/PERSIST` and `persist/REHYDRATE` total_ms is dominated by `JSON.stringify` of the 2 MB root object on the JS thread.

---

## 4. Top Three Highest-Cost Screens

### 1. `route-training-home` — 121.23 ms mean update

**File:** `app/tabs/trainings/TrainingHome.tsx`

TrainingHome is a screen that remains **mounted and connected** in the React Navigation stack even while `ExecuteTraining` is displayed on top. It subscribes to `notFinishedWorkouts`, `workouts.byId`, and plan/training plan slices through selectors like `useSelector(selectActivePlans)`. On every `ADD_OR_UPDATE_SET_IN_WORKOUT` dispatch, those selectors return changed data, triggering a full subtree re-render of the Training Home screen tree (child components: `MicroOverview`, `ExerciseList`, `PlanList`, etc.) — none of which are visible to the user at that moment.

### 2. `app-root` — 160.68 ms mean (total-subtree cost)

**File:** `App.tsx`

`app-root` wraps the entire React tree and reports the sum of all renders in each committed subtree. The 160 ms mean represents the total React commit cost for the app per dispatch cycle. The large p95 (722 ms) reflects commits that include persist/REHYDRATE batching, which causes multiple components to re-render simultaneously. Reducing the subtree cost of `route-training-home` would directly lower this number.

### 3. `tab-training` — 153.14 ms mean (total-subtree cost)

**File:** `app/routing/bottomNavigator.tsx`

`tab-training` wraps the Training tab's root navigator and records the same 46 commits as `app-root`. The 7 ms gap between `app-root` (160 ms) and `tab-training` (153 ms) represents the overhead of components mounted above the tab navigator (e.g., modal overlays, global providers). The `tab-training` cost is almost entirely driven by `route-training-home` (121 ms) and `execute-training-root` (38 ms).

---

## 5. Proposed Follow-up Tickets

### Ticket A — `redux-persist throttle: debounce writes to 200 ms` (S)

**Description:** Each `ADD_OR_UPDATE_SET_IN_WORKOUT` dispatch (5 per cascade) causes an immediate persist write (~626 ms) on the JS thread. Adding a 200 ms debounce to the redux-persist middleware configuration (`throttle: 200`) would coalesce the 5 writes per cascade into 1–2 writes, reducing `persist/PERSIST` events from 10 to 2–3 per cascade. JSON.stringify is called for each write, so reducing write frequency directly cuts serialize cost.  
**Expected improvement:** 4–5× reduction in `persist/PERSIST` total_ms sum per cascade; end-to-end update latency drops from ~600 ms to ~150–200 ms.  
**Complexity:** S (single config change in `app/utils/createBaseStorage.ts` or wherever persistConfig is defined; no reducer or selector changes required).

### Ticket B — `TrainingHome background-render guard` (M)

**Description:** `route-training-home` re-renders at 121 ms mean on every set dispatch even though the screen is invisible behind `ExecuteTraining`. The fix is to add a `useFocusEffect`-based render gate or to memoize the expensive selectors in `TrainingHome.tsx` so they bail out early when `ExecuteTraining` is active. Alternatively, restructure the navigation stack so `TrainingHome` is unmounted when a workout session is started (using `detachInactiveScreens` on the stack navigator or moving the workout into a modal stack).  
**Expected improvement:** Eliminates 121 ms of render cost per dispatch; reduces `tab-training` mean from 153 ms to ~32 ms and `app-root` mean from 160 ms to ~40 ms.  
**Complexity:** M (requires navigation structure analysis, likely a `React.memo` / `useMemo` refactor of selectors in TrainingHome and potentially one route stack change).

### Ticket C — `Slice-level persist allowlist` (M)

**Description:** Currently `persist:root` serializes the entire Redux state (~2.04 MB) on every whitelisted dispatch. Investigation of the state tree should identify which slices are needed for crash recovery (e.g., `workouts`, `videoAnalyses`) vs. those that can be omitted (e.g., `trainings.ui`, computed caches). Reducing the persisted payload from 2 MB to 200–400 KB would cut `JSON.stringify` time from ~615 ms to ~60–120 ms.  
**Expected improvement:** 4–5× reduction in `persist/PERSIST` and `persist/REHYDRATE` total_ms; storage write bytes drop from 2.04 MB to <400 KB per write cycle.  
**Complexity:** M (requires mapping of which slices must survive restart vs. which can be rehydrated from the workout data; must verify no regressions in crash recovery or import flows).

---

## 6. Acceptance

The highest-cost single screen is **`route-training-home`** at 121.23 ms mean, because it re-renders on every training dispatch despite being invisible behind `ExecuteTraining`. The recommended next ticket is **Ticket B** (`TrainingHome background-render guard`), which eliminates this cost at M complexity and would reduce app-root from 160 ms to ~40 ms per dispatch — a ~4× render improvement without touching reducers, middleware, or persist configuration.
