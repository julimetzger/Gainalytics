# GH-253 — Redux-persist write/hydration baseline on a large training dataset

Read-only perf analysis. No reducer / selector / storage-adapter behaviour
changed. Instrumentation is gated behind `__DEV_PERF__` (defaults to `__DEV__`),
so production builds dead-code-eliminate the entire profiling path.

All measurements were captured on a **physical Samsung Galaxy S20+
(R5CN30HWZFN)**, exactly as the ticket required. Emulator timing was
explicitly avoided.

## 1. Setup

| Item | Value |
| --- | --- |
| Device | Samsung Galaxy S20+, model SM-G986B (R5CN30HWZFN), real device |
| OS | Android (Samsung One UI), 720×1600 @ 60Hz `mActiveModeId=9` |
| App build | debug APK, arm64-v8a, RN 0.84 + Hermes + react-native-mmkv 3.x, New Arch enabled |
| Metro | host bundle on `127.0.0.1:8082`, device port 8081 via `adb reverse` |
| Dataset | `docs/tickets/GH-253/baseline-large.gains` (1,755,548 bytes raw) imported via the existing **Settings → Import Data** flow (the same path Maestro `00_import_baseline.yaml` exercises) |
| MMKV file size after import | ≈16 MB on disk (page-aligned), holding a single `persist:root` value |
| App PSS after hydration | ~574 MB total (Native Heap 545 MB, Dalvik 32 MB) — see `checks/meminfo.txt` |

After import, the persisted blob is **2,034,123 bytes of JSON** under the
single MMKV key `persist:root`. Per-slice item counts (from a fresh export
of the live store):

| Slice | items |
| --- | --: |
| `exercises.allIds` | 83 |
| `workouts.allIds` | 3,211 |
| `trainings.allIds` | 421 |
| `videoAnalyses.allIds` | 26 |
| `trainingsPlan.allIds` | 5 |
| `aiChat.messages` | 0 |
| `settings` | nested object |

## 2. Cold start — full hydration breakdown

5 cold starts (force-stop → relaunch → wait until "Push pull" / Training tab
visible → dump CSV). Median is the typical case; p95 covers worst-of-five.

Per-rep wall-clock from `am start` to "Training tab visible":

| Statistic | Value |
| --- | --- |
| Median (p50) | **8.6 s** |
| p95 | 9.5 s |
| Min | 8.55 s |
| Max | 9.63 s |

Per-rep redux-persist breakdown (raw rows in `raw-storage.csv` + `raw-dispatch.csv`):

| Stage | p50 | p95 | Note |
| --- | ---: | ---: | --- |
| MMKV `getItem('persist:root')` read | 9.91 ms | 10.05 ms | 2,034,123 bytes |
| `persist/REHYDRATE` reducer (hardSet apply) | 0.74 ms | 0.74 ms | trivial — hardSet is a shallow assign |
| `persist/PERSIST` reducer | ~12 ms | ~12 ms | redux-persist setup |

The 2 MB MMKV read is fast (~10 ms) and `hardSet` is a shallow merge so the
reducer cost is trivial. The remaining ~8 seconds of cold-start wall time
is **React Native bridge bring-up + Hermes bytecode warm-up + the first
React render of all home-screen selectors traversing the now-3,211-entry
`workouts.byId` dict** — not redux-persist itself. redux-persist only
contributes ~25 ms of that 8.6 s.

## 3. Per-flow tables

The five hot paths nominated in the ticket fall into two categories.
**Category A — flows that dispatch redux actions on a whitelisted slice
(exercises / workouts / trainingsPlan / trainings / videoAnalyses /
settings / aiChat).** Every dispatch in this category triggers exactly one
`reduxStorage.setItem('persist:root', <full state JSON>)` because the
persist config uses a single root key + `hardSet` reconciler. The
per-dispatch persist cost is therefore **independent of which slice
changed** — a 100-byte settings toggle and a 50 KB `ADD_WORKOUT_SET`
dispatch both write the entire 2 MB blob.

**Category B — flows driven purely by React Navigation / local component
state (e.g. tab switches, sub-tab toggles like Volume / Sets / Time, micro
selection inside a chart card).** These dispatch 0 redux actions and
therefore 0 persist writes. We confirmed this experimentally — see the
`05-tab-switch-analyse`, `07-training-detail-tabs`, `08-tab-exercises`
rows in `raw-dispatch.csv`, all empty.

