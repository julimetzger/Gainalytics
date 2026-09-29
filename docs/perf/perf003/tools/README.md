# PERF-003 measurement tools

Method and scripts of PERF-001 (`feature/PERF-001`, PR #463), trimmed to what PERF-003 uses and extended:

| File | What it does |
|---|---|
| `perfetto.cfg` | Perfetto config (ftrace sched + atrace view/gfx/input/am/wm/res + SurfaceFlinger frame timeline) |
| `scenarios3.sh` | interaction functions for the device (720x1600 override): Scenario 3 swipes, first-visit swipes, one function per toggle bar |
| `measure.sh <dir> <secs> <fn> [prep]` | prep (untraced) -> `gfxinfo reset` -> Perfetto -> interaction -> gfxinfo/meminfo -> analysis |
| `gestures.py` | per-gesture analysis of a trace (PERF-001) + PERF-003 additions: `sel_visible_ms`, `content_done_ms`, `full_visible_ms`, `mount_batches` |
| `gfx.py` | `dumpsys gfxinfo framestats` summary |
| `mem3.sh` | PSS / native heap / views: cold start -> open plan -> swipe to Micro 4 -> 8 swipes |
| `report_tables.py`, `summarize3.py` | median [min-max] tables from the per-gesture values |
| `counts.py` | counts + content fingerprints of a `.gains` export (data-integrity comparison) |
| `adb-wrapper.sh`, `shot.sh`, `run_swipes.sh`, `run_bars.sh`, `run_final.sh`, `regen.sh`, `safe_install.sh` | glue used in the PERF-003 run (adb through the orchestrator proxy with a timeout, resized screenshots, batch runs, export-compare-then-`install -r`) |

The scripts expect `/tmp/a.sh` (= `adb-wrapper.sh`) and the trace processor at `/tmp/tp`
(`~/.local/share/perfetto/prebuilts/trace_processor_shell-*`). Paths to the run directory are set in the glue scripts.
