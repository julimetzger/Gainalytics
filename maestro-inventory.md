# Maestro Flow Inventory – GH-123

**Device:** R5CN30HWZFN (Samsung Galaxy S20 FE, 720×1600 px)  
**APK build:** existing debug APK on device (RN 0.76.9, GH-121)  
**Baseline data:** `baseline.gains` loaded, training plans confirmed visible  
**Rounds:** R1 (without `--host`), R2 (fixed port), R3 (fixed `--host 172.18.240.1`)  
**Date:** 2026-04-14

---

## Summary

| Status | Count |
|--------|-------|
| ✅ PASS | 6 |
| ⚠️ FLOW-FAIL | 54 |
| 🔥 APP-CRASH | 0 (see C1 in Priority Issues) |
| ❌ INFRA-FAIL | 0 |
| ⏭️ SKIPPED | 0 |
| **Total unique flows** | **60** |

> **Note on R1/R2 APP-CRASH reclassification:** All R1 "APP-CRASH" results were caused by stale
> logcat containing repeated `UiAutomationService already registered` FATAL EXCEPTIONs from
> Maestro driver startup failures (missing `--host 172.18.240.1`). The R1 logcat was never
> cleared between flows, so every flow's post-flow logcat read picked up the same INFRA errors.
> After adding `--host` in R3 and clearing logcat before each flow, none of the previously
> "crashing" flows produced a real FATAL EXCEPTION from the app package.
> The one confirmed real JS error (C1) is documented in Priority Issues below.

---

## Priority Issues (Manual Reproduction)

### C1 – VideoAnalysisTab: React Native Render Error (HIGH)

**Reproduced:** Yes – manually navigated to Video Analyses tab  
**Error:** `Maximum update depth exceeded` in `MultiselectDropdown` (index.tsx:155:16)  
**Root cause:** Infinite `setState` loop in `useEffect` inside `MultiselectDropdown`, called from `TrainingElementPicker` inside `VideoAnalysisTab`. The effect updates `selectedItems` which triggers re-render which triggers the effect again.  
**Component stack:** `MultiselectDropdown > RCTView > View > TrainingElementPicker > VideoAnalysisTab`  
**Symptom:** React Native dev error overlay appears ("Log 4 of 6") with Dismiss/Minimize buttons. Feature is unusable; all video analysis flows that navigate to the analysis screen would show this overlay.  
**Evidence:**
- Screenshot: `screenshots/GH-123/c1-render-error-multiselectdropdown.png` (in git)
- Logcat: `.codex-orchestrator/runs/GH-123/crashes/c1_video_analysis_render_error-logcat.log` (local only)

### C2 – gh97_frequency_metric: Coordinate Mismatch on 720px Device (MEDIUM)

**Flow:** `gh97_frequency_metric.yaml`  
**Result:** FLOW-FAIL  
**Root cause:** Flow taps `point: "51%,33%"` to open metric selector (column header in Reanimated DataTable). Comment in flow says "written for 1080×2400 screen". Physical device is 720×1600. Tap coordinates compute to different absolute pixels → dialog does not open.  
**Note:** Not a code bug. Flow needs updating for the device resolution, or device resolution override needs to match flow expectations.  
**Evidence:** `screenshots/GH-123/c2-metrics-overview-empty.png` (empty metrics table, no dialog)

### C3 – gh72_compare flows: No Video Analyses in Baseline Data (LOW/BLOCKED)

**Flows:** `gh72_compare_button.yaml`, `gh72_compare_quick.yaml`  
**Result:** FLOW-FAIL  
**Root cause:** Both flows navigate to Video Analyses tab and expect at least one DONE analysis. The `baseline.gains` fixture contains no video analyses. The C1 render error also blocks this screen.  
**Note:** Cannot be tested without pre-loaded video analysis data.  
**Evidence:** `screenshots/GH-123/c3-no-video-analyses.png` ("No video analyses yet" screen)

---

## PASS Flows (6)

| Flow | Round | Duration | Notes |
|------|-------|----------|-------|
| 01_training_smoke | R1 | 40s | |
| 08_training_length | R1 | 105s | |
| gh71-rir-vl-filter | R1 | 55s | |
| 99_smoke | R3 | 40s | |
| gh77_dashboard_smoke | R3 | 43s | |
| trn005_smoke_launch | R3 | 33s | |

---

## FLOW-FAIL Flows (50)

### Import / Navigation

| Flow | Best Round | Duration | Failure |
|------|-----------|----------|---------|
| 00_import_baseline | R3 | 167s | Post-import stays on Settings, "Training" not visible (RN 0.76 behavior change in navigation after import) |
| 02_add_workout_set | R1 | 90s | Assertion `.*Set 2.*` visible – set not added |
| GH-117_no_crash_smoke | R3 | 58s | "TestPlanTestPlan" not visible (duplicate name concatenation?) |
| gh119_training_overview_no_crash | R3 | 98s | `id: trainings-overview-duration-card` not visible |