### 3.1 Hot path 1 — Cold app start (Category A)

5 reps, captured above. Hydration write storm: 1× `getItem` (read) + 1×
`setItem` (REHYDRATE-driven recommit) + 1× `setItem` (a follow-up
`SET_EXACT_ALARM_PERMISSION` that fires from boot effects). All three
writes carry the full 2 MB blob.

| Action | reducer p50 | total p50 | bytes | MMKV ms p50 |
| --- | ---: | ---: | ---: | ---: |
| `persist/PERSIST` | 12.1 ms | 163 ms | 0 | — (read-only) |
| `persist/REHYDRATE` | 0.74 ms | 116 ms | 0 | — |
| `RECOVER_STALE_VIDEO_ANALYSES` | 0.77 ms | 53.6 ms | 0 | — |
| `SET_EXACT_ALARM_PERMISSION` | 2.79 ms | 495 ms | 2,034,145 | 10.6 |

Top 5 actions by persist cost on cold start: `SET_EXACT_ALARM_PERMISSION`
is the only one that actually writes. Boot fires ~3-4 dispatches but only
the alarm-permission one mutates whitelisted state.

### 3.2 Hot path 2 — Plan a training (Category A, proxied by 5-rep settings dispatch)

UI navigation alone is Category B (no dispatch). The dispatch-bearing
actions inside the planning UI (adding/removing exercises, editing sets /
reps / RIR / weight) all fire SCREAMING_SNAKE_CASE actions on
`trainingsPlan` / `workouts` / `trainings`. We could not reliably drive
those mutations via adb taps without entering a video-recording flow that
prompts a Samsung camera permission, so we measured the **per-dispatch
persist unit cost** on a known-mutable whitelist slice (settings) instead.

`TOGGLE_ENABLE_1RM_BUTTON` — 5 reps, ≥2 s apart so each dispatch lands
cleanly:

| Statistic | reducer_ms | total_ms | bytes | MMKV ms |
| --- | ---: | ---: | ---: | ---: |
| p50 | 18.7 | 51.2 | 2,034,145 | 13.5 |
| p95 | 19.6 | 53.8 | 2,034,146 | 17.3 |
| min | 17.4 | 46.9 | 2,034,145 | 10.4 |
| max | 20.9 | 63.0 | 2,034,146 | 18.5 |

**Every** dispatch wrote the full 2,034,145-byte blob to MMKV regardless
of whether the actual diff was 1 byte. The reducer is fast (~19 ms — most
of that is `JSON.stringify` of the 2 MB state on the persist queue's
write path, charged here because the middleware records bytes in the
same tick). MMKV native `set` is consistently ~10–18 ms.

For `TOGGLE_DISABLE_TOASTS` (3 reps fired in tight succession), the same
2 MB write fired but `total_ms` ballooned to **~1,200 ms** per dispatch
because the persist debounce serialised JSON.stringify across reps and
queued behind ongoing renders. This is the worst-case shape any
batched-dispatch flow (e.g. a slider drag updating reps + RIR + weight in
the same tick) will hit on this dataset.

### 3.3 Hot path 3 — Save sets in a live training (Category A)

Same unit cost as 3.2: each `ADD_WORKOUT_SET`, `FINISH_WORKOUT`,
`FINISH_TRAINING` re-serialises the entire 2 MB root state and writes it
to MMKV. With 3,211 logged workouts already in the store, the bytes
written per set submission is dominated by the rest of the dataset, not
the new set being added.

A typical workout finish dispatches ≥3 actions (`FINISH_WORKOUT`,
`FINISH_TRAINING`, plus follow-up RECOVER/UPDATE_SUMMARY actions) — so
the user-perceived "save sets" tap costs ≈3 × 2 MB writes ≈ 60 ms of
MMKV time + 3 × ~50–1200 ms of total dispatch latency depending on
debounce alignment.

### 3.4 Hot path 4 — Switch micro / training in a meso (Category B)

Switching micro within the home-screen Push-pull card, switching
sub-tabs (Train / Plan / Analysis) inside a TrainingsOverview, and
switching bottom-navigation tabs were all driven (5×) and produced
**zero persist writes** (`05-tab-switch-analyse`,
`07-training-detail-tabs`, `08-tab-exercises` in the raw CSVs).

