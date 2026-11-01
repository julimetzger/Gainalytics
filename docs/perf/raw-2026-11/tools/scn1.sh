#!/bin/bash
# Scenario 1: 12 cold starts + 12 warm starts (am start -W), then 5 cold starts with a Perfetto trace (coldstart.py)
T=$(dirname "$(readlink -f "$0")"); R=$(dirname $(dirname $T)); source $T/scenarios.sh
O=$R/raw/scenario1-start.txt; : > $O
for i in $(seq 1 12); do
  $A shell am force-stop $P; sleep 2
  echo "cold $i: $($A shell am start -W -n $P/.MainActivity | grep -E 'LaunchState|TotalTime' | tr -d '\r' | tr '\n' ' ')" >> $O; sleep 6
done
for i in $(seq 1 12); do
  key 3; sleep 2
  echo "warm $i: $($A shell am start -W -n $P/.MainActivity | grep -E 'LaunchState|TotalTime' | tr -d '\r' | tr '\n' ' ')" >> $O; sleep 3
done
cat $O
D=$R/raw/scn1-coldstart-trace; mkdir -p $D
sed "s/duration_ms: 90000/duration_ms: 12000/" $T/perfetto.cfg > /tmp/perf004-pf1.cfg
for run in 1 2 3 4 5; do
  n=cold$run; $A shell am force-stop $P; sleep 2
  ( ADB_TIMEOUT=60 $A shell "perfetto -c - --txt -o /data/misc/perfetto-traces/$n.pftrace" < /tmp/perf004-pf1.cfg > $D/$n-perfetto.log 2>&1 ) & PF=$!
  sleep 3
  $A shell am start -W -n $P/.MainActivity > $D/$n-amstart.txt
  wait $PF
  $A pull /data/misc/perfetto-traces/$n.pftrace $D/$n.pftrace >/dev/null 2>&1; $A shell rm -f /data/misc/perfetto-traces/$n.pftrace
  (cd /tmp && python3 $T/coldstart.py $D/$n.pftrace > $D/$n.json 2>$D/$n.err)
  echo "$n $(grep TotalTime $D/$n-amstart.txt | tr -d '\r') $(python3 -c "import json;d=json.load(open('$D/$n.json'));print({k:d[k] for k in ['first_frame_ms','first_content_mount_ms','content_mount_done_ms','js_busy_until_content_ms']})")"
done
