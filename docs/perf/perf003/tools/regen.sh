#!/bin/bash
# usage: regen.sh <prefix> ...   (re-run gestures.py on every trace of the given run-dir prefixes)
# PERF003_WORKTREE: checkout to measure (default: the git checkout containing this script, else $PWD)
# PERF003_RUN_DIR:  PERF-003 run directory (default <main repo>/.codex-orchestrator/runs/PERF-003)
T=$(dirname "$(readlink -f "$0")")
W=${PERF003_WORKTREE:-$(git -C "$T" rev-parse --show-toplevel 2>/dev/null || pwd)}
M=$(dirname "$(git -C "$W" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || echo "$W/.git")")
RUN=${PERF003_RUN_DIR:-$M/.codex-orchestrator/runs/PERF-003}
R=$RUN/raw
cd /tmp
for p in "$@"; do for d in $R/$p-*/; do [ -f $d/trace.pftrace ] && python3 $T/gestures.py $d/trace.pftrace > $d/gestures.json 2>/dev/null; done; done
