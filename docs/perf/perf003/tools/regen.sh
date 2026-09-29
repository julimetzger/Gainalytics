#!/bin/bash
# usage: regen.sh <prefix> ...   (re-run gestures.py on every trace of the given run-dir prefixes)
R=/home/jmetzger/projects/PowerliftingWorkoutPlanner/.codex-orchestrator/runs/PERF-003/raw
T=/home/jmetzger/projects/PowerliftingWorkoutPlanner/.worktrees/feature-PERF-003/docs/perf/perf003/tools
cd /tmp
for p in "$@"; do for d in $R/$p-*/; do [ -f $d/trace.pftrace ] && python3 $T/gestures.py $d/trace.pftrace > $d/gestures.json 2>/dev/null; done; done
