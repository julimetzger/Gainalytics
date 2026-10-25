#!/bin/bash
# usage: run_final.sh <prefix>  -> swipes (3 sub-tabs), first-visit swipes (3 runs), memory (5 runs), bars (6)
# PERF003_WORKTREE: checkout to measure (default: the git checkout containing this script, else $PWD)
# PERF003_RUN_DIR:  PERF-003 run directory (default <main repo>/.codex-orchestrator/runs/PERF-003)
S=$(dirname "$(readlink -f "$0")")
W=${PERF003_WORKTREE:-$(git -C "$S" rev-parse --show-toplevel 2>/dev/null || pwd)}
T=$W/docs/perf/perf003/tools   # analyzers always come from the checkout, never from a copied script's dir
M=$(dirname "$(git -C "$W" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || echo "$W/.git")")
RUN=${PERF003_RUN_DIR:-$M/.codex-orchestrator/runs/PERF-003}
R=$RUN/raw
P=$1
cd $W
bash "$T/run_swipes.sh" $P train plan analysis
for i in 1 2 3; do bash "$T/measure.sh" $R/$P-fwd-$i 45 scnFwd prepFwd 2>&1 | tail -2 | cut -c1-400; done
bash "$T/mem3.sh" $R/$P-mem 5 > $R/$P-mem.log 2>&1
bash "$T/run_bars.sh" $P hero sub data overview sort drawer
echo FINAL_ALLDONE
