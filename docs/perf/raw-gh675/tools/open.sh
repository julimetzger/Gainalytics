#!/system/bin/sh
# GH-675: "open" series of PERF-004 (open_ex / open_dash / open_vdetail in raw-2026-11/tools/scenarios.sh)
# on the CI emulator, run ON the device:
#   adb push open.sh gestures.awk frames.awk /data/local/tmp/ ; adb shell sh /data/local/tmp/open.sh <label> <ex|dash|vdetail> [runs]
# Each run: cold start (am start -W, 7 s) -> untraced prep -> gfxinfo reset -> atrace -> ONE tap -> 4 s -> stop.
# Coordinates: CI emulator 1080x2400, measured with uiautomator on the release build.
#   ex      : tap tab Exercises                        (PERF-004 open_ex)
#   dash    : tap tab Analyse -> Dashboard              (PERF-004 open_dash)
#   vdetail : Analyse -> drawer -> Video Analysis, tap the newest analysis row (PERF-004 open_vdetail)
P=com.powerliftingworkoutplanner
L=${1:?label}
S=${2:?scenario}
N=${3:-5}
O=/data/local/tmp/gh675/$L
mkdir -p $O
rm -f $O/*
TAB_EXERCISES="405 2232"; TAB_ANALYSE="675 2232"
DRAWER="68 220"; D_VIDEO="300 1398"; VROW="400 880"
tap() { input tap $1 $2; }
for r in $(seq 1 $N); do
  am force-stop $P; sleep 1
  am start -W -n $P/.MainActivity | grep TotalTime >> $O/start.txt; sleep 7
  case $S in
    ex|dash) ;;
    vdetail) tap $TAB_ANALYSE; sleep 3; tap $DRAWER; sleep 1.5; tap $D_VIDEO; sleep 3 ;;
  esac
  dumpsys window | grep -q "mCurrentFocus.*$P" || { echo "ABORT: app not in foreground"; exit 1; }
  dumpsys gfxinfo $P reset > /dev/null
  atrace --async_start -b 40960 -a $P sched view gfx input am wm res > /dev/null
  sleep 2
  case $S in
    ex) tap $TAB_EXERCISES ;;
    dash) tap $TAB_ANALYSE ;;
    vdetail) tap $VROW ;;
  esac
  sleep 4
  atrace --async_stop -o $O/trace-$r.txt > /dev/null
  dumpsys gfxinfo $P > $O/gfxinfo-$r.txt
  pid=$(pidof $P)
  js=$(ps -T -p $pid -o TID,CMD | grep mqt_v_js | awk '{print $1}')
  awk -v app=$pid -v js=$js -f /data/local/tmp/gestures.awk $O/trace-$r.txt | sed 1d | sed "s/^/$r\t/" >> $O/gestures.tsv
  awk -v app=$pid -f /data/local/tmp/frames.awk $O/trace-$r.txt | sed 1d | sed "s/^/$r\t/" >> $O/frames.tsv
  rm -f $O/trace-$r.txt.gz
done
echo "run\ti\tt_rel_s\ttouch_ms\tjs_busy_ms\tsettle_ms\tviews"; cat $O/gestures.tsv
echo "run\ti\tframes\tgt16\tgt33\tgt50\tmax_frame_ms"; cat $O/frames.tsv
grep -h -E 'Janky frames' $O/gfxinfo-*.txt
