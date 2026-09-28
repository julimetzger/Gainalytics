#!/bin/bash
# usage: scn.sh <name> <perfetto_secs> <interaction function name>   (sources fns from scenarios.sh)
R=/home/jmetzger/projects/PowerliftingWorkoutPlanner/.codex-orchestrator/runs/PERF-001
A=/tmp/a.sh; P=com.powerliftingworkoutplanner
name=$1; secs=$2; fn=$3
source $R/raw/tools/scenarios.sh
mkdir -p $R/raw/$name
$A shell dumpsys gfxinfo $P reset >/dev/null
sed "s/duration_ms: 90000/duration_ms: $((secs*1000))/" $R/raw/tools/perfetto.cfg > /tmp/pf.cfg
$A shell "rm -f /data/misc/perfetto-traces/$name.pftrace"
( $A shell "perfetto -c - --txt -o /data/misc/perfetto-traces/$name.pftrace" < /tmp/pf.cfg > $R/raw/$name/perfetto.log 2>&1 ) &
PF=$!
sleep 3
date +%s.%N > $R/raw/$name/t_interact_start
$fn > $R/raw/$name/interaction.log 2>&1
date +%s.%N > $R/raw/$name/t_interact_end
$A shell dumpsys gfxinfo $P framestats > $R/raw/$name/gfxinfo-framestats.txt
$A shell dumpsys gfxinfo $P > $R/raw/$name/gfxinfo.txt
wait $PF
$A pull /data/misc/perfetto-traces/$name.pftrace $R/raw/$name/trace.pftrace >/dev/null 2>&1
python3 $R/raw/tools/gfx.py $R/raw/$name/gfxinfo-framestats.txt | tee $R/raw/$name/gfx-summary.json
