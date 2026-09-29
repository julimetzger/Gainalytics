#!/bin/bash
# In-app export (Settings -> Export Data), compare with the first backup, then adb install -r (never uninstall).
A=/tmp/a.sh; R=/home/jmetzger/projects/PowerliftingWorkoutPlanner/.codex-orchestrator/runs/PERF-003
W=/home/jmetzger/projects/PowerliftingWorkoutPlanner/.worktrees/feature-PERF-003
$A shell am force-stop com.powerliftingworkoutplanner; $A shell am start -n com.powerliftingworkoutplanner/.MainActivity >/dev/null; sleep 6
$A shell input tap 540 1420; sleep 2; $A shell input swipe 360 1200 360 400 200; sleep 1; $A shell input tap 540 1240; sleep 3
F=$($A shell ls -t /sdcard/Download | head -1 | tr -d '\r'); $A pull /sdcard/Download/$F $R/backup/before-install-$1-$F >/dev/null
$A shell input tap 610 890
cmp $R/backup/before-install-1790670859516.gains $R/backup/before-install-$1-$F && echo "EXPORT IDENTICAL TO FIRST BACKUP"
timeout 300 $A install -r ${2:-$W/android/app/build/outputs/apk/release/app-release.apk} 2>&1 | tail -2
