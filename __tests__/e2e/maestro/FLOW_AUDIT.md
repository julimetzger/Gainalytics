# Maestro Flow Audit (GH-225)

This audit reviews every Maestro flow under `__tests__/e2e/maestro/flows/` and
recommends a consolidated test pyramid. The full set of 41 flows has accumulated
over many tickets; several are now redundant, several are pinned to data states
that are no longer guaranteed by the baseline `.gains` fixture, and some test
unmerged or behind-flag features.

The recommendations are intended to guide a follow-up trim. They are NOT
applied as part of GH-225 — this PR only fixes the 6 Bucket-A flows + adds this
audit, per the ticket scope.

## Importance levels

- **Critical** — covers a code path that has crashed in production or is on
  the user's primary success path. Must always pass before a release.
- **High** — covers a major user-facing feature; failing this should block a
  release until investigated.
- **Medium** — covers a secondary feature or a regression-protection target
  for a closed ticket. Failing acceptable for an isolated PR.
- **Low** — historical evidence-only flow, easter egg, or covered by another
  flow.

## Status legend (post-GH-225 expectation)

- ✅ PASS — verified PASS in r7 (GH-225) on <phone-serial>, OR PASS in r6 with no
  changes since.
- 🔄 N/A — flow targets unmerged feature work (gating PR not yet on master).
- 📦 DATA-DEP — fails on baseline; needs a richer test data fixture or a
  richer pre-flow setup. Pre-existing, out of scope for GH-225.
- 🛠️ INFRA — fails because of WSL/adb/Maestro driver instability, not a
  code regression. Pre-existing.

## Audit table

