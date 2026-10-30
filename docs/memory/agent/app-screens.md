# App screens: navigation & testability

How to reach and assert specific Gainalytics screens from Maestro or adb, and which parts each tool can see.
Generic Maestro rules: [maestro-flows.md](maestro-flows.md). Back to the [index](../agent-memory.md).

### Bottom navigation and the remembered tab
- Bottom tabs expose `tab-training`, `tab-analyse`, `tab-settings`, … as content-desc/accessibility label: `tapOn: 'tab-settings'` (bare string), never `{id: …}`.
- Only the ACTIVE tab shows a text label — `extendedWaitUntil: visible: 'Training'` fails whenever another tab is active; wait for `id: 'training-home-screen'` or screen content instead.
- The app relaunches on the last visited tab/sub-screen (unless cold-started after force-stop + clearState). Navigate to the target tab explicitly before any drawer/hamburger step — the hamburger opens the CURRENT tab's drawer.
(seen in GH-130, GH-204, GH-403, QA-MAESTRO-001)

### Training home dashboard
- Screen id `training-home-screen`. Plan rows: `plan-meta-{planId}` (opens the plan), `plan-name-{n}`, `plan-row-{n}`, `plan-select-{n}` (star = make active); hero card `micro-hero-plan-name`.
- `MicroHeroCard` and `LastTrainingCard` text are not navigation targets (redesign GH-204); tapping "Push pull"/"Last Training" text does nothing reliable. Use `last-training-card-pressable` (see [opening a training](#opening-a-specific-training)).
- It only scrolls along the RIGHT edge: the hero card's horizontal chart swallows centred drags. `- swipe: {start: "83%, 80%", end: "83%, 25%", duration: 500}` (right of the chart, left of the `add-trainings-plan` FAB at 84–97 %), or `adb shell input swipe 896 1920 896 600 500`.
- The absolutely positioned add-plan FAB covers whatever scrolls under the bottom-right corner (e.g. a Searchbar's clear button) and eats the tap.
- Plan and training names also render in the Next/Last-Training cards; one plan is `Push pull`, another `Push pull upper lower`. Assert list rows by their own testID (`plan-name-1`), not by text.
- `DayStrip` pills are only pressable for DONE days; tapping future/today pills is a silent no-op.
- A STARTED training's timer ticks on the home card too → the hierarchy never idles (see [gRPC](maestro-running.md#grpc-deadline-exceeded-and-connection-closed)).
(seen in GH-63, GH-218, GH-324, GH-412, GH-428, GH-477)

### Opening a specific training
- **Next Training card:** `next-training-start-button` (label flips between "Next Training"/"Continue Training" — match the testID) navigates straight to `TrainingPlan` with `subTab: 'train'`. It only NAVIGATES; starting happens on the Train tab (`train-tab-start-button`). It lands wherever the plan's cursor is — on `baseline.gains` an already-finished M70 day or a day with 0 exercises — so for a startable training: "Plan this Training" → `tapOn: '^Suggest based on last Training$'` (anchored; "…last planned Training" sits below) → `subtab-train` → `train-tab-start-button`. Don't use `header-session-timer` as a landing probe (only exists while RUNNING); use `drawer-menu-button`.
- **Last Training card:** `last-training-card-pressable` passes no sub-tab → a FINISHED training opens on its default (Analysis). Its content-desc (`Last Training, <name>, Meso 1 · M7 · D1 · today, …`) is a good guard before destructive steps. `header-overflow-icon` → `overflow-edit` renders `ExecuteTraining` read-only (nothing written unless an input is touched) — safe 1RM/delta evidence on real data.
- **Plan row:** `scrollUntilVisible {id: 'plan-meta-<id>'}` → tap → opens the plan (Micro 1 by default for a meso card) → navigate micro/day via the drawer (see below).
- **Old finished trainings:** plan drawer → History → calendar; swipe x 100→600 = previous month, 600→100 = next; tap the highlighted date → "Go to Training".
(seen in GH-235, GH-330, GH-364, GH-367, GH-437, GH-443, GH-467)

### The plan drawer and micro navigation
- The plan drawer (`react-native-drawer-layout`, front) is NOT in Maestro's hierarchy: `assertNotVisible: 'Mesos:'` passes while it covers 86 % of the screen, and taps "through" it hit the drawer. Gate on something only the underlying screen renders. Closing it programmatically is unsolved (BACK pops to home, edge swipe = system back, scrim taps do nothing); force-stop + relaunch clears it.
- Drawer contents: the "Trainings:" list (slot names) navigates to that slot IN THE CURRENTLY OPEN micro when tapped on the name (not the pencil); the "Micro N ◀/▶" pager keeps what is open: from `Micro N Overview` it lands on the next micro's Overview, from a training on the SAME slot of that micro (GH-527: Micro 4 · Pull → pager "Micro 1" → Micro 1 · Pull; tap the drawer's `Overview` entry to get the overview). The drawer stays open after a pager tap, so several pager taps chain (`tapOn: 'Micro 2'`, `'Micro 3'`, `'Micro 4'`). Chain: hamburger → pager to target micro → hamburger → slot name. Drawer rows have no testIDs → point taps (one plan measured Pull/Push/Upper/Lower ≈ 35/41/46/51 % height, `< Micro N-1` ≈ `22%,83%` — re-measure for your plan).
- The training header is TWO text nodes: `"Micro 69"` and `" Push"` (leading space). Assert them separately; never guard a paging loop on a bare "Micro NN" (the pager label collides).
- Horizontal swipes starting at x ≲ 30 px trigger the system back gesture and can leave the app.
- Fixture micros can contain stale STARTED trainings with old start dates — a genuinely fresh training shows "Plan new Training"/0 exercises.
(seen in GH-324, GH-364, GH-394, GH-437)

### Training detail screen what Maestro and uiautomator can see
**Current state (newest findings win):**
- Since GH-414 fixed the RangeSwiper row width (panes used to lie outside their parent box), the panes ARE in the a11y tree: `subtab-plan/train/analysis`, `trainings-overview*`, analysis values (`analysis-total-sets`, `muscle-row-*`), plan editor rows and the drawer dump fine. Older notes claiming the whole pane/`NestableScrollContainer` is invisible are superseded.
- On a RUNNING training (Train tab) `uiautomator dump` fails (`could not get idle state`, the header timer ticks) and returns a STALE file — Maestro's driver still resolves TextInputs and touchables there (`add-workout-set-*-input`, `train-tab-start-button`, `rest-timer-*`, `rest-progress-ring-text`), but NOT plain `<Text>` nodes (`add-workout-set-number`, `planned-set-target-label`). Probe with throwaway `runFlow: when: visible: … → takeScreenshot: found_x` steps.
- The `MetricsNode` subtree (Metrics table, `date-range-picker-button` and its label, "Muscle Overview") is still invisible; only `metrics-active-filter` survives. A RangeSwiper swipe still works as an interaction (leftward = next period).
- Paper `Menu`/dropdowns rendered inside the gesture root were not openable/visible in older rounds; Portals (overflow menu) are fully exposed.
- If a dump shows only header + bottom nav, suspect layout (an ancestor box smaller than its children), not missing testIDs.
(seen in GH-300, GH-355, GH-403, GH-414, GH-428, GH-436, GH-443, GH-458)

### Overflow menu and plan full-edit
- `header-overflow-icon` → items depend on state: `overflow-edit-plan` ("Edit plan", full edit) ONLY when `activeSubTab === 'plan' && trainingState === PLANNED`; STARTED/FINISHED trainings get `overflow-edit` ("Edit training") / Finish / Pause / `overflow-discard`.
- To get a PLANNED training WITH sets: drawer → a future micro → slot → "Suggest based on last Training" (copies the previous micro's workouts; stays PLANNED). Don't tap Start — it hides "Edit plan". An empty PLANNED slot renders `TrainingsBase`, not set rows.
- Full-edit proof anchors in the header: `header-plan-editing-kicker` ("EDITING PLAN"), `header-plan-done-button`.
- Flows that start a training aren't repeatable unless they delete it again (`overflow-discard`) — and see [dangling lastTraining](state-and-data.md#deleting-the-latest-finished-training-leaves-plan-lasttraining-dangling).
(seen in GH-63, GH-218, GH-324, GH-406)

### AddWorkout set rows testIDs and prefilled planned values
- The input row keeps the bare ids `add-workout-set-reps-input` / `-rir-input` / `-weight-input` / `add-workout-set-submit-button`; rendered set rows carry their set number: `add-workout-set-reps-input-3`, `add-workout-set-confirm-3`, `add-workout-set-logged-3`, `add-workout-set-delete-3` (older flows used `index: 0`).
- Planned sets render as unconfirmed rows WITH the planned numbers — `…-1`/`…-2` exist before anything is logged, so "row visible" ≠ "set logged", and a value assertion can pass on the PLANNED value. Log values that differ from the plan, assert `add-workout-set-logged-N`.
- Which set number the next log gets depends on whether `PlannedSetTarget` renders for that exercise (fixture-dependent; observed set 3 one month, set 1 the next) — read it off the real screen; pin the start state with a precondition assertion.
- Planned set indices need not start at 1 (Deadlift plan sets 8 and 9 in the fixture).
- After `add-workout-set-confirm-N` the keyboard is USUALLY gone (`onPress` calls `Keyboard.dismiss()`), so an unconditional `hideKeyboard` is a BACK to training home (train_rest_timer_1rm). Once it stayed up and covered the rest card (`copyTextFrom` → `""`): guard it — `runFlow: when: notVisible: {id: rest-progress-ring-text, text: '\+?\d\d:\d\d'}` → `hideKeyboard`.
- Exercise tabs: `training-exercise-<exerciseId>` (labels can carry a trailing space, e.g. `"Hyperextension "`).
- "Finish Training" sits below the set list; its y moves with content (~54/64/70 % seen). Build the subject deterministically from a re-imported fixture. Prove "finished" from the HOME screen (persisted state): `next-training-status-label`/`next-training-start-button-text` back to "Next Training" and `next-training-elapsed` gone — the header timer looks the same for STARTED and FINISHED.
(seen in GH-63, GH-330, GH-401, GH-428, GH-443, GH-466)

### Plan editor inputs
- `plan-pending-set-*` inputs share ONE testID across all exercises with an open row — a second open pending row receives the taps meant for the first (`8` → `810`). Keep exactly one pending row alive; commit via another "Add set" or ⋮ → Edit plan → Done.
- After the first exercise pick via "Plan new Training" the header drops the Done button while the editor stays in full edit; a BACK (keyboard already closed) leaves and DISCARDS the open row. Check `dumpsys input_method | grep mInputShown` before every BACK; re-enter via ⋮ → Edit plan for a Done button.
- Quick edit commits on the keyboard OK/Enter (`onSubmitEditing`) or an outside tap; the old Portal "Editing … · Done" bar is gone. Use a unique value (e.g. 14) and verify the committed number out-of-band (see [reading the store](state-and-data.md#reading-the-persisted-store-on-device)).
- Weight must be `0–999.9` (`planUtils.isPlanFieldValueValid`); out-of-range drafts are silently dropped on commit — and `adb shell input text` into a prefilled field concatenates (`40` → `11640`). Clear first, re-screenshot the exact digits.
- Drag: a plain `adb shell input swipe <hx> <hy> <hx> <hy2> 1500` starting on the ☰ handle of the custom `PlanEditList` reorders exercise sections; it does NOT work on the `DraggableExercise` tab strip (the real `react-native-draggable-flatlist`, long-press gated) — verify draggable-flatlist patches there.
(seen in GH-324, GH-358, GH-436)

### Analyse filter panel and exercise search sheet
Since GH-642 the sharingan `TrainingElementPicker` (and its "N selected" anchor, `search-bar`, `chip`, `element-picker-toggle`, `history-picker-toggle`, `date-range-picker-button` on Graphics/Records) is gone.
- `AnalyseFilterPanel` (Graphics, Records, History, Metrics) starts COLLAPSED: `filter-panel-card` (tap = expand, swipe left/right = next/previous period), `filter-range-label` ("28 Nov 2025 – 28 Feb 2026"; same-year ranges show the year once: "28 Aug – 28 Nov 2025"), `filter-selection-summary` ("All exercises" / "Squat, Bench Press · Quads"), `filter-groupby-summary` ("Day · All metrics"; Records: "Week"), arrows `filter-range-previous` / `filter-range-next` (`enabled: false` when the period already ends today). Assert values on these texts.
- Expanded (`filter-panel-collapse`): `filter-range-preset-4W|3M|6M|1Y|custom` (Custom = the old date dialog, same `date-range-start-input` coordinates), `filter-groupby-Day|Week|Month|Micro`, `filter-metric-<Metric with - for spaces>` (horizontal row: swipe `from: {id: filter-metric-Reps}` to reach Frequency), `filter-exercise-chip-<id>` (most trained + selected, `selected:` works; tap by `{id: 'filter-exercise-chip-.*', text: X}`), `filter-muscle-<Muscle>`, `filter-muscle-clear`, section titles `filter-exercise-section-title` "Exercises (N)", `filter-muscle-section-title` "Muscles (N)".
- Exercise search sheet (`exercise-search-sheet`, also behind the training "+" tile): `exercise-search-bar`, rows `exercise-search-row-<id>` / `exercise-search-recent-<id>` with the name as label and `checked:`; a tap toggles and keeps the search. Pick with the helper `pick_exercise_in_search_sheet.yaml` (env NAME). Close with `hideKeyboard` + `tapOn: {id: exercise-search-done}`; assert the count by text `'Done · N selected'`.
(seen in GH-642; history of the old picker: GH-341, GH-401, GH-403, GH-458, GH-468)

### Analyse tab and its drawer
- After a cold start `tab-analyse` shows the Dashboard; later opens resume the last sub-screen. `analyse-drawer-toggle` exists only on sub-screens; use conditional `runFlow: when:` blocks for both cases (Dashboard: "Alle Metriken"/quick-access buttons).
- `tapOn: {id: 'analyse-drawer-toggle'}` reported success but never opened the drawer on an emulator — `tapOn: point: '6%,9%'` (+ guarded retries; the first tap after a FULL_IMPORT is swallowed), then `assertVisible`.
- After navigating via the drawer, the drawer can stay up a few seconds; the list rows are then NOT in the hierarchy and `back` pops the screen. Just `extendedWaitUntil: {visible: {id: 'video-analysis-row-N'}, timeout: 60000}` before tapping.
- Drawer item labels: the graph entry is "Analysis" (was "Analyse"); "Metrics Overview" also appears as a screen header — opening the drawer while on Metrics Overview makes that text ambiguous.
- Drawer screens are mounted without params (`freezeOnBlur` keeps them frozen); param-dependent screens now guard `route.params ?? {}`.
(seen in GH-313, GH-363, GH-393, GH-415, GH-452)

### Settings import and the file picker
- `00_import_baseline.yaml` (shared): ends by waiting for `'Import Data'`, then `tapOn: 'tab-training'` and waits for `'Push pull'`. Running it replaces the WHOLE store.
- The confirm dialog: `tapOn: {text: '^Import$'}` — a bare `'Import'` can hit the covered "Import Data" button.
- The SAF picker REMEMBERS its last folder: `No visible element found: "baseline.gains"` can mean it opened in `Videos › …`. Guarded fix: `runFlow: {when: {notVisible: 'baseline.gains'}, …}` with a left-edge swipe `start: '2%, 50%' → '80%, 50%'` + `tapOn: 'Downloads'` (see `00_import_baseline.yaml`). Custom device-side names are not reliably listed (grid ellipsis, MediaStore lag) — always push as `baseline.gains`.
- Manual import when Maestro can't: push the file, Settings tab → scroll → `settings-import-data-button` (get bounds from `uiautomator dump`) → confirm "Import" → pick `baseline.gains` in DocumentsUI → verify `grep 'text="Push pull"'` in a dump.
- The fixture carries `settings.mode = 'dark'`: an import resets the theme. For light-mode evidence import first, then switch the theme, then run assertion flows without import. The theme is now a segmented row with testIDs `settings-theme-mode-light|dark|system`; the old `settings-theme-active-mode` label ("Active: Light") is gone — assert `{id: 'settings-theme-mode-light', checked: true}` instead (GH-497; use the helper `set_appearance.yaml`). Settings keeps its scroll position (it sits at "Import Data" after an import), so reach the row with `scrollUntilVisible … direction: UP`. See `set_appearance.yaml` (env MODE/PALETTE/HEX). (GH-482)
- Settings palette radios: tap by testID, not the label text.
(seen in GH-393, GH-403, GH-405, GH-417, GH-443)

### Video analysis screens
- Photo Picker (`DocumentPicker.pickSingle({type: video})` on Android 13+) only shows MEDIA-INDEXED files — adb-pushed files never appear (`MEDIA_SCANNER_SCAN_FILE` needs system permission). On the Samsung phone select by content-desc `Video vom <date> mit einer Dauer von MM:SS` + `tapOn: 'Fertig'`; the picker then copies the file (~100 s for 46 MB) — size first-progress timeouts ~240 s. The SAF picker (`ACTION_OPEN_DOCUMENT`) DOES show adb-pushed files.
- `baseline.gains` seeds analysis rows with `localVideoPath: null, resultPath: null` → "No local video path available yet", no overlay. Import a real clip (Video Analyses → Import Video → `squat-3reps.mp4`, the 10 s clip; the 5 s Apr-14 clip fails plate detection) to get a `done` analysis with playback. Synthetic ffmpeg videos often fail YOLO plate detection (`ERR_VIDEO_ANALYSIS_NO_CANDIDATE`).
- For a fixture-driven overlay, `resultPath` must point into app-private storage: `adb push x.json /data/local/tmp/` then `run-as <pkg> sh -c 'cat /data/local/tmp/x.json > /data/data/<pkg>/files/x.json'` (RNFS can't read /sdcard/Download; adb can't create new files there).
- Rep count/VL on the list card (`video-analysis-set-summary-N`) is written by `VideoAnalysisPlaybackOverlayCard` when the detail's playback section renders — open the detail first. Filters: `video-analysis-rir-chip-0` hides analyses without an RIR estimate.
- Scroll the detail with edge swipes (the player/chart eat centred gestures). Adjacent rep handles overlap at full zoom — a tap by `calibrate-rep-N-…` can move the NEIGHBOUR; assert the observable outcome.
- Leaving with `launchApp` (force-stop) marks running analyses FAILED; use `stopApp: false`.
(seen in GH-152, GH-177, GH-285, GH-307, GH-321, GH-343, GH-396, GH-415, GH-439)

### AI chat and coach insight
- Chat input exists only with a saved key. A dummy key (`sk-ant-dummy-…` via Settings → AI Configuration → Save Key) makes every send append the user message and then fail fast with "Invalid API key." — deterministic conversation fixtures; saving an EMPTY key deletes it.
- Deterministic replies: temporarily point `ANTHROPIC_MESSAGES_URL` in `sendChatMessage.ts` at a local Node mock (`http://10.0.2.2:<port>/v1/messages`, response `{content:[{type:'text',text}], stop_reason}`), capture, REVERT before committing.
- Failure/spinner/retry paths: wrap the send in `- setAirplaneMode: enabled` … `disabled` — zero real requests.
- "What the model receives" is assertable through the context preview dialog: `copyTextFrom: {id: 'chat-context-preview-planned'}` + `assertTrue`.
- Recency windows (7d/28d) are empty on the stale fixture — see [fixture dates](state-and-data.md#the-baseline-fixture-is-months-old-recency-windows-are-empty).
(seen in GH-293, GH-376, GH-391, AI-447-449)

### Exercise screens and the Records range
- Exercises tab → exercise row → `exercise-tab-log` → `add-workout-set-reps-input`/`-rir-input`/`-weight-input` → `add-workout-set-submit-button` records a set AND a workout dated today (populates Dashboard Top/Focus exercise cards; `add-workout-finalize-button` not needed).
- The exercise detail has a sticky 1RM/tab header — upward swipes must start below ~40 % height.
- DateRangePicker inputs (`date-range-start-input`/`-end-input`, masked `MM/DD/YYYY`) can't be driven by Maestro `inputText`; see [typing with adb](device-interaction.md#typing-text-with-adb). Set the start first when it precedes the current end; the value normalises on blur — tap the other field before Save.
(seen in GH-341, GH-413, GH-458)
