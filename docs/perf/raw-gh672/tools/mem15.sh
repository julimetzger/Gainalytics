#!/system/bin/sh
# GH-672: memory over 15 History flings (PERF-004 scn8.sh steps 06 -> 07 -> 08), run ON the device:
# adb shell sh mem15.sh <label> <runs>. Each run: cold start -> Analyse tab -> drawer -> History,
# meminfo after History opened, after 5 flings and after 15 flings (4 s settle before each meminfo).
# PERF-004 reached History via Plan/Exercises/Dashboard first; here it is opened straight after a
# cold start (the growth over the 15 flings is the criterion).
P=com.powerliftingworkoutplanner
L=${1:?label}; RUNS=${2:-3}
O=/data/local/tmp/gh672/$L
mkdir -p $O
rm -f $O/*
tap() { input tap $1 $2; }
vfling() { input swipe 540 $1 540 $2 120; }
m() {
  sleep 4
  dumpsys meminfo $P > $O/$1.txt
  pss=$(grep -E '^ +TOTAL PSS' $O/$1.txt | awk '{print $3}')
  nat=$(grep -E '^ +Native Heap:' $O/$1.txt | awk '{print $3}')
  views=$(grep -E '^ +Views:' $O/$1.txt | awk '{print $2}')
  echo "$1 pss_kb=$pss native_kb=$nat views=$views"
}
for r in $(seq 1 $RUNS); do
  am force-stop $P; sleep 1
  am start -W -n $P/.MainActivity > /dev/null; sleep 7
  tap 675 2232; sleep 3
  dumpsys window | grep -q "mCurrentFocus.*$P" || { echo "ABORT: app not in foreground"; exit 1; }
  tap 68 220; sleep 1.5; tap 150 973; sleep 3
  m r$r-06-history-open
  for i in 1 2 3 4 5; do vfling 1875 525; sleep 1.5; done
  m r$r-07-history-5flings
  for i in 1 2 3 4 5 6 7 8 9 10; do vfling 1875 525; sleep 1.5; done
  m r$r-08-history-15flings
done
