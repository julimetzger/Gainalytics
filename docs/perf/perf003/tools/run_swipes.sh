#!/bin/bash
# PERF003_WORKTREE: checkout to measure (default: the git checkout containing this script, else $PWD)
# PERF003_RUN_DIR:  PERF-003 run directory (default <main repo>/.codex-orchestrator/runs/PERF-003)
T=$(dirname "$(readlink -f "$0")")
W=${PERF003_WORKTREE:-$(git -C "$T" rev-parse --show-toplevel 2>/dev/null || pwd)}
M=$(dirname "$(git -C "$W" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || echo "$W/.git")")
RUN=${PERF003_RUN_DIR:-$M/.codex-orchestrator/runs/PERF-003}
R=$RUN/raw
cd $W
pre=$1; shift
for s in "$@"; do bash docs/perf/perf003/tools/measure.sh $R/$pre-scn3-$s 108 scn3 prep3$s 2>&1 | tail -3 | cut -c1-2500; done
echo ALLDONE
