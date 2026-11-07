# GH-675 measurement tools (CI emulator, run ON the device)

PERF-004 method (`docs/perf/raw-2026-11/tools/`), adapted for the CI agent job: there is no python / trace_processor on the
runner, so everything runs on the emulator with `atrace` + the device's `awk`. Push the scripts and the shared analysers first:

```
adb push docs/perf/raw-gh675/tools/*.sh docs/perf/raw-gh675/tools/*.awk docs/perf/raw-gh672/tools/gestures.awk \
  docs/perf/raw-gh673/tools/bursts.awk /data/local/tmp/
```

Coordinates are for the 1080x2400 CI emulator (uiautomator), data = `baseline.gains` + one analysed `squat-3reps.mp4`.

| File | What it does |
|---|---|
| `open.sh <label> <ex\|dash\|vdetail> [runs]` | PERF-004 "open" series: cold start, untraced prep, `gfxinfo reset`, atrace, ONE tap, 4 s; per run `gestures.awk` + `frames.awk` |
| `scn5c.sh <label>` | PERF-004 scenario 5c (Metrics, Bankdrücken, week 16-22/02/26 via the range dialog, 10 swipes back + 10 forward) after `prep5c.yaml` |
| `prep5c.yaml` | Maestro, untraced: Analyse -> Metrics Overview, Bankdrücken via Search all, panel collapsed |
| `scn4a.sh <label>` | control: Exercises open + 8 flings down / 8 up (scrolling must stay as before) |
| `frames.awk` | frames per gesture: doFrame + DrawFrames of the same vsync; `max_ui_ms` = UI-thread part (doFrame minus `postAndWait`); `-v win=1500` keeps only the opening window |
| `slices.awk` | all UI-thread slices inside one doFrame (what a long frame did) |
| `mounts.awk` | native views created per frame |
| `heavy.awk` | UI-thread `UPDATE_PROPS` batches / `View#draw` recordings >= N ms (chart re-layouts) |
| `agg.sh <dirs>` / `agg5c.sh <dirs>` | median [min-max] per series (opens / Metrics swipes) |
| `metrics-banner.sh <prefix>` | Metrics: stale banner action (`setRange`) + swipe back + 2x forward, screenshot after each step |
| `shots.sh <prefix> <screens>` | before/after screenshots in fixed states |
| `pixdiff.sh <dir>` | ffmpeg pixel difference before/after (host) |
| `verify-build.sh` | release flags + which JS bundle is installed |
| `export.sh <series>` | copies the results (no traces) into one dir for `adb pull` -> `../runs/` |

Results: `../runs/<series>/`, summary `../runs/summary.txt`, report `docs/perf/gh675-first-open.md`.
Series names: `before-*`/`B2-*` = master `99b9319`, `Z-*` = final `dd68a1a`; `F-*`, `after-*`, `exp-*`, `final-*` = intermediate builds
(listed in the report where they are used).
