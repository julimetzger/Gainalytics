#!/system/bin/sh
# GH-675: median [min-max] per open series, run ON the device after open.sh:
#   adb shell sh /data/local/tmp/agg.sh <run dir>...      (dirs below /data/local/tmp/gh675)
# Re-analyses every trace-<r>.txt of a series with frames.awk (win=1500 ms after the tap) and writes
# frames-win.tsv next to it; gestures.tsv (settle_ms/js_busy_ms/views) comes from open.sh.
cd /data/local/tmp/gh675
stat() {  # stdin: one number per line
  sort -n | awk '{ v[NR] = $1 } END { if (NR == 0) { print "-"; exit } m = (NR % 2) ? v[(NR + 1) / 2] : (v[NR / 2] + v[NR / 2 + 1]) / 2; printf "%s [%s-%s] n=%d", m, v[1], v[NR], NR }'
}
for d in "$@"; do
  rm -f $d/frames-win.tsv
  for f in $d/trace-*.txt; do
    pid=$(grep -m1 -o 'gworkoutplanner-[0-9]*' $f | cut -d- -f2)
    awk -v app=$pid -v win=1500 -f /data/local/tmp/frames.awk $f | sed 1d >> $d/frames-win.tsv
  done
  echo "== $d"
  echo "settle_ms   $(cut -f6 $d/gestures.tsv | stat)"
  echo "js_busy_ms  $(cut -f5 $d/gestures.tsv | stat)"
  echo "views       $(cut -f7 $d/gestures.tsv | stat)"
  echo "max_frame   $(cut -f6 $d/frames-win.tsv | stat)"
  echo "frames>50   $(cut -f5 $d/frames-win.tsv | stat)"
  echo "max_ui_ms   $(cut -f7 $d/frames-win.tsv | stat)"
  echo "ui>50       $(cut -f9 $d/frames-win.tsv | stat)"
done
