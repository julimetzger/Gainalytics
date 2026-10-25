#!/bin/bash
# usage: run_bars.sh <prefix> bar1 bar2 ...
# PERF003_WORKTREE: checkout to measure (default: the git checkout containing this script, else $PWD)
# PERF003_RUN_DIR:  PERF-003 run directory (default <main repo>/.codex-orchestrator/runs/PERF-003)
S=$(dirname "$(readlink -f "$0")")
W=${PERF003_WORKTREE:-$(git -C "$S" rev-parse --show-toplevel 2>/dev/null || pwd)}
T=$W/docs/perf/perf003/tools   # analyzers always come from the checkout, never from a copied script's dir
M=$(dirname "$(git -C "$W" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || echo "$W/.git")")
RUN=${PERF003_RUN_DIR:-$M/.codex-orchestrator/runs/PERF-003}
R=$RUN/raw
cd $W
pre=$1; shift
for b in "$@"; do
  case $b in hero) secs=50;; sub) secs=60;; data) secs=60;; overview) secs=60;; sort) secs=90;; drawer) secs=60;; esac
  prep=prep$(echo ${b:0:1} | tr a-z A-Z)${b:1}
  bash "$T/measure.sh" $R/$pre-bar-$b $secs bar_$b $prep 2>&1 | tail -3 | cut -c1-2500
done
echo ALLDONE
