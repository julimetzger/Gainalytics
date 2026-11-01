#!/bin/bash
# Scenario 8 (PERF-001 scenario 7): PSS after cold start and after one round through all tabs, 5 runs.  usage: scn8.sh [runs|steps]
T=$(dirname "$(readlink -f "$0")"); R=$(dirname $(dirname $T)); source $T/scenarios.sh
D=$R/raw/scn8-memory; mkdir -p $D
round() {
  tap 363 1276; sleep 3                                   # Training home -> Next Training (plan, Micro 6)
  for i in 1 2; do sw 100 600; sleep 2.5; done            # back to Micro 4 (PERF-001: 3 swipes from Micro 7 -> same Micro 4)
  tap $TAB_EXERCISES; sleep 3; for i in 1 2 3; do vfling 1250 350; sleep 1.5; done
  tap $TAB_ANALYSE; sleep 3
  analyse_drawer $D_HISTORY; for i in 1 2 3 4 5; do vfling 1250 350; sleep 1.5; done   # History
  analyse_drawer $D_ANALYSIS                              # Analysis
  analyse_drawer $D_METRICS                               # Metrics
  analyse_drawer $D_DASH                                  # Dashboard
  tap $TAB_SETTINGS; sleep 3                              # Settings
  tap $TAB_TRAINING; sleep 3
}
m() { sleep 4; $A shell dumpsys meminfo $P > $D/steps/$1.txt; echo "$1 $(grep -E '^\s+TOTAL PSS' $D/steps/$1.txt | awk '{print $3}') native=$(grep -E '^\s+Native Heap:' $D/steps/$1.txt | awk '{print $3}') java=$(grep -E '^\s+Java Heap:' $D/steps/$1.txt | awk '{print $3}') gfx=$(grep -E '^\s+Graphics:' $D/steps/$1.txt | awk '{print $2}') views=$(grep -E '^\s+Views:' $D/steps/$1.txt | awk '{print $2}')"; }
if [ "$1" = steps ]; then
  mkdir -p $D/steps
  cold >/dev/null; m 01-start
  tap 363 1276; sleep 3; m 02-plan-next-training
  for i in 1 2; do sw 100 600; sleep 2.5; done; m 03-plan-micro4
  tap $TAB_EXERCISES; sleep 3; for i in 1 2 3; do vfling 1250 350; sleep 1.5; done; m 04-exercises
  tap $TAB_ANALYSE; sleep 3; m 05-dashboard
  analyse_drawer $D_HISTORY; m 06-history-open
  for i in 1 2 3 4 5; do vfling 1250 350; sleep 1.5; done; m 07-history-5flings
  for i in $(seq 1 10); do vfling 1250 350; sleep 1.5; done; m 08-history-15flings
  analyse_drawer $D_ANALYSIS; m 09-analysis
  analyse_drawer $D_METRICS; m 10-metrics
  analyse_drawer $D_DASH; m 11-dashboard
  tap $TAB_SETTINGS; sleep 3; m 12-settings
  tap $TAB_TRAINING; sleep 3; m 13-training
  exit 0
fi
for run in ${1:-1 2 3 4 5}; do
  cold > $D/run$run-start.txt
  sleep 5
  $A shell dumpsys meminfo $P > $D/run$run-after-start.txt
  fg_guard || { echo ABORT; exit 1; }
  round > /dev/null 2>&1
  sleep 5
  $A shell dumpsys meminfo $P > $D/run$run-after-tabs.txt
  echo "run $run start=$(grep -E '^\s+TOTAL PSS' $D/run$run-after-start.txt | awk '{print $3}') tabs=$(grep -E '^\s+TOTAL PSS' $D/run$run-after-tabs.txt | awk '{print $3}') views=$(grep -E '^\s+Views:' $D/run$run-after-tabs.txt | awk '{print $2}')"
done
