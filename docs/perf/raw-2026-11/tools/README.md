# PERF-004 measurement tools

PERF-001 method (`docs/perf/device-measurement.md`), scripts re-used and adapted to the UI of master `7b289e66`.
Coordinates are in the `wm size` override space 720x1600 of the Samsung SM-G986B.

| File | What it does |
|---|---|
| `a.sh` | adb with a timeout, pinned to `$ANDROID_SERIAL` (uses the inherited `ADB_SERVER_SOCKET`) |
| `perfetto.cfg` | Perfetto config (ftrace sched + atrace view/gfx/input/am/wm/res + SurfaceFlinger frame timeline), identical to PERF-001 |
| `scenarios.sh` | interaction functions per scenario (re-measured coordinates, comments say what changed against PERF-001) |
| `measure.sh <series> <secs> <fn> [prep]` | prep (untraced) -> `gfxinfo reset` -> Perfetto -> interaction -> gfxinfo/meminfo -> `gestures.py` |
| `scn1.sh` | 12 cold + 12 warm starts (`am start -W`) + 5 traced cold starts (`coldstart.py`) |
| `scn8.sh [runs\|steps]` | PSS after cold start and after one round through all tabs (5 runs) / stepwise |
| `gestures.py` | per-gesture analysis (PERF-001 `settle_ms`, `js_busy_ms`, frames, created views + PERF-003 `sel_visible_ms`/`content_done_ms`) |
| `bursts.py` | JS-thread burst structure per gesture + idle baseline (`scn2-save/burst-structure.txt`) |
| `coldstart.py`, `gfx.py` | cold-start breakdown / `dumpsys gfxinfo framestats` summary (PERF-001) |
| `aggregate.py` | all series -> `../summary.json` (same keys as PERF-001 + new series) |
| `compare.py` | `../summary-perf001.json` vs `../summary.json` -> `../comparison.md` |
| `counts.py`, `mmkv_slices.py` | data counts + content fingerprints of a `.gains` export / of the redux-persist value in an MMKV file |
| `ui.sh`, `shot.sh` | uiautomator dump with centres / resized screenshot |
| `perf004-readonly-check.yaml` | read-only Maestro check after the measurement (no clearState, no import) |

Trace processor: symlink `tp` next to the scripts -> `~/.local/share/perfetto/prebuilts/trace_processor_shell-*`.
The Perfetto traces themselves (25–45 MB per series) are only in the run directory `.codex-orchestrator/runs/PERF-004/raw/<series>/trace.pftrace`.
