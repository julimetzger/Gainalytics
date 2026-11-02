#!/system/bin/sh
# GH-673: median [min-max] per phase of scn5b.sh runs (gesture i: i%4 0 = open, 2 = typing group,
# 3 = save), like PERF-004 aggregate.py s5b_*; opens also split by the period that is current when
# the dialog opens (k = i/4: 0 = default 3 months, 1/4 = since 2025, 2/5 = since 2024, 3 = since 2023).
#   sh agg5b.sh <run dir>...      (dirs under /data/local/tmp/gh673)   |   sh agg5b.sh -p <run dir>...  (presets)
cd /data/local/tmp/gh673
stat() {  # $1 = column, $2 = awk filter on i ($1)
  for d in $RUNS; do sed 1d $d/gestures.tsv; done | awk -F'\t' -v c=$1 "$2 { print \$c }" | sort -n | awk '
    { v[NR] = $1; s += $1 }
    END { if (NR == 0) { print "n=0"; exit }
          m = (NR % 2) ? v[(NR + 1) / 2] : (v[NR / 2] + v[NR / 2 + 1]) / 2;
          printf "median %s [%s-%s] n=%d mean %.0f", m, v[1], v[NR], NR, s / NR }'
}
if [ "$1" = -p ]; then
  shift; RUNS="$*"
  echo "preset tap: settle_ms $(stat 5 '1') | js_busy_ms $(stat 4 '1')"
  exit 0
fi
RUNS="$*"
echo "open (all): settle_ms $(stat 5 '$1 % 4 == 0') | js_busy_ms $(stat 4 '$1 % 4 == 0') | views $(stat 6 '$1 % 4 == 0')"
echo "open, current period 3 months: settle_ms $(stat 5 '$1 == 0')"
echo "open, current period since 2025: settle_ms $(stat 5 '$1 == 4 || $1 == 16')"
echo "open, current period since 2024: settle_ms $(stat 5 '$1 == 8 || $1 == 20')"
echo "open, current period since 2023: settle_ms $(stat 5 '$1 == 12')"
echo "typing group (23 keys): settle_ms $(stat 5 '$1 % 4 == 2') | js_busy_ms $(stat 4 '$1 % 4 == 2')"
echo "save: settle_ms $(stat 5 '$1 % 4 == 3') | js_busy_ms $(stat 4 '$1 % 4 == 3')"
echo "save to 2025 / 2024 / 2023: $(stat 5 '$1 == 3 || $1 == 15') / $(stat 5 '$1 == 7 || $1 == 19') / $(stat 5 '$1 == 11 || $1 == 23')"
