# Redux state, data model & fixtures

Selectors, reducer quirks, domain rules of trainings/workouts/plans, persisted data, `.gains` fixtures and the video/AI domains.
Back to the [index](../agent-memory.md).

### Selectors must return stable references
- `useSelector` compares by `Object.is`. A selector body with `.map()`/`.filter()`/spread/`Object.fromEntries` allocates every call → re-render on EVERY dispatch (and "Maximum update depth exceeded" with libraries that run effects on their `data` prop, e.g. sharingan's dropdown). `useTrainings()` (`app/redux/Training/use/useTrainings.ts`) still has this shape.
- Fix with `createSelector` from `@reduxjs/toolkit`; pass parameters through an input selector `(_state, arg) => arg` and call `useSelector(state => selector(state, arg))` (don't build the selector per call; default cache size 1).
- Return a module-level `EMPTY_ARRAY` for no-data branches — a fresh `[]` breaks downstream memo deps from the first render.
- `shallowEqual` as 2nd arg only helps when entities are immutable. Legacy reducers here MUTATE entities in place and only clone `byId` (e.g. `FINALIZE_WORKOUT` sets `byId[id].end`) → `shallowEqual` sees the same objects and bails out; derived ordering goes stale. Use `createSelector` with `byId` as an input instead.
- `useMemo(…, [arr.length])` and `.length` deps go stale on content edits — derive via `createSelector` on `byId`.
(seen in GH-127, GH-277, GH-284)

### Reducer quirks that bite
- `FULL_IMPORT` (`fullStateReducer`) overwrites every slice with the imported JSON; a slice absent from an older export becomes `undefined` until some other action re-defaults it (navigation dispatches nothing → `Cannot read property … of undefined`). New top-level slices need `slice: action.state.slice ?? state.slice` there (as `videoAnalyses`, `aiChat`). A broken blob re-persists under `hardSet`; fixing needs a real restart + re-import.
- `FINALIZE_WORKOUT` unconditionally overwrites `end`: a re-enabled "Done" button for already-finished data must skip the dispatch (`workout?.end === undefined`) and only navigate.
- "Next id" hooks (`useNextWorkoutId()`) are per-RENDER values: N synchronous dispatches in one handler collide on the same id and the second clobbers the first (`workoutReducer` assigns `byId[id] = workout`). Hand out ids from a `useRef` reseeded each render (`ref.current++`).
- `setError` also sets `isLoading = false` — `setLoading(true)` then `setError(null)` never shows the spinner. Grep reducer bodies before trusting a dispatch sequence.
- `MODIFY_EXERCISES_IN_TRAINING` with an empty list keeps an empty PLANNED training (the UI just returns to the suggestion screen).
- `settings.restTimer.active` is a single global slot written per logged set: `dispatchStartTraining` dismisses it before `START_TRAINING`, but only when the training isn't already STARTED (re-entry calls `startTraining()` on every mount).
- `useUnfinishedWorkout` MERGES the suggested (planned) workout into `sets` — never count its sets to learn what was logged or whether a set is new. Use `usePersistedUnfinishedWorkout` (+ the finalized `workout`), select the first planned INDEX not yet logged, and stamp that index on the submitted set (the reducer's fallback is `max(index)+1` over the merged sets).
(seen in GH-63, GH-323, GH-324, GH-361, GH-364, GH-401, GH-443, AI-447-449)

### Deleting the latest finished training leaves plan lastTraining dangling
`FINISH_TRAINING` writes `plan.lastTraining`; `DELETE_TRAINING` never resets it. `TrainingHome` now falls back to the plan's latest finished training when the pointer resolves to nothing — but any new consumer of `lastTraining` must handle a dangling pointer. (seen in GH-467)

### Training and plan domain rules
- "Previous completed training" must skip the in-progress workout: `byExerciseId[id]` includes the active one — walk from newest and take the first with `end !== undefined` (`useLastFinishedWorkout`, multi-exercise `useLastFinishedWorkoutsByExerciseIds` excluding the current training's workouts).
- Comparisons at micro 1 of a meso: `getPreviousMicroInMeso` is undefined there — fall back to `useLastTrainingOfPreviousMeso` with `??`.
- Planned set indices carry over from the source workout (Deadlift sets 8 and 9 in the fixture) — select by index, never by position.
- "N of M trainings in micro": M = `Object.keys(plan.trainingNames ?? {}).length` (slots in `plan.trainings` only exist once planned/started).
- "Next session": search slots only AFTER `lastDone`; the current micro shown on the hero is the NEXT session's micro, not the last done one.
- "Which plan is current" for future-facing features (AI chat): filter by "still has work ahead" first, then rank (running session > trained in last 4 weeks > newest). Per-conversation state must be reset in the reducer that swaps the conversation (`setActiveMessages`), not in each caller.
- `MuscleInvolvementCard`'s subject is ONE training's `plannedWorkouts` (empty on a FINISHED training). For a micro-wide map compose `aggregatePlannedAcrossMicro` → `buildRows` → `computeGlobalMax` → `<MuscleMapBarList>`; `buildRows` emits rows only for muscles in the SUBJECT. `muscle-row-*` testIDs use the enum VALUE (`Core`), not the key (`CORE`).
- `ExecuteTraining`/`AddWorkout`: pass `workout={doneWorkout?.end ? doneWorkout : undefined}` in ALL modes; vary only `allowRefinalizeWhenDone={editMode}`. Hiding UI in a mode is not enough — gate the side effects too (edit mode must not start the rest timer or schedule notifications).
(seen in GH-63, GH-311, GH-323, GH-391, GH-417, GH-444)

### Settings and persisted enums
- App preferences live in Redux `settings` (`settingsReducer`, persisted via redux-persist), not in ad-hoc MMKV keys — translate spec'd "MMKV keys" into `AppSettings` fields + SCREAMING_SNAKE action types + `dispatchSet…` hooks. Plan-tab feature toggles go into `TrainingsPlanDrawer`; plan-tab cards/banners mount at the top of `PlanTab.tsx`'s container (all three plan modes).
- Renaming a persisted enum's legal values: normalise on read (`VALID_X` + `normalizeX(raw)` → new default) instead of a migration.
- Splitting one setting into per-view settings: a redux-persist migration that keeps the user's old value for the old view, seeds the new one, and keeps the legacy slot in sync during deprecation.
- Pickers with conditional options: the runtime fallback must be a value that is ALWAYS in the options, not a view-specific preferred value.
- Additive optional fields round-trip through export/import untouched (wholesale spreads) — but never write `field: undefined`; delete the key.
- UI-only fields on shared models (`hadContext`) must be stripped in the API client (`messages.map(({role, content}) => ({role, content}))`).
(seen in GH-63, GH-192, GH-300, GH-293)

### Coerce persisted numbers defensively
Persisted records (`state.exercises.byId[*].records[*][i].value`) can be `null`, `NaN` or numeric strings from old migrations — `!== undefined` guards don't protect `.toFixed`. Coerce: `if (v === null || v === undefined || v === '') return undefined; const n = Number(v); return Number.isFinite(n) ? n : undefined;` (`Number(null) === 0`, `Number('') === 0`). Unit-test `null` and `''`. If an auto-reviewer keeps re-flagging, inline its expected pattern at the call site. (seen in GH-246)

### Reading the persisted store on device
- `adb exec-out run-as com.powerliftingworkoutplanner cat files/mmkv/mmkv.default > copy.bin` (read-only; ~16 MB). Key `persist:root` → varint length → varint length → JSON whose slices are JSON strings again; parse in Python.
- MMKV APPENDS: superseded values stay in the file until compaction — a grep hit proves a value EXISTED, not that it is current. Make assertions count a value unique to the current run (e.g. reps 14) or verify via the UI.
- Used to verify things invisible on screen (committed plan values, `restTimer.active` → `null`, stored analysis versions). Writing back: emulators allow `run-as … cp` from `/data/local/tmp` (chmod 666 first); the Samsung phone blocks writes.
- Scripts: `__tests__/e2e/scripts/assert-gh358-committed-reps.py`.
(seen in GH-293, GH-358, GH-364, GH-404, GH-468)

### Gains fixture quirks
`__tests__/e2e/maestro/fixtures/baseline.gains` (also `__tests__/testdata/*.gains`):
- `workouts.byId` has ~2× the entries of `allIds` (orphans + a literal `"undefined"` key) — recompute expectations via `allIds.map(id => byId[id])` like the selectors; `Math.max(...Object.keys(byId).map(Number))` is NaN → filter `Number.isFinite`.
- Upcoming slots have `plannedWorkouts: {}` (no planned targets/delta captions); the next day of the active plan has 0 exercises; reachable trainings are FINISHED (M70) or PLANNED-but-empty (M71).
- No analysis with `status=DONE` + `velocityLossPercent` → VL insight cards never render; seeded analyses have `localVideoPath`/`resultPath` null.
- Names can carry trailing spaces (`"Butterfly "`, `"Reverse butterfly "`, `"Cable row close pronated "`).
- It carries `settings.mode = 'dark'` — importing resets the theme.
- Snake_case keys exist (`setResult.mean_path_deviation`, passed on as `drift`).
- `jq '.trainings.byId[].plannedWorkouts' baseline.gains` before writing planning-dependent assertions.
(seen in GH-235, GH-391, GH-403, GH-413, GH-417)

### The baseline fixture is months old recency windows are empty
The newest FINISHED training ends 2026-02-28, so "last 7/28 days", "this week", Coach Insight and AI-chat context are empty on a fresh import, and `adb shell date` is blocked on the emulators.
- Create current data in-app: plan a day ("Suggest based on last Training") → Start → tap ✓ on each prefilled set → Finish (`Total Sets: N (done)` confirms); or log one set from the exercise screen (see [exercise screens](app-screens.md#exercise-screens-and-the-records-range)).
- Or derive a fixture that shifts every numeric `start`/`end`/`date`/`createdAt` > 1e12 by one offset so the newest session is yesterday — and REGENERATE it before every evidence run (a two-week-old shifted fixture is stale again).
- Edge cases the baseline can't produce (outliers alone in a range, set-less sessions): copy it and add `trainings.byId['9002'] = {state:'F', start, end}` (+ `allIds`) or `workouts.byId[id]` with `sets: []` (+ `allIds`, `byExerciseId`); import with `--fixture <file> --suite 00_import_baseline.yaml`.
(seen in GH-391, GH-458, AI-447-449)

### Video analysis domain
- Rep detection writes CONTIGUOUS segments (rep N `endMs` === rep N+1 `startMs`): mapping a time to a rep must scan in REVERSE with inclusive bounds, or a seek to a rep's start resolves to the previous rep.
- Detector thresholds must be relative to the observed bar travel (`(maxY - minY) * RATIO`), never absolute px — far-away recordings have ~30 px total travel; add a small-scale fixture.
- Before any "labels are inverted" fix, compute per-rep durations from the raw `barPathSeries`: for a deadlift the lift (concentric) is the LONGER phase (3–5×). Trust the user's clarifying statement over the ticket's framing.
- Real-recording regressions: pull the store/result JSON from the device, save a slimmed fixture under `__tests__/fixtures/<ticket>/` with a `groundTruth` block, and assert `fixture.repSegments.map(phaseFn)` against it.
- Gallery-backed video: `react-native-document-picker`'s `ACTION_GET_CONTENT` grant dies with the process, so playback broke after restart. The app launches `ACTION_OPEN_DOCUMENT` natively and calls `takePersistableUriPermission` (no copy on import; release the grant when the LAST analysis using that URI is deleted — grants are per URI). The native decoders accept `content://` via `setDataSource(context, uri, …)`.
- The native detector version (`REP_DETECTION_VERSION`) bump re-runs detection on stored analyses when the detail opens (`migrateBarTrackingResultIfNeeded`).
- Rescaling a piecewise threshold table (VL→RIR calibration): anchor at the band CENTRE (RIR 3 → 15 %, 2 → 25 %, 1 → 35 %, 0 → 45 %), not at a boundary — `20 * (x/20) !== x` in IEEE754 makes boundary anchoring a coin flip.
- Aggregations that bundle buckets (records heatmap merges weekly columns > 16 weeks) must keep "best X" KPIs on the UNBUNDLED max (`bestCount` vs `maxCount`).
(seen in GH-307, GH-312, GH-316, GH-321, GH-341, GH-363)

### AI request handling
- Anthropic responses are a LIST of content blocks — a `thinking` block can precede the answer, text can be split. Join every `type === 'text'` block (`app/utils/ai/extractResponseText.ts`); `content[0].text` returned "" for larger models.
- A cut-off answer is the API's `max_tokens` (check `stop_reason === 'max_tokens'`), not the renderer; chat uses `CHAT_MAX_TOKENS` in `sendChatMessage.ts` and appends a visible notice when cut. The coach-insight call has its own limit.
- Build the system prompt and its in-app preview from ONE function (`buildChatContext`) so the preview is a faithful, assertable mirror.
- On emulators, secureStorage's keychain-backed MMKV key can be unstable across restarts (key "set" but 401s) — use a dummy key for UI paths (see [AI chat screens](app-screens.md#ai-chat-and-coach-insight)) and unit tests for API behaviour.
(seen in GH-130, GH-376, GH-391, AI-447-449)
