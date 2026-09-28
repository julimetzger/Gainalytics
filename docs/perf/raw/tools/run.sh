#!/bin/bash
# usage: run.sh <name> <interaction function> [prep function]
# prep (optional, untraced) -> gfxinfo reset -> perfetto start -> interaction -> gfxinfo + meminfo -> perfetto stop/pull -> analysis
R=/home/jmetzger/projects/PowerliftingWorkoutPlanner/.codex-orchestrator/runs/PERF-001
A=/tmp/a.sh; P=com.powerliftingworkoutplanner
name=$1; fn=$2; prep=$3
source $R/raw/tools/scenarios.sh
D=$R/raw/$name; mkdir -p $D
[ -n "$prep" ] && $prep > $D/prep.log 2>&1
$A shell dumpsys gfxinfo $P reset >/dev/null
$A shell "rm -f /data/misc/perfetto-traces/$name.pftrace"
out=$($A shell "perfetto --background --txt -c /data/misc/perfetto-configs/perf001.cfg -o /data/misc/perfetto-traces/$name.pftrace" 2>&1)
pid=$(echo "$out" | tr -d '\r' | tail -1 | grep -oE '[0-9]+$')
echo "perfetto pid=$pid" > $D/perfetto.log
sleep 2
date -Is > $D/t_interact_start
$fn > $D/interaction.log 2>&1
sleep 1.5
date -Is > $D/t_interact_end
$A shell dumpsys gfxinfo $P > $D/gfxinfo.txt
$A shell dumpsys gfxinfo $P framestats > $D/gfxinfo-framestats.txt
$A shell dumpsys meminfo $P > $D/meminfo.txt
$A shell kill -TERM $pid
for i in $(seq 1 30); do $A shell "kill -0 $pid 2>/dev/null" || break; sleep 1; done
$A pull /data/misc/perfetto-traces/$name.pftrace $D/trace.pftrace >> $D/perfetto.log 2>&1
$A shell "rm -f /data/misc/perfetto-traces/$name.pftrace"
python3 $R/raw/tools/gfx.py $D/gfxinfo-framestats.txt > $D/gfx-summary.json
(cd /tmp && timeout 600 python3 $R/raw/tools/gestures.py $D/trace.pftrace > $D/gestures.json 2> $D/gestures.err)
python3 - "$D" <<'EOF'
import json,sys
d=sys.argv[1]; g=json.load(open(d+'/gfx-summary.json')); s=json.load(open(d+'/gestures.json'))
print(d.split('/')[-1], 'frames',g['frames_gfxinfo'],'janky',g['janky_pct'],'% p50/p90/p99',g['gfx_50th'],g['gfx_90th'],g['gfx_99th'])
print(' gestures',s['n_gestures'], json.dumps(s['summary']))
EOF
