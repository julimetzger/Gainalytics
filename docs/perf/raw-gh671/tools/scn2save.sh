#!/system/bin/sh
# GH-671: PERF-004 scenario 2 "Satz speichern" (docs/perf/raw-2026-11/tools/scenarios.sh scn2save:
# 10 s idle, then 12 taps on "Add" 4 s apart) on the CI emulator, run ON the device:
#   adb push scn2save.sh gestures.awk /data/local/tmp/ ; adb shell sh /data/local/tmp/scn2save.sh <label> <x> <y> [taps]
# Precondition: gh671_prep_set_add.yaml ran (started training, Bankdruecken without sets, input row
# 5 / 0 / 20, keyboard hidden). <x> <y> = centre of the "Add" button in screen pixels.
# Tracing: atrace (sched + view gfx input am wm res, app markers on), analysed with gestures.awk
# (= PERF-004 gestures.py definitions), because the runner has no trace_processor (see GH-672).
P=com.powerliftingworkoutplanner
L=${1:?label}
X=${2:?x}
Y=${3:?y}
N=${4:-12}
O=/data/local/tmp/gh671/$L
mkdir -p $O
rm -f $O/*
dumpsys window | grep -q "mCurrentFocus.*$P" || { echo "ABORT: app not in foreground"; exit 1; }
dumpsys battery | grep -E 'level|temperature' | tr -d '\n' > $O/conditions.txt
dumpsys gfxinfo $P reset > /dev/null
atrace --async_start -b 40960 -a $P sched view gfx input am wm res > /dev/null
sleep 10                                   # idle window: training timer ticking
i=0
while [ $i -lt $N ]; do input tap $X $Y; sleep 4; i=$((i + 1)); done
sleep 1
atrace --async_stop -o $O/trace.txt > /dev/null
dumpsys gfxinfo $P > $O/gfxinfo.txt
dumpsys meminfo $P > $O/meminfo.txt
pid=$(pidof $P)
js=$(ps -T -p $pid -o TID,CMD | grep mqt_v_js | awk '{print $1}')
echo "pid=$pid js=$js" > $O/ids.txt
awk -v app=$pid -v js=$js -f /data/local/tmp/gestures.awk $O/trace.txt > $O/gestures.tsv
cat $O/conditions.txt; echo; cat $O/ids.txt $O/gestures.tsv
grep -E 'Janky frames|50th|90th|99th' $O/gfxinfo.txt | head -5
