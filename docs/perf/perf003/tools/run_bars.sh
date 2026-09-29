#!/bin/bash
# usage: run_bars.sh <prefix> bar1 bar2 ...
cd /home/jmetzger/projects/PowerliftingWorkoutPlanner/.worktrees/feature-PERF-003
pre=$1; shift
for b in "$@"; do
  case $b in hero) secs=50;; sub) secs=60;; data) secs=60;; overview) secs=60;; sort) secs=90;; drawer) secs=60;; esac
  prep=prep$(echo ${b:0:1} | tr a-z A-Z)${b:1}
  bash docs/perf/perf003/tools/measure.sh /home/jmetzger/projects/PowerliftingWorkoutPlanner/.codex-orchestrator/runs/PERF-003/raw/$pre-bar-$b $secs bar_$b $prep 2>&1 | tail -3 | cut -c1-2500
done
echo ALLDONE
