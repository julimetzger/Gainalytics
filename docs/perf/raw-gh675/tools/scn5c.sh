#!/system/bin/sh
# GH-675: PERF-004 scenario 5c (Metrics Overview, Bankdruecken, swipe week ranges) on the CI emulator, run ON the device:
#   adb push scn5c.sh gestures.awk frames.awk /data/local/tmp/ ; adb shell sh /data/local/tmp/scn5c.sh <label>
# Precondition: prep5c.yaml ran (Metrics Overview, Bankdruecken selected, filter panel collapsed).
# Same interaction and pauses as docs/perf/raw-2026-11/tools/scenarios.sh (set_range 02/16/2026-02/22/2026,
# then 10 swipes back in time + 10 forward, 150 ms, 2 s apart); coordinates scaled to 1080x2400
# and measured with uiautomator on the emulator.
P=com.powerliftingworkoutplanner
L=${1:?label}
O=/data/local/tmp/gh675/$L
mkdir -p $O
rm -f $O/*
RANGE_BUTTON="540 558"; START_INPUT="180 378"; END_INPUT="540 378"; SAVE="900 357"
tap() { input tap $1 $2; }
key() { input keyevent $1; }
sw() { input swipe $1 1200 $2 1200 150; }
set_range() {
  tap $RANGE_BUTTON; sleep 2.5
  tap $START_INPUT; sleep 1; key 123; for i in 1 2 3 4 5 6 7 8 9 10 11 12; do key 67; done; input text "$1"; sleep 1
  tap $END_INPUT; sleep 1; key 123; for i in 1 2 3 4 5 6 7 8 9 10 11 12; do key 67; done; input text "$2"; sleep 1.5
  tap $SAVE; sleep 3
}
dumpsys window | grep -q "mCurrentFocus.*$P" || { echo "ABORT: app not in foreground"; exit 1; }
set_range 02/16/2026 02/22/2026
dumpsys battery | grep -E 'level|temperature' | tr -d '\n' > $O/conditions.txt
dumpsys gfxinfo $P reset > /dev/null
atrace --async_start -b 40960 -a $P sched view gfx input am wm res > /dev/null
sleep 3
for i in 1 2 3 4 5 6 7 8 9 10; do sw 150 900; sleep 2; done
for i in 1 2 3 4 5 6 7 8 9 10; do sw 900 150; sleep 2; done
sleep 2
atrace --async_stop -o $O/trace.txt > /dev/null
dumpsys gfxinfo $P > $O/gfxinfo.txt
pid=$(pidof $P)
js=$(ps -T -p $pid -o TID,CMD | grep mqt_v_js | awk '{print $1}')
echo "pid=$pid js=$js" > $O/ids.txt
awk -v app=$pid -v js=$js -f /data/local/tmp/gestures.awk $O/trace.txt > $O/gestures.tsv
awk -v app=$pid -f /data/local/tmp/frames.awk $O/trace.txt > $O/frames.tsv
cat $O/ids.txt $O/gestures.tsv $O/frames.tsv
grep -E 'Janky frames' $O/gfxinfo.txt | head -2