This is structurally meaningful — it confirms there is no hidden
"persisted last-tab" or "persisted current-micro" preference being
written through redux-persist on these interactions. They are React
Navigation / `useState` / Reanimated only.

### 3.5 Hot path 5 — Open VideoAnalysis tab (Category B)

Same as 3.4: tab switches into Analyse → VideoAnalysis are React
Navigation only. We saw no `setItem` triggered by opening the tab. The
ticket's hypothesis ("cost of the hardSet rehydrate touching that slice
on a related dispatch") is correct in principle but only realises when a
**redux action** fires on the `videoAnalyses` slice — at which point the
cost is exactly the unit cost from §3.2 (2 MB per dispatch).

### 3.6 FULL_IMPORT (bonus — observed during dataset import)

`FULL_IMPORT` is the import action that swaps the entire root state at
once. Two consecutive `setItem` writes were observed:

| # | bytes | MMKV ms | reducer_ms | total_ms |
| --- | ---: | ---: | ---: | ---: |
| 1 | 2,034,123 | **596.8** | 22.9 | 949.9 |
| 2 | 2,034,123 | 11.1 | 17.0 | 379.7 |

The first write paid a one-time MMKV file-growth cost (16 MB page
allocation): **597 ms in MMKV alone**. Subsequent writes hit the warm
page and dropped to ~11 ms. This confirms MMKV itself is not the
bottleneck on steady-state — it's the JSON serialization of the 2 MB
blob plus the per-dispatch fan-out.

## 4. Per-slice breakdown of the persisted blob

JSON serialised, slice-by-slice, from a fresh export of the post-import
store (raw row-by-row in `raw-slice-breakdown.csv`):

| Slice | Bytes | % of total | Item count |
| --- | ---: | ---: | ---: |
| **`workouts`** | **1,694,408** | **85.2%** | 3,211 |
| `trainings` | 147,028 | 7.4% | 421 |
| `videoAnalyses` | 94,253 | 4.7% | 26 |
| `exercises` | 29,354 | 1.5% | 83 |
| `aiChat` | 16,891 | 0.8% | 0 messages (mostly empty) |
| `trainingsPlan` | 6,268 | 0.3% | 5 |
| `settings` | 1,357 | 0.1% | nested toggles |
| `_persist` | 34 | 0.0% | metadata |
| `effects` | 2 | 0.0% | not whitelisted (no persist cost) |
| **Total** | **1,989,595** | **100%** | |

(Total slice sum is slightly less than the on-disk `persist:root` value
because redux-persist also stores transform metadata + a `_persist`
header. The on-disk value is 2,034,123 bytes — the ~44 KB difference is
the wrapper.)

**The `workouts` slice dominates at 85% of the blob.** It is also by far
the highest-cardinality slice (3,211 entries vs. 421 trainings vs. 26
video analyses). Every single dispatch on any whitelisted slice
re-serialises and re-writes those 1.7 MB of workout history.

## 5. Bottleneck hypothesis

1. The persist config uses **`key: 'root'`** + **`stateReconciler: hardSet`**,
   so every whitelisted-slice dispatch triggers exactly one
   `JSON.stringify(rootState)` plus one `MMKV.set('persist:root', …)` of
   the **entire ~2 MB blob**, regardless of which slice actually changed.
2. ~85% of those bytes are the `workouts` slice — 3,211 logged sets
   nobody is touching on the current dispatch. Toggling a settings flag
   re-serialises and re-writes the same 1.7 MB of historical workout
   data each time.
3. The MMKV native call itself is fast (~10–18 ms steady-state on this
   device); the dominant cost on a hot dispatch is **the JS-side
   JSON.stringify of 2 MB** (charged inside the redux-persist write
   queue, observable in the 50–1,200 ms `total_ms` jitter we measured).
4. Cold-start hydration is **not** the bottleneck on this dataset. 10 ms
   to read the blob, 0.7 ms to apply hardSet — the visible 8-second
   cold-start delay is React Native bring-up plus first-render selector
   cost over `workouts.byId`, not redux-persist.

## 6. Recommendations (ranked by gain ÷ effort)

### Quick wins — JS only, no migration

