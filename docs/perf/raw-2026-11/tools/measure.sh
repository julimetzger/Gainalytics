#!/bin/bash
# usage: measure.sh <series-name> <secs> <interaction fn> [prep fn]   (fns come from scenarios.sh)
# PERF-001 method: prep (untraced) -> gfxinfo reset -> perfetto (config via stdin, <secs>) -> interaction -> gfxinfo/meminfo -> analysis
T=$(dirname "$(readlink -f "$0")"); R=$(dirname $(dirname $T))
A=$T/a.sh; P=com.powerliftingworkoutplanner
name=$1; secs=$2; fn=$3; prep=$4; D=$R/raw/$name; dev=$(echo $name | tr / -)
source $T/scenarios.sh
mkdir -p $D
fg_guard || { echo "ABORT: app not in foreground before $name"; exit 1; }
[ -n "$prep" ] && $prep > $D/prep.log 2>&1
fg_guard || { echo "ABORT: app not in foreground after prep $name"; exit 1; }
$A shell dumpsys battery | grep -E 'level|temperature' | tr -d '\n' > $D/conditions.txt
$A shell dumpsys gfxinfo $P reset >/dev/null
sed "s/duration_ms: 90000/duration_ms: $((secs*1000))/" $T/perfetto.cfg > /tmp/perf004-pf.cfg
$A shell "rm -f /data/misc/perfetto-traces/$dev.pftrace"
( ADB_TIMEOUT=$((secs+60)) $A shell "perfetto -c - --txt -o /data/misc/perfetto-traces/$dev.pftrace" < /tmp/perf004-pf.cfg > $D/perfetto.log 2>&1 ) &
PF=$!
sleep 3
date +%s.%N > $D/t_interact_start
$fn > $D/interaction.log 2>&1
date +%s.%N > $D/t_interact_end
$A shell dumpsys gfxinfo $P framestats > $D/gfxinfo-framestats.txt
$A shell dumpsys gfxinfo $P > $D/gfxinfo.txt
$A shell dumpsys meminfo $P > $D/meminfo.txt
wait $PF
$A pull /data/misc/perfetto-traces/$dev.pftrace $D/trace.pftrace >/dev/null 2>&1
$A shell "rm -f /data/misc/perfetto-traces/$dev.pftrace"
python3 $T/gfx.py $D/gfxinfo-framestats.txt > $D/gfx-summary.json
(cd /tmp && timeout 900 python3 $T/gestures.py $D/trace.pftrace > $D/gestures.json 2> $D/gestures.err)
python3 - "$D" <<'PY'
import json,sys
d=sys.argv[1]; g=json.load(open(d+'/gfx-summary.json')); s=json.load(open(d+'/gestures.json'))
print(d.split('/')[-1], 'gfxinfo janky',g['janky_pct'],'% p50/p90/p99',g['gfx_50th'],g['gfx_90th'],g['gfx_99th'])
print(' gestures',s['n_gestures'])
for k in ['settle_ms','js_busy_ms','gt33','max_frame_ms','views_created']: print('  ',k,s['summary'][k])
PY