| # | Filename | What it tests | Importance | Overlap with | Recommendation |
|---|----------|---------------|------------|--------------|----------------|
| 1 | `00_import_baseline.yaml` | Cold-start import of baseline.gains via Settings → Import Data → file picker | Critical | — | **Keep**. Bootstrap dependency for many other flows. (Note: post-import "Training" assertion still has the same staleness pattern fixed in GH-225 for sibling flows; track in a follow-up.) |
| 2 | `01_training_smoke.yaml` | Training Home renders + add-plan FAB present | Critical | `gh77_dashboard_smoke`, `trn005_smoke_launch`, `gh204_training_home_dashboard` | **Keep** (canonical post-GH-204 smoke). Stable PASS. |
| 3 | `02_add_workout_set.yaml` | Add a workout set inside a STARTED training | High | `08_training_length`, `gh195_rest_timer_and_1rm` | **Keep**. The only flow that exercises the AddWorkoutSet → set save round-trip. |
| 4 | `08_training_length.yaml` | Training duration timer increments from start to end | Medium | `02_add_workout_set` | **Merge with `02_add_workout_set`** — both drive the same screens; the timer assertion can be folded into the add-set flow. |
| 5 | `10_trn002_linear_progression.yaml` | Linear progression suggestions in a meso | Medium | `trn004_meso_create_verify` | **Remove** — fails to navigate from the post-GH-204 dashboard (LastTrainingCard non-pressable, no plan-meta navigation step). The progression-suggestion logic has unit-test coverage (`__tests__/redux/suggestions/`); a Maestro flow adds little. |
| 6 | `11_metrics_overview_slots.yaml` | Navigate Analyse → drawer → Metrics Overview screen renders | Medium | `11_metrics_overview_slots_suite`, `gh97_frequency_metric` | **Keep, scoped down** (this PR). Slot-picker dialog cannot be driven by Maestro on the current build (the entire `MetricsOverviewForWorkouts` Card subtree is hidden from the accessibility tree because it lives inside `RangeSwiper`'s `GestureDetector`). Slot-persistence behaviour is covered by `__tests__/redux/settings/`. |
| 7 | `11_metrics_overview_slots_suite.yaml` | Wraps flow #6 with explicit tab-pinning | Low | flow #6 | **Remove** — the parent flow already pins tab state in GH-225. The wrapper is redundant. |
| 8 | `99_smoke.yaml` | Same as `smoke.yaml` after GH-225 — settings-import-button visible | Low | `smoke.yaml` | **Remove**. Subsumed by `smoke.yaml` post-GH-225. |
| 9 | `GH-117_no_crash_smoke.yaml` | Navigate to TrainingsOverview without the historic GH-117 crash | High | `gh119_training_overview_no_crash` | **Merge with `gh119_training_overview_no_crash`** — both verify the same crash regression on the same screen with the same data prerequisites. |
| 10 | `analyse_date_range_picker.yaml` | Analyse → date range picker open + close | Medium | `gh97_frequency_metric` (also opens Analyse) | **Keep**. Independent target (range picker) not covered elsewhere. The r6 gRPC drop is an INFRA issue, not a flow bug. |
| 11 | `fun001_cardio_easter_egg.yaml` | Adding a 21-rep set triggers the cardio easter-egg toast | Low | `fun001_import_and_easter_egg` | **Merge with `fun001_import_and_easter_egg`** or remove. Easter-egg coverage doesn't justify two flows. |
| 12 | `fun001_import_and_easter_egg.yaml` | Import baseline + verify easter-egg toast appears | Low | `fun001_cardio_easter_egg` | **Remove** (or merge per #11). Toast wording has drifted since the flow was authored; not load-bearing. |
| 13 | `fun001_no_relaunch.yaml` | App stays open across an easter-egg toast | Low | — | **Remove**. Tab-settings testID regex assertion is brittle and the path has no real failure mode (no force-stop, no crash). |
| 14 | `gh101_suggest_last_meso.yaml` | "Suggest from last meso" button works on plan creation | Medium | `trn004_meso_create_verify` | **Remove** — depends on a `settings-import-data-button` that the flow expects in a state the import flow no longer leaves. Suggestion logic is covered by unit tests. |
| 15 | `gh119_training_overview_no_crash.yaml` | TrainingsOverview no-crash regression (post-RC2) | High | `GH-117_no_crash_smoke` | **Keep** as the canonical TrainingsOverview crash test. Stable PASS in r6. |
| 16 | `gh157_ai_chat_prototype.yaml` | AI chat overlay prototype | Low | `gh159_settings_model_input`, `gh95_ai_coach_settings` | **Remove until merged**. Feature is behind-flag / not on master; flow asserts UI that does not exist on a release build. Re-add when AI chat ships. |
| 17 | `gh159_settings_model_input.yaml` | Anthropic Claude model input field in Settings | Low | `gh95_ai_coach_settings`, `gh157_ai_chat_prototype` | **Remove until merged** — same as #16. |
| 18 | `gh169_frequency_exercise_no_crash.yaml` | Frequency-by-exercise screen no-crash | Medium | `gh97_frequency_metric` | **Keep** but rewrite — currently fails with no log step (gRPC drop or post-import nav). Same pattern as Bucket A; a follow-up should apply the GH-225 launchApp + tab-pin pattern. |
| 19 | `gh177_playback_evidence.yaml` | Video playback overlay scrubber smoothness | Medium | `gh207_progress_bar_evidence`, `video_analysis_reps_velocity` | **Keep**. Specific to the GH-177 long-running scrubber regression. Requires a `Status: done` analysis with a real `localVideoPath` — DATA-DEP if baseline lacks one. |
| 20 | `gh195_r4_evidence.yaml` | GH-195 round-4 evidence path (Playback Overlay) | Medium | `gh195_rest_timer_and_1rm`, `gh177_playback_evidence` | **Merge with `gh177_playback_evidence`** — both are evidence-only flows for video playback. Consolidate into one. |
| 21 | `gh195_rest_timer_and_1rm.yaml` | Rest timer + 1RM card during set | High | `02_add_workout_set` | **Keep, fix** — currently fails because the baseline doesn't have an active training session (DATA-DEP). A follow-up should start a training in the flow before the assertion. |
| 22 | `gh200_video_analysis_screen.yaml` | Video Analyses tab from a cold-imported state | Medium | `gh200_video_analysis_screen_warm` | **Remove** — the warm version (#23) covers the same UI without the long import. Cold version times out on gRPC during import. |
| 23 | `gh200_video_analysis_screen_warm.yaml` | Video Analyses tab UI (Filters card, Done pill, Import Video CTA) | Medium | flow #22 | **Keep, scoped down** (this PR) — assertions made data-resilient (single-DONE-analysis baseline). |
| 24 | `gh204_training_home_dashboard.yaml` | Post-GH-204 dashboard (MicroHeroCard + DayStrip + NextTrainingCard) | Critical | `01_training_smoke`, `gh77_dashboard_smoke` | **Keep**. The reference flow for post-GH-204 testIDs. |
| 25 | `gh207_progress_bar_evidence.yaml` | Progress-bar evidence on a video analysis | Medium | `gh177_playback_evidence`, `video_analysis_reps_velocity` | **Merge with `gh177_playback_evidence`** — same target, different filename. |
| 26 | `gh221_smoke.yaml` | GH-221 day-strip + segmented-buttons smoke | Medium | `gh221_this_week_checkmark`, `gh204_training_home_dashboard` | **Keep**. Day-strip checkmark is a recent GH-221 regression target. |
| 27 | `gh221_this_week_checkmark.yaml` | This-week day strip + checkmark visible on completed days | Medium | `gh221_smoke` | **Merge with `gh221_smoke`** — overlaps; one flow can cover both day-strip + segmented-buttons assertions. |
| 28 | `gh77_dashboard_smoke.yaml` | Dashboard smoke (MicroHeroCard) | High | `01_training_smoke`, `gh204_training_home_dashboard` | **Remove** — fully covered by `gh204_training_home_dashboard` post-GH-204. |
| 29 | `gh95_ai_coach_settings.yaml` | AI Coach settings appears in Settings tab | Low | `gh159_settings_model_input`, `gh157_ai_chat_prototype` | **Remove until merged** (same reason as #16/#17). |
| 30 | `gh97_frequency_metric.yaml` | Analyse → frequency metric chip visible | Medium | `gh169_frequency_exercise_no_crash` | **Keep**. Stable PASS, frequency metric is a primary Analyse target. |
| 31 | `gh97_import_warm.yaml` | Re-import baseline.gains and verify warm reload | Medium | `00_import_baseline` | **Remove** — duplicated path of `00_import_baseline`; the warm-reload semantic isn't asserted distinctly enough to justify a second flow. |
| 32 | `smoke.yaml` | App-wide smoke (Training tab + Settings tab reachable) | Critical | `01_training_smoke`, `99_smoke` | **Keep** — the canonical smoke flow post-GH-225 (self-contained, no runFlow chain). |
| 33 | `suite.yaml` | CI suite that runs the stable sub-flows in order | High | `01_training_smoke`, `02_add_workout_set`, `08_training_length` | **Keep** — the orchestrator-driven CI suite, trimmed in GH-225 to only call passing sub-flows. |
| 34 | `trn004_drawer_no_highlight.yaml` | Drawer item is not highlighted when on TrainingPlan tab | Low | `trn004_meso_create_verify` | **Remove** — depends on a plan named "TRN004 Test Plan" that the baseline doesn't have, and asserts cosmetic state (highlight) better suited to a unit test. |
| 35 | `trn004_meso_create_verify.yaml` | Create plan → verify Meso 1 chip + drawer Mesos section | High | `trn004_meso_verify` | **Keep**. Currently the only flow that drives the meso creation path end-to-end. |
| 36 | `trn004_meso_verify.yaml` | Training Home renders after import; baseline plan visible | Medium | `01_training_smoke`, `trn004_meso_create_verify` | **Keep, scoped down** (this PR) — original "Meso 1" assertion was fundamentally wrong for the no-meso baseline. The flow now asserts what the baseline actually proves. |
| 37 | `trn004_r4_feedback_fixes.yaml` | TRN-004 round-4 feedback fixes | Low | `trn004_meso_create_verify` | **Remove** — feedback-round flow tied to a closed PR. The `delete-meso-1 is not visible` polarity bug shows the assertion no longer reflects reality. |
| 38 | `trn005_edit_training_times.yaml` | EditTraining → time picker on a FINISHED training | Medium | `08_training_length` | **Keep, fix** — `edit-training-open-times-modal` testID lives inside an `accessible={true}` ScrollView (see agent-memory #94). Same pattern as #6: rewrite to use a Maestro-reachable anchor or move to unit tests. |
| 39 | `trn005_smoke_launch.yaml` | App launch smoke — process starts cleanly | Low | `01_training_smoke`, `99_smoke` | **Remove** — overlaps `01_training_smoke`. |
| 40 | `video_analysis_filter.yaml` | Video analysis filter chips (RIR / VL / range) | Medium | `video_analysis_reps_velocity`, `gh200_video_analysis_screen_warm` | **Merge with `gh200_video_analysis_screen_warm`** — same screen, overlapping assertions. The `Analysis #N` text wait is data-dependent. |
| 41 | `video_analysis_reps_velocity.yaml` | Reps count + velocity in the video analysis list card | Medium | `video_analysis_filter`, `gh177_playback_evidence` | **Remove** — depends on Playback Overlay having computed `setResult.velocityLossPercent` first (memory #67). Fragile; covered by unit tests on `dispatchSaveVideoAnalysisSetResult`. |

## Recommended consolidated test pyramid

A trim following the recommendations above leaves a 13-flow pyramid:

### Smoke (3)

| Flow | Purpose |
|------|---------|
| `smoke.yaml` | Self-contained app-launch + Training + Settings reachable. |
| `01_training_smoke.yaml` | Training Home renders, add-plan FAB present. |
| `gh204_training_home_dashboard.yaml` | Post-GH-204 dashboard testIDs (MicroHeroCard, DayStrip, NextTrainingCard). |

### Critical-path (5)

| Flow | Purpose |
|------|---------|
| `00_import_baseline.yaml` | Bootstrap import (used as runFlow by others). |
| `02_add_workout_set.yaml` | Add a set + verify training duration timer. |
| `gh119_training_overview_no_crash.yaml` | TrainingsOverview render without GH-117/119 crash. |
| `gh195_rest_timer_and_1rm.yaml` | Rest timer + 1RM card during a STARTED training. |
| `trn004_meso_create_verify.yaml` | End-to-end meso create + verify + add-meso. |

### Feature-specific (5)

| Flow | Purpose |
|------|---------|
| `gh97_frequency_metric.yaml` | Analyse frequency metric chip. |
| `gh169_frequency_exercise_no_crash.yaml` | Frequency-by-exercise no-crash. |
| `gh200_video_analysis_screen_warm.yaml` | Video Analyses tab UI + Filters expand. |
| `gh177_playback_evidence.yaml` | Playback overlay scrubber smoothness (consolidated with gh195_r4 + gh207). |
| `analyse_date_range_picker.yaml` | Analyse date range picker. |

### Suite-wrapper (1, optional)

| Flow | Purpose |
|------|---------|
| `suite.yaml` | CI batch that chains the stable sub-flows for one-shot regression coverage. |

## Notes on quality gaps

1. **Many flows assert visibility, not value.** Per agent-memory: `assertVisible: id: "..."` only proves the element exists — not that its content is correct. Several flows in this audit would benefit from `copyTextFrom` + `assertTrue` patterns for any number/date/computed string they care about.
2. **Single-DONE-analysis baseline.** The current `__tests__/testdata/1772318214222.gains` produces exactly one video analysis in `done` state and zero in `queued/failed`. Multiple flows over-asserted on those pills (Bucket A in r6); the audit recommends data-resilient assertions or a richer fixture as a second-step improvement.
3. **`react-native-paper` `DataTable.Title` + `Card.Title` inside `RangeSwiper`'s `GestureDetector` are invisible to UIAutomator on real devices.** This is a pre-existing app-side limitation; flows that rely on those subtrees (`MetricsOverviewForWorkouts`, the EditTraining time modal in `trn005_edit_training_times`) cannot be reliably driven through Maestro until the app subtree is flattened or marked `accessible={false}` at the gesture boundary.
4. **AI chat / AI Coach flows target unmerged feature work.** Remove until the gating PRs land on master.
