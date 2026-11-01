#!/system/bin/sh
# GH-672: PERF-004 scenario 4b (training history: Analyse -> drawer -> History, 12 flings down +
# 6 up, 1.5 s apart) on the CI emulator, run ON the device: adb push + adb shell sh scn4b.sh <label>.
# Same prep/interaction/pauses as docs/perf/raw-2026-11/tools/scenarios.sh (prep4b + scn4b);
# coordinates scaled from the 720x1600 phone override to the emulator's 1080x2400 (x1.5).
# Tracing: atrace (sched + view gfx input am wm res, app markers on) instead of Perfetto, analysed
# with gestures.awk (= gestures.py definitions), because the runner has no trace_processor.
P=com.powerliftingworkoutplanner
L=${1:?label}
O=/data/local/tmp/gh672/$L
mkdir -p $O
rm -f $O/*
tap() { input tap $1 $2; }
vfling() { input swipe 540 $1 540 $2 120; }

# prep (untraced): cold start, Analyse tab
am force-stop $P; sleep 1
am start -W -n $P/.MainActivity | grep TotalTime > $O/coldstart.txt
sleep 7
tap 675 2232; sleep 3
dumpsys window | grep -q "mCurrentFocus.*$P" || { echo "ABORT: app not in foreground"; exit 1; }
dumpsys battery | grep -E 'level|temperature' | tr -d '\n' > $O/conditions.txt
dumpsys gfxinfo $P reset > /dev/null
atrace --async_start -b 40960 -a $P sched view gfx input am wm res > /dev/null
sleep 3
# interaction = PERF-004 scn4b: drawer -> History (gestures 0 and 1), then 18 flings (gestures 2..19)
tap 68 220; sleep 1.5; tap 150 973; sleep 3
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do vfling 1875 525; sleep 1.5; done
for i in 1 2 3 4 5 6; do vfling 525 1875; sleep 1.5; done
sleep 2
atrace --async_stop -o $O/trace.txt > /dev/null
dumpsys gfxinfo $P > $O/gfxinfo.txt
dumpsys meminfo $P > $O/meminfo.txt
pid=$(pidof $P)
js=$(ps -T -p $pid -o TID,CMD | grep mqt_v_js | awk '{print $1}')
echo "pid=$pid js=$js" > $O/ids.txt
awk -v app=$pid -v js=$js -f /data/local/tmp/gestures.awk $O/trace.txt > $O/gestures.tsv
cat $O/coldstart.txt $O/ids.txt $O/gestures.tsv
grep -E 'Janky frames|50th|90th|99th' $O/gfxinfo.txt | head -5
grep -E 'TOTAL PSS|Native Heap:|Views:' $O/meminfo.txt
