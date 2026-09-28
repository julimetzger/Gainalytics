#!/bin/bash
R=/home/jmetzger/projects/PowerliftingWorkoutPlanner/.codex-orchestrator/runs/PERF-001
source $R/raw/tools/scenarios.sh
D=$R/raw/scn7-memory
round() {
  tap 360 1262; sleep 3                                   # Training home -> Next Training (plan)
  for i in 1 2 3; do sw 100 600; sleep 2.5; done          # back to Micro 4
  tap $TAB_EXERCISES; sleep 3; for i in 1 2 3; do vfling 1250 350; sleep 1.5; done
  tap $TAB_ANALYSE; sleep 3
  analyse_drawer 401; for i in 1 2 3 4 5; do vfling 1250 350; sleep 1.5; done   # History
  analyse_drawer 212                                      # Analysis
  analyse_drawer 495                                      # Metrics
  analyse_drawer 117                                      # Dashboard
  tap 630 1420; sleep 3                                   # Settings
  tap $TAB_TRAINING; sleep 3
}
for run in 1 2 3 4 5; do
  cold > $D/run$run-start.txt
  sleep 5
  $A shell dumpsys meminfo $P > $D/run$run-after-start.txt
  round > /dev/null 2>&1
  sleep 5
  $A shell dumpsys meminfo $P > $D/run$run-after-tabs.txt
  echo "run $run done"
done
