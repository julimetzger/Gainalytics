# Maestro flows — current overview (GH-584)

All flows live in `__tests__/e2e/maestro/flows/`. Since GH-584 every feature has 2–3
**target flows** that assert concrete values; shared steps live in 10 **helpers**. The per-ticket
flows of earlier tickets were merged into these target flows or deleted (the "Merged from:"
line in each flow header names its sources).

Data basis "baseline" = `fixtures/baseline.gains` imported with `00_import_baseline.yaml`
(last training Sat 28/02/2026, current plan "Push pull"). "Read-only" flows assume the
baseline is already imported; "imports" flows run `00_import_baseline.yaml` / `import_fixture.yaml`
themselves. Every file named below must be in `/sdcard/Download` —
`__tests__/e2e/scripts/run-maestro-from-wsl.sh` (modes `bootstrap`/`smoke`/`full`) pushes all of them.

## Target flows per feature

| Feature | Flow | Purpose | Data basis |
|---|---|---|---|
| F1 Start & Onboarding | `start_onboarding_template.yaml` | Fresh store: onboarding, Skip survives relaunch, empty Analyse dashboard, Help › Show Introduction, template "Strength Block" drives the home | empty store (clearState); ends with one plan only |
| | `start_existing_data.yaml` | Filled store cold-starts without onboarding; reopened onboarding's "Create an empty plan" / "Import data" routes | imports baseline (`baseline.gains`) |
| F2 Training home | `home_dashboard.yaml` | Micro hero values, Next/Last Training cards, plan list + search, cards open trainings (not the add-plan dialog) | baseline, read-only |
| | `home_new_plan_current.yaml` | A new plan becomes current (snackbar, Undo, star); first plan on an empty store | empty store, then imports baseline |
| F3 Planning | `plan_create_meso_template.yaml` | Plan new Training → edit mode, plan name required, Add Meso/Training, last meso not deletable, "From template" without duplicates | imports baseline |
| | `plan_edit_sets.yaml` | "Edit plan" of a planned training: EDITING PLAN, Add Set carry-over, weight 100 → 105, decimal RIR, "+" opens the picker directly | imports baseline; `goto_micro69_push.yaml` (MODE=edit) |
| | `plan_overflow_actions.yaml` | ⋮ menu per state: Clear planned training, empty training not startable, older training without the option | imports baseline |
| F4 Training execution | `train_start_log_finish.yaml` | Card → Train → Start → log set (100/5, RIR 0,5 → 125 kg / 1.5) → Finish; status labels; exercise switch clears input | imports baseline |
| | `train_rest_timer_1rm.yaml` | Rest timer "target 01:30" shown once, no restart on correcting a logged set, Title Case menu labels, ESTIMATED 1RM 127 kg | imports baseline; `goto_micro69_push.yaml`, `open_rest_menu.yaml` |
| | `train_delete_exercise_running.yaml` | Crash fix GH-486: deleting an exercise of the running training; dialog counters; training continues and finishes | imports baseline |
| F5 Training analysis & edit | `training_analysis_compare.yaml` | FINISHED training opens (GH-117/119); vs Plan / vs last / vs Micro / plan position values; scroll keeps the duration | baseline, read-only; `goto_micro2_push.yaml` |
| | `micro_overview_compare.yaml` | Micro swipe keeps the sub-tab; Micro 2 Overview Total/Plan compare values, English labels | baseline, read-only |
| | `training_edit_delete.yaml` | FINISHED training in edit mode (times card, Add Workout, records modal); deleting lands on the Plan tab | imports baseline |
| F6 Exercises | `exercises_list_detail.yaml` | e1RM sparklines of every session (Squat), detail Graph tab Frequency (dynamic end week) | imports baseline |
| | `exercise_edit_alternatives_delete.yaml` | Alternatives picker sorted/searchable/keeps picks/saves; delete hint with counters, Cancel deletes nothing | imports baseline |
| F7 Analyse tab | `analyse_dashboard_drilldown.yaml` | Stale-week banner, radar of an empty week, muscle drill-down into Metrics Overview | baseline, read-only |
| | `analyse_graphics_metrics.yaml` | Chart empty states, Frequency + exercise without crash (GH-169), multi-metric/point tap, date range picker, Metrics Overview | baseline, read-only |
| | `analyse_drawer_screens.yaml` | Crash fix GH-458 H1: every drawer entry opens; drawer closes; labels; Records KPIs; Training Length outliers; History picker label | baseline, read-only |
| F8 Video analysis | `video_import_playback.yaml` | Import via picker, analysis survives resume, Rep Summary (3 reps), secure video, readout follows playback, chart seek | imports baseline; `squat-3reps.mp4` |
| | `video_list_filters_vl.yaml` | List, filters (RIR/VL/exercise), search, VL reference calibration (14.3% VL, RIR 3-4 → 1-2) | imports `gh415-workout-linked-analysis.gains`; `gh415-result.json` copied into the app's files dir (see flow header) |
| | `video_compare.yaml` | Set-based labels in header/picker, "N reps \| VL x%", synchronised playback | imports `gh393-compare-labels.gains`; `squat-3reps.mp4` |
| F9 Import/Export | `data_strong_export_roundtrip.yaml` | Strong CSV export (5768 sets / 387 workouts), empty-store export, invalid CSVs rejected with line number, round trip | imports baseline; `gh496_invalid.csv`, `gh496_invalid_weight.csv` |
| | `data_strong_import_records.yaml` | CSV on top of the baseline → one new record 240 kg (+15 kg); real Strong export (1153 sets, 17 new exercises) | imports baseline; `gh496_new_record.csv`, `strong_sample_export.csv` |
| F10 Settings | `settings_appearance.yaml` | Appearance rows "Theme"/"Color", Blue → Purple → Custom #E91E63, Light mode, persistence | imports baseline; `set_appearance.yaml` |
| | `settings_general.yaml` | General switches (no "Plus-Button left"), timer values, app version as a pattern | baseline, read-only |
| F11 AI coach (offline, dummy key) | `ai_chat_context.yaml` | Chat opens (GH-514); planned sessions / picked training in the context preview | imports `gh391_planned_fixture.gains`, `gh391_newplan_fixture.gains` |
| | `ai_chat_errors_history.yaml` | Failed send leaves the chat usable, header actions, history archive/search/resume/delete, key removal | imports `gh508_chat_fixture.gains` |
| | `ai_settings_provider.yaml` | Default provider, provider switch, save/remove key, model field | imports baseline |
| F12 Body weight | `body_weight.yaml` | Manual entries: empty state, validation, KPIs, list, edit, delete | imports baseline |
| F13 Editable muscles | `muscles_manage.yaml` | Add/duplicate/hide/remove muscles, radar axes follow | imports baseline |
| | `muscles_exercise_editor.yaml` | Exercise editor offers the user's muscle list and saves a new involvement | imports baseline |