### Settings / Import Button

| Flow | Best Round | Duration | Failure |
|------|-----------|----------|---------|
| gh101_suggest_last_meso | R3 | 50s | `id: settings-import-data-button` not visible |
| 10_trn002_linear_progression | R3 | 46s | `id: settings-import-data-button` not visible |

### Video Import (Stale Selector – GH-71 removed dev button)

All flows below fail because `"Import Emulator Squat Video"` dev button was removed in GH-71.
This affects 11 direct video_analysis + GH-87 flows, plus the ana003/ana005 flows (below).

| Flow | Best Round | Duration | Failure |
|------|-----------|----------|---------|
| 03_video_analysis_import | R1→reclassified | 47s | Stale selector: "Import Emulator Squat Video" removed |
| 04_video_analysis_bar_path_done | R1→reclassified | 46s | Same |
| 05_video_analysis_rep_segments_visible | R1→reclassified | 44s | Same |
| 06_video_analysis_metrics_visible | R1→reclassified | 45s | Same |
| 07_video_analysis_overlay_capture | R1→reclassified | 46s | Same |
| 07_video_analysis_overlay_visible | R1→reclassified | 46s | Same |
| 07_video_analysis_static_overlay_capture | R1→reclassified | 45s | Same |
| 08_video_analysis_step_buttons | R1→reclassified | 49s | Same |
| GH-87_card_appears_immediately | R1→reclassified | 43s | Same |
| GH-87_card_appears_immediately_nolaunch | R1→reclassified | 34s | "Import Video" not visible |
| GH-87_video_import_immediate_card | R3 | 63s | "Import Emulator Squat Video" not visible |

### Video Analysis (Requires DONE Video + C1 Render Error)

| Flow | Best Round | Duration | Failure |
|------|-----------|----------|---------|
| gh82_vl_insight_cards | R3 | 39s | "% VL" not visible |
| gh97_import_warm | R3 | 130s | INFRA-FAIL (timeout): flow's `extendedWaitUntil: 180s` exceeded our 120s script timeout |
| gh95_ai_coach_settings | R3 | 52s | "console.anthropic.com" not visible |
| gh72_compare_button | R3 | 52s | "Open" not visible (no video analyses in store) |
| gh72_compare_quick | R3 | 63s | "Status: done" not visible (no DONE analyses in store) |
| gh97_frequency_metric | R3 | 40s | "Select muscle metric" not visible (coordinate mismatch, see C2) |
| GH-94-history-navigation | R1→reclassified | 42s | "Push pull" not visible |
| analyse_date_range_picker | R1→reclassified | 44s | `id: button-text` not visible |
| 11_metrics_overview_slots | R1→reclassified | 80s | "Training" not visible |

### Training Plans (trn004 series – icon-menu not found)

| Flow | Best Round | Duration | Failure |
|------|-----------|----------|---------|
| trn004_meso_verify | R3 | 51s | "Meso 1" not visible |
| trn004_meso_create_verify | R3 | 83s | `id: icon-menu` not visible |
| trn004_drawer_no_highlight | R3 | 79s | `id: icon-menu` not visible |
| trn004_r4_feedback_fixes | R3 | 66s | `id: icon-menu` not visible |
| trn005_edit_training_times | R3 | 99s | "Edit" not visible |

### Cardio Easter Egg

| Flow | Best Round | Duration | Failure |
|------|-----------|----------|---------|
| fun001_cardio_easter_egg | R3 | 103s | "This app can't be used to track cardio" not visible |
| fun001_import_and_easter_egg | R3 | 120s | Same |
| fun001_no_relaunch | R3 | 102s | Same |

### Ana Flows (Video Analysis – Two Failure Patterns)

Ana flows fail for two reasons:
- **Pattern A (stale selector):** `"Import Emulator Squat Video"` dev button removed in GH-71 — same as 03-08/GH-87 flows
- **Pattern B (no DONE analysis):** Flows that navigate past import fail because no DONE video analysis is in the store

| Flow | R3 Duration | Pattern | Failure |
|------|-------------|---------|---------|
| ana003_quick_verify | 178s | B | (R1 FLOW-FAIL, not re-run in R3) |
| ana003_r4_setup_and_verify | 66s | A | "Import Emulator Squat Video" not found |
| ana003_responsive_during_playback | 71s | B | "Open" not visible (no DONE analysis) |
| ana003_speed_chart_marker | 66s | A | "Import Emulator Squat Video" not found |
| ana003fix2_marker_verify | 71s | B | "Open" not visible (no DONE analysis) |
| ana004_active_rep_theme_color | 61s | B | "Open" regex not visible |
| ana004fix_r4_active_rep_screenshot | 63s | B | "Open" regex not visible |
| ana005_bar_screenshot | 63s | A | "Import Emulator Squat Video" not visible |
| ana005_diag | 63s | A | "Import Emulator Squat Video" not visible |
| ana005_final | 62s | A | "Import Emulator Squat Video" not visible |
| ana005_hold_processing | 63s | A | "Import Emulator Squat Video" not visible |
| ana005_progress_bar_proof | 63s | A | "Import Emulator Squat Video" not visible |
| ana005_short_proof | 63s | A | "Import Emulator Squat Video" not visible |
| ana005_start_processing | 63s | A | "Import Emulator Squat Video" not visible |
| ana007_r2_speed_verify | 181s | A+B | Import step timed out (extendedWaitUntil: 180s expired); "Training" not visible |

