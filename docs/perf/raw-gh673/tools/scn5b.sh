#!/system/bin/sh
# GH-673: PERF-004 scenario 5b (Analysis graph, Bankdruecken 1RM, Day: change the period six times
# via Custom -> start date -> Save) on the CI emulator, run ON the device:
#   adb push scn5b.sh gestures.awk /data/local/tmp/ ; adb shell sh /data/local/tmp/scn5b.sh <label> [presets]
# Precondition: prep5b.yaml ran (Analysis screen, expanded filter panel, Bankdruecken + 1RM, default period).
# Same interaction and pauses as docs/perf/raw-2026-11/tools/scenarios.sh (set_start / scn5b);
# coordinates measured on the emulator (1080x2400) with uiautomator.
# Gestures per round: 4k = tap "Custom" (dialog opens), 4k+1 = tap start input,
# 4k+2 = 23 key events (MOVE_END, 12x DEL, 10 chars), 4k+3 = tap "Save" (graph recomputes).
# Mode "presets": 3 rounds over the chips 4W, 3M, 6M, 1Y (one gesture each, 2.5 s apart).
P=com.powerliftingworkoutplanner
L=${1:?label}
MODE=${2:-custom}
O=/data/local/tmp/gh673/$L
mkdir -p $O
rm -f $O/*
# coordinates (emulator, 1080x2400): chips row of the expanded panel, dialog start input, dialog Save
CUSTOM="712 488"
START_INPUT="180 378"
SAVE="900 357"
P4W="104 488"; P3M="242 488"; P6M="380 488"; P1Y="514 488"
tap() { input tap $1 $2; }
key() { input keyevent $1; }
set_start() {
  tap $CUSTOM; sleep 2.5
  tap $START_INPUT; sleep 1; key 123; for i in 1 2 3 4 5 6 7 8 9 10 11 12; do key 67; done
  input text "$1"; sleep 2.5
  tap $SAVE; sleep 4
}

dumpsys window | grep -q "mCurrentFocus.*$P" || { echo "ABORT: app not in foreground"; exit 1; }
dumpsys battery | grep -E 'level|temperature' | tr -d '\n' > $O/conditions.txt
dumpsys gfxinfo $P reset > /dev/null
atrace --async_start -b 40960 -a $P sched view gfx input am wm res > /dev/null
sleep 3
if [ "$MODE" = presets ]; then
  for r in 1 2 3; do
    for c in "$P4W" "$P3M" "$P6M" "$P1Y"; do tap $c; sleep 2.5; done
  done
else
  for d in 01/01/2025 01/01/2024 01/01/2023 01/01/2025 01/01/2024 01/01/2023; do set_start $d; done
fi
sleep 2
atrace --async_stop -o $O/trace.txt > /dev/null
dumpsys gfxinfo $P > $O/gfxinfo.txt
pid=$(pidof $P)
js=$(ps -T -p $pid -o TID,CMD | grep mqt_v_js | awk '{print $1}')
echo "pid=$pid js=$js" > $O/ids.txt
awk -v app=$pid -v js=$js -f /data/local/tmp/gestures.awk $O/trace.txt > $O/gestures.tsv
cat $O/ids.txt $O/gestures.tsv
grep -E 'Janky frames|50th|90th|99th' $O/gfxinfo.txt | head -5