Emulator status at the end of the GH-584 run (each flow run standalone after the baseline was
imported once; x86_64 emulator, API 36): 29 of 32 green. Not yet green: `video_list_filters_vl.yaml`
(never reached the device in the run), `video_compare.yaml` (fixture import + picker fixed, the
analysis/sync part not reached), `ai_chat_errors_history.yaml` (the chat/history part passed; the
final key-removal block failed twice, the second time during a system ANR on the emulator).
`suite.yaml` was not run end-to-end (≈ 2.5 h on this runner).

Not yet consolidated:
- `gh528_*.yaml` (15 files) — Health Connect (GH-528), not part of the GH-584 run.
- `gh542_added_exercise_on_training_date.yaml` — decision pending.

GH-533 "current micro" (former T2.3) is covered by the unit test `__tests__/utils/currentMicro.spec.ts`
instead of a flow with generated fixtures.

## Helpers (`runFlow`)

| Helper | Params (env) | What it does |
|---|---|---|
| `00_import_baseline.yaml` | – | Full import of `baseline.gains` from Downloads (SAF folder fix), dismisses the onboarding |
| `gh497_dismiss_onboarding.yaml` | – | Waits for the tab bar, skips the onboarding if shown |
| `import_fixture.yaml` | `FIXTURE` (file name in Downloads) | Same as the baseline import for another `.gains` |
| `goto_micro69_push.yaml` | `MODE` = `planned` (default) \| `running` \| `edit` | Opens plan 1 › micro 69 "Push"; optionally starts it or opens "Edit plan" |
| `goto_micro2_push.yaml` | – | Opens the Analysis of Micro 2 · "Push squat" (plan "Push pull") |
| `open_rest_menu.yaml` | – | Reaches a running rest timer and opens its overflow menu |
| `set_appearance.yaml` | `MODE` = light \| dark, `PALETTE` = blue \| purple \| custom, `HEX` (custom only) | Sets theme mode and colour in Settings |
| `pick_file.yaml` | `FILE` (name or regex) | Settings › Import from Strong CSV › picks the file |
| `set_dummy_api_key.yaml` | – | Stores a dummy Anthropic key so the chat renders (no request is sent) |
| `open_ai_chat.yaml` | – | Opens Analyse › AI Chat from anywhere |

