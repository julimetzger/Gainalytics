#!/system/bin/sh
# GH-675: control series, PERF-004 scenario 4a (Exercises: 8 flings down + 8 up, 1.5 s apart) on the CI
# emulator, run ON the device: adb shell sh /data/local/tmp/scn4a.sh <label>
# The Exercises list is a FlashList since GH-675 (rows are recycled while scrolling instead of all being
# mounted up front) - this checks that scrolling stays as smooth as before.
# Coordinates: PERF-004 (720x1600) scaled to 1080x2400.
P=com.powerliftingworkoutplanner
L=${1:?label}
O=/data/local/tmp/gh675/$L
mkdir -p $O
rm -f $O/*
am force-stop $P; sleep 1
am start -W -n $P/.MainActivity > /dev/null; sleep 7
input tap 405 2232; sleep 4
dumpsys window | grep -q "mCurrentFocus.*$P" || { echo "ABORT: app not in foreground"; exit 1; }
dumpsys gfxinfo $P reset > /dev/null
atrace --async_start -b 40960 -a $P sched view gfx input am wm res > /dev/null
sleep 2
for i in 1 2 3 4 5 6 7 8; do input swipe 540 1875 540 525 120; sleep 1.5; done
for i in 1 2 3 4 5 6 7 8; do input swipe 540 825 540 1950 120; sleep 1.5; done
sleep 1
atrace --async_stop -o $O/trace.txt > /dev/null
dumpsys gfxinfo $P > $O/gfxinfo.txt
pid=$(pidof $P)
js=$(ps -T -p $pid -o TID,CMD | grep mqt_v_js | awk '{print $1}')
awk -v app=$pid -v js=$js -f /data/local/tmp/gestures.awk $O/trace.txt > $O/gestures.tsv
awk -v app=$pid -f /data/local/tmp/frames.awk $O/trace.txt > $O/frames.tsv
cat $O/gestures.tsv $O/frames.tsv
grep -E 'Janky frames' $O/gfxinfo.txt | head -1