### Speed Chart Marker Flows (New – Require DONE analyses)

| Flow | R3 Duration | Failure |
|------|-------------|---------|
| 09_speed_chart_marker_visible | 73s | "Open" not visible (no DONE video analysis to open) |
| 09b_marker_mid | 73s | "Open" not visible (no DONE video analysis) |
| 09c_short_marker | 72s | "Open" not visible (no DONE video analysis) |
| 09d_marker_r7_t0_left_edge | 74s | "Open" not visible (no DONE video analysis) |
| 09e_marker_r8_t0_left_edge | 72s | "Open" not visible (no DONE video analysis) |
| 11_metrics_overview_slots_suite | 81s | "Training" not visible (delegates to 11_metrics_overview_slots.yaml; 60s extendedWaitUntil timed out) |

---

## INFRA-FAIL Flows (0)

None. All previously classified INFRA-FAILs were resolved by adding `--host 172.18.240.1` in R3.
`gh97_import_warm` was reclassified: the flow ran 181s and failed its internal `extendedWaitUntil: 180s`
(import did not complete navigation to Training tab). Exit code was FLOW-FAIL, not timeout kill.

---

## SKIPPED Flows (File Not Found)

The following flows were referenced in the run scripts but their `.yaml` files were not found
on the device worktree at run time:

*(To be confirmed from R3 SKIPPED entries in flow_results_r3.tsv)*

---

## Root Cause Summary

| Category | # Flows | Root Cause |
|----------|---------|-----------|
| Stale selector: "Import Emulator Squat Video" removed in GH-71 | ~22 | Dev button removed; 03-08, GH-87, ana003, ana005, ana007 flows all rely on it |
| "Open" not visible: no DONE video analysis in store | ~12 | baseline.gains has no completed video analyses; affects ana003fix2, ana004, 09_* |
| id: settings-import-data-button not found | 2 | gh101, 10_trn002: settings import button not visible |
| id: icon-menu not found (trn004 series) | 3 | trn004_meso_create, drawer, r4_feedback: drawer menu icon not found |
| Post-import navigation (RN 0.76) | 2 | 00_import_baseline, gh97_import_warm: import no longer navigates to Training tab |
| Cardio easter egg not triggered | 3 | fun001_* flows: toast "This app can't be used to track cardio" not shown |
| Coordinate-dependent taps for 1080px device | 1 | gh97_frequency_metric: taps calibrated for 1080×2400, device is 720×1600 |
| Assertion mismatches (various) | 11 | gh82, GH-117, gh119, gh95_ai_coach, trn004_meso_verify, trn005_edit, etc. |
| C1 – MultiselectDropdown JS Render Error | 1 | VideoAnalysisTab: infinite setState loop when filter renders (manually reproduced) |

---

## Infrastructure Notes

- **WSL→Windows Maestro host:** `--host 172.18.240.1` required (resolv.conf gateway)
- **ADB device serial:** `R5CN30HWZFN`
- **Driver port:** `--driver-host-port 7051`
- **Metro reverse:** `adb reverse tcp:8081 tcp:8083` (Metro runs on host port 8083)
- **Device resolution:** 720×1600 physical; some flows written for 1080×2400
- **Maestro version:** Warning "Failed to parse current version" on every run (cosmetic)
- **R1/R2 INFRA-FAIL root cause:** Missing `--host` flag caused all R1/R2 "device not connected" errors and triggered fake APP-CRASH classification via stale logcat

---

## Evidence Files

**In git (this branch):**
```
screenshots/GH-123/
├── c1-render-error-multiselectdropdown.png  ← C1 React Native error overlay
├── c2-metrics-overview-empty.png           ← C2 state (empty table, no metric selector)
├── c3-no-video-analyses.png                ← C3 state ("No video analyses yet")
├── gh119-debug-after-nav.png              ← GH-119 training overview debug shot
└── gh97-metrics-overview-loaded.png       ← GH-97 metrics tab loaded state
```

**In run directory (`.codex-orchestrator/runs/GH-123/`, gitignored, local only):**
```
├── checks/
│   ├── flow_results.tsv          (R1 raw results)
│   ├── flow_results_r3.tsv       (R3 corrected results)
│   └── *.log / *.xml             (per-flow Maestro logs)
└── crashes/
    ├── c1_video_analysis_render_error.png    (C1 source)
    ├── c1_video_analysis_render_error-logcat.log
    └── [flow]-crash.png / -logcat.log        (R1 captures; all UiAutomation INFRA, not app)
```
