#!/bin/bash
cd /home/jmetzger/projects/PowerliftingWorkoutPlanner/.worktrees/feature-PERF-003
pre=$1; shift
for s in "$@"; do bash docs/perf/perf003/tools/measure.sh /home/jmetzger/projects/PowerliftingWorkoutPlanner/.codex-orchestrator/runs/PERF-003/raw/$pre-scn3-$s 108 scn3 prep3$s 2>&1 | tail -3 | cut -c1-2500; done
echo ALLDONE
