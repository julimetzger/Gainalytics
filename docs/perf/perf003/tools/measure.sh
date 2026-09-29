#!/bin/bash
# usage: measure.sh <outdir> <secs> <interaction fn> [prep fn]     (fns come from scenarios3.sh)
# prep (untraced) -> gfxinfo reset -> perfetto (config via stdin, duration <secs>) -> interaction -> gfxinfo/meminfo -> analysis
T=$(dirname "$(readlink -f "$0")")
A=/tmp/a.sh; P=com.powerliftingworkoutplanner
D=$1; secs=$2; fn=$3; prep=$4
source $T/scenarios3.sh
mkdir -p $D
[ -n "$prep" ] && $prep > $D/prep.log 2>&1
$A shell dumpsys gfxinfo $P reset >/dev/null
sed "s/duration_ms: 90000/duration_ms: $((secs*1000))/" $T/perfetto.cfg > /tmp/pf.cfg
name=$(basename $D)
$A shell "rm -f /data/misc/perfetto-traces/$name.pftrace"
( ADB_TIMEOUT=300 $A shell "perfetto -c - --txt -o /data/misc/perfetto-traces/$name.pftrace" < /tmp/pf.cfg > $D/perfetto.log 2>&1 ) &
PF=$!
sleep 3
date +%s.%N > $D/t_interact_start
$fn > $D/interaction.log 2>&1
date +%s.%N > $D/t_interact_end
$A shell dumpsys gfxinfo $P framestats > $D/gfxinfo-framestats.txt
$A shell dumpsys gfxinfo $P > $D/gfxinfo.txt
$A shell dumpsys meminfo $P > $D/meminfo.txt
wait $PF
$A pull /data/misc/perfetto-traces/$name.pftrace $D/trace.pftrace >/dev/null 2>&1
$A shell "rm -f /data/misc/perfetto-traces/$name.pftrace"
python3 $T/gfx.py $D/gfxinfo-framestats.txt > $D/gfx-summary.json
(cd /tmp && timeout 900 python3 $T/gestures.py $D/trace.pftrace > $D/gestures.json 2> $D/gestures.err)
python3 - "$D" <<'PY'
import json,sys
d=sys.argv[1]; g=json.load(open(d+'/gfx-summary.json')); s=json.load(open(d+'/gestures.json'))
print(d.split('/')[-1], 'gfxinfo janky',g['janky_pct'],'% p50/p90/p99',g['gfx_50th'],g['gfx_90th'],g['gfx_99th'])
print(' gestures',s['n_gestures'], json.dumps(s['summary']))
PY
