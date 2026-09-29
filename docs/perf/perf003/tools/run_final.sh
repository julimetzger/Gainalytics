#!/bin/bash
# usage: run_final.sh <prefix>  -> swipes (3 sub-tabs), first-visit swipes (3 runs), memory (5 runs), bars (6)
P=$1
R=/home/jmetzger/projects/PowerliftingWorkoutPlanner/.codex-orchestrator/runs/PERF-003/raw
W=/home/jmetzger/projects/PowerliftingWorkoutPlanner/.worktrees/feature-PERF-003
cd $W
/tmp/run_swipes.sh $P train plan analysis
for i in 1 2 3; do bash docs/perf/perf003/tools/measure.sh $R/$P-fwd-$i 45 scnFwd prepFwd 2>&1 | tail -2 | cut -c1-400; done
bash docs/perf/perf003/tools/mem3.sh $R/$P-mem 5 > $R/$P-mem.log 2>&1
/tmp/run_bars.sh $P hero sub data overview sort drawer
echo FINAL_ALLDONE
