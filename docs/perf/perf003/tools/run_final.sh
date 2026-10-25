#!/bin/bash
# usage: run_final.sh <prefix>  -> swipes (3 sub-tabs), first-visit swipes (3 runs), memory (5 runs), bars (6)
# PERF003_WORKTREE: checkout to measure (default: the git checkout containing this script, else $PWD)
# PERF003_RUN_DIR:  PERF-003 run directory (default <main repo>/.codex-orchestrator/runs/PERF-003)
T=$(dirname "$(readlink -f "$0")")
W=${PERF003_WORKTREE:-$(git -C "$T" rev-parse --show-toplevel 2>/dev/null || pwd)}
M=$(dirname "$(git -C "$W" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || echo "$W/.git")")
RUN=${PERF003_RUN_DIR:-$M/.codex-orchestrator/runs/PERF-003}
R=$RUN/raw
P=$1
cd $W
/tmp/run_swipes.sh $P train plan analysis
for i in 1 2 3; do bash docs/perf/perf003/tools/measure.sh $R/$P-fwd-$i 45 scnFwd prepFwd 2>&1 | tail -2 | cut -c1-400; done
bash docs/perf/perf003/tools/mem3.sh $R/$P-mem 5 > $R/$P-mem.log 2>&1
/tmp/run_bars.sh $P hero sub data overview sort drawer
echo FINAL_ALLDONE
