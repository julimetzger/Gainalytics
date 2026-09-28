#!/bin/bash
R=/home/jmetzger/projects/PowerliftingWorkoutPlanner/.codex-orchestrator/runs/PERF-001
A=/tmp/a.sh; P=com.powerliftingworkoutplanner
D=$R/raw/scn1-coldstart-trace; mkdir -p $D
for run in 1 2 3 4 5; do
  $A shell am force-stop $P; sleep 2
  n=cold$run
  out=$($A shell "perfetto --background --txt -c /data/misc/perfetto-configs/perf001.cfg -o /data/misc/perfetto-traces/$n.pftrace" 2>&1)
  pid=$(echo "$out" | tr -d '\r' | tail -1 | grep -oE '[0-9]+$'); sleep 2
  $A shell am start -W -n $P/.MainActivity > $D/$n-amstart.txt
  sleep 8
  $A shell kill -TERM $pid
  for i in $(seq 1 30); do $A shell "kill -0 $pid 2>/dev/null" || break; sleep 1; done
  $A pull /data/misc/perfetto-traces/$n.pftrace $D/$n.pftrace >/dev/null 2>&1
  $A shell rm -f /data/misc/perfetto-traces/$n.pftrace
  echo "$n $(grep TotalTime $D/$n-amstart.txt)"
done