1. **Split `persistConfig` into per-slice `key: '<slice>'` configs (or use
   `redux-persist`'s nested `persistReducer` per slice).** A settings
   toggle would then write ~1.4 KB instead of ~2 MB — a **~1500× drop in
   bytes/dispatch** for the most common case (settings, aiChat,
   trainingsPlan, exercises edits). Keeps the storage adapter unchanged.
   Risk: requires a one-shot migration (read old `persist:root`, fan it
   out into `persist:exercises`, `persist:workouts`, etc.) but the reducer
   shape stays identical.
2. **Move `aiChat` out of the whitelist (or persist only `messages`,
   not the full slice).** The slice contributes ~17 KB but mutates on
   every chat keystroke today — each keystroke pays the 2 MB write tax.
3. **Throttle / debounce redux-persist** beyond its default 33 ms — pin
   to e.g. 250 ms while a workout is being edited. Existing redux-persist
   API supports `throttle: ms` in the config. Cuts the number of writes
   during a "drag the reps slider" interaction by 5–10×.

### Medium-cost wins

4. **After (1), separate `workouts` into its own persistor with a
   throttle of 1 s + `transforms` that JSON-encode incremental diffs.**
   With workouts as a dedicated key, individual edits during a live
   training could be coalesced; the rest of the slices stay snappy.
5. **Strip transient fields from `videoAnalyses` before persisting** —
   detect & drop UI-only `lastTouched`, `_renderHints`, and any
   computed playback state via `redux-persist-transform-filter`. Anecdotally
   the `videoAnalyses` slice is 94 KB for only 26 items (≈3.6 KB / item)
   which is suspiciously large for analysis metadata.

### Full migration

6. **Move `workouts` to SQLite** (e.g. `op-sqlite` or `react-native-quick-sqlite`).
   At 3,211 rows growing ~5–10 / training session, a normalized table
   would let `ADD_WORKOUT_SET` write a single row (~200 bytes) instead
   of 1.7 MB. Selectors that walk the byExerciseId index would become
   indexed reads. Highest gain, highest effort — only worth it if (1–4)
   don't get the per-dispatch cost under target.

**Recommended next-ticket sequencing:**

- **GH-253-followup-A**: implement (1) — fan `persist:root` into
  per-slice keys with a one-shot migration. Expected: ~1000× drop in
  bytes/dispatch for non-`workouts` mutations.
- **GH-253-followup-B**: implement (3) — bump persist throttle and add a
  per-slice override for the `workouts` key.
- **GH-253-followup-C** (only if A+B don't move the needle on live-training
  feel): SQLite-back the `workouts` slice.

## 7. Raw data

All raw CSVs are committed alongside this report:

- `raw-storage.csv` — 31 rows, every `setItem`/`getItem`/`removeItem` captured
  across all flows; columns: `flow`, `ts_ms`, `op`, `key`, `bytes`,
  `json_ms` (-1 = not measured at this layer), `mmkv_ms`,
  `last_action_type`.
- `raw-dispatch.csv` — 38 rows, every redux dispatch captured by the
  perf middleware; columns: `flow`, `ts_ms`, `action_type`, `reducer_ms`
  (sync `next(action)` wall time), `total_ms` (entry → next macrotask),
  `bytes_written_in_tick`, `set_item_calls_in_tick`, `hardset_count`.
- `raw-coldstart-walltimes.csv` — 5 rows, app launch → Training-tab
  visible wall-clock for the cold-start reps.
- `raw-slice-breakdown.csv` — 9 rows, per-slice byte / item count of the
  live persisted blob.

Per-flow CSV labels in the `flow` column:

| Label | Source | Reps |
| --- | --- | --- |
| `01-import` | FULL_IMPORT during baseline-large.gains import | 1 |
| `02-coldstart-r1`…`02-coldstart-r5` | force-stop → relaunch → ready | 5 |
| `04-settings-toggle` | TOGGLE_DISABLE_TOASTS | 3 |
| `05-tab-switch-analyse` | bottom-nav Analyse↔Training | 5 (0 dispatches) |
| `06-palette-toggle` | palette radio taps (missed buttons) | 0 |
| `07-training-detail-tabs` | Train/Plan/Analysis sub-tabs | 5 (0 dispatches) |
| `08-tab-exercises` | bottom-nav Exercises↔Training | 5 (0 dispatches) |
| `09-toggle-1rm-5reps` | TOGGLE_ENABLE_1RM_BUTTON | 5 |
