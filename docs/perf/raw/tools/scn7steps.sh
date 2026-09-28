#!/bin/bash
R=/home/jmetzger/projects/PowerliftingWorkoutPlanner/.codex-orchestrator/runs/PERF-001
source $R/raw/tools/scenarios.sh
D=$R/raw/scn7-memory/steps; mkdir -p $D
m() { sleep 4; $A shell dumpsys meminfo $P > $D/$1.txt; echo "$1 $(grep -E '^\s+TOTAL PSS' $D/$1.txt | awk '{print $3}') native=$(grep -E '^\s+Native Heap:' $D/$1.txt | awk '{print $3}') java=$(grep -E '^\s+Java Heap:' $D/$1.txt | awk '{print $3}') gfx=$(grep -E '^\s+Graphics:' $D/$1.txt | awk '{print $2}') views=$(grep -E '^\s+Views:' $D/$1.txt | awk '{print $2}')"; }
cold >/dev/null; m 01-start
tap 360 1262; sleep 3; m 02-plan-next-training
for i in 1 2 3; do sw 100 600; sleep 2.5; done; m 03-plan-micro4
tap $TAB_EXERCISES; sleep 3; for i in 1 2 3; do vfling 1250 350; sleep 1.5; done; m 04-exercises
tap $TAB_ANALYSE; sleep 3; m 05-dashboard
analyse_drawer 401; m 06-history-open
for i in 1 2 3 4 5; do vfling 1250 350; sleep 1.5; done; m 07-history-5flings
for i in 1 2 3 4 5 6 7 8 9 10; do vfling 1250 350; sleep 1.5; done; m 08-history-15flings
analyse_drawer 212; m 09-analysis
analyse_drawer 495; m 10-metrics
analyse_drawer 117; m 11-dashboard
tap 630 1420; sleep 3; m 12-settings
tap $TAB_TRAINING; sleep 3; m 13-training