## Entry points

- `smoke.yaml` — PR smoke (GH-588): imports the baseline itself, then `home_dashboard.yaml`,
  `analyse_dashboard_drilldown.yaml`, `train_start_log_finish.yaml` (last, changes data). Needs only
  `baseline.gains` in Downloads. Run by the PR check `.github/workflows/maestro-smoke.yml` and the
  agent workflow's smoke mode (both via `.github/agent-emulator/smoke.sh`), `npm run e2e:android:smoke`, orchestrator.
- `suite.yaml` — the suite run by `npm run e2e:android` / `run-maestro-from-wsl.sh` (default `SUITE_PATH`).

## Manual flows

`flows/manual/` holds flows that need a real API key, a ChatGPT sign-in, a real device or real
user data (see `flows/manual/README.md`). They are not in `suite.yaml`, not run by CI and not
counted as target flows.

## Fixtures

- `fixtures/baseline.gains` — the baseline (also `--fixture` default of the runner).
- `fixtures/squat-3reps.mp4`, `fixtures/squat-1rep.mp4` — video clips.
- `fixtures/gh393-compare-labels.gains` (video_compare), `fixtures/gh415-workout-linked-analysis.gains`
  + `fixtures/gh415-result.json` (video_list_filters_vl).
- `fixtures/gh496/` — 4 Strong CSVs + README (data_strong_*).
- `__tests__/testdata/gh391_planned_fixture.gains`, `gh391_newplan_fixture.gains`,
  `gh508_chat_fixture.gains` — AI chat fixtures.
- Currently unused by any flow: `fixtures/gh322-unplanned-evidence.gains`,
  `fixtures/gh486-only-exercise.gains`, `fixtures/gh486-legacy-no-exercises.gains`,
  `fixtures/gh526-unnamed-training.gains`, `fixtures/legacy-nameless-plan.gains`.

## Rules for new flows

1. **Extend, don't add.** A ticket extends the target flow of its feature (or adds a section to it)
   instead of adding a per-ticket `ghNNN_*.yaml`. Reuse the helpers above.
2. **Precondition first.** Start with an assertion on the expected start state (e.g. the baseline's
   "Push pull" plan) so a wrong state fails at once instead of producing a vacuous pass.
3. **Assert values.** Every step result is checked with `assertVisible: {id, text}` or
   `copyTextFrom` + `assertTrue`; visibility alone proves nothing. Assert transitions (old value gone).
4. **No device specifics.** No device serials, no local/absolute paths (also not in
   `takeScreenshot`), no fixed "today"/"current week" dates — compute them at run time or match a pattern.
5. **Quoted evalScript.** Use the single-line quoted form
   `- evalScript: "${output.x = ...}"` and `- assertTrue: "${maestro.copiedText === '...'}"`;
   the block form `evalScript: |` is a no-op on Maestro 2.0.9-ports and can never fail
   (`docs/memory/agent/maestro-flows.md`).
6. Name the data basis and the files needed in `/sdcard/Download` in the flow header, and add new
   Download files to the runner's bootstrap push.
