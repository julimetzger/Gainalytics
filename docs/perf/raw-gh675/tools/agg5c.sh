#!/system/bin/sh
# GH-675: median [min-max] of the Metrics week swipes over several scn5c.sh runs (all 20 swipes per run),
# run ON the device: adb shell sh /data/local/tmp/agg5c.sh <run dir>...   (dirs below /data/local/tmp/gh675)
# "data weeks" = the swipes whose target week holds Bankdruecken sets (PERF-004: the slow half, 218-297 ms).
cd /data/local/tmp/gh675
stat() {
  sort -n | awk '{ v[NR] = $1 } END { if (NR == 0) { print "-"; exit } m = (NR % 2) ? v[(NR + 1) / 2] : (v[NR / 2] + v[NR / 2 + 1]) / 2; printf "%s [%s-%s] n=%d", m, v[1], v[NR], NR }'
}
all() { for d in $DIRS; do sed 1d $d/gestures.tsv; done; }
DIRS="$*"
echo "settle_ms   $(all | cut -f5 | stat)"
echo "js_busy_ms  $(all | cut -f4 | stat)"
for d in $DIRS; do echo "$d max_ui_ms $(sed 1d $d/frames.tsv | cut -f7 | stat)  ui>50 $(sed 1d $d/frames.tsv | cut -f9 | awk '{s += $1} END {print s}')"; done
