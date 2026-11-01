#!/system/bin/sh
# GH-672: median [min-max] of the fling gestures (i >= 2, like aggregate.py s4b_history_fling)
# and of the History-open tap (i == 1) over several scn4b runs.  usage: sh agg.sh <run dir>...
cd /data/local/tmp/gh672
stat() {  # $1 = column, $2 = gesture filter (fling|open)
  for d in $RUNS; do sed 1d $d/gestures.tsv; done | awk -F'\t' -v c=$1 -v f=$2 \
    '(f == "fling" && $1 >= 2) || (f == "open" && $1 == 1) { print $c }' | sort -n | awk '
    { v[NR] = $1; s += $1 }
    END { m = (NR % 2) ? v[(NR + 1) / 2] : (v[NR / 2] + v[NR / 2 + 1]) / 2;
          printf "median %s [%s-%s] n=%d mean %.0f", m, v[1], v[NR], NR, s / NR }'
}
RUNS="$*"
for f in fling open; do
  echo "$f: settle_ms $(stat 5 $f) | js_busy_ms $(stat 4 $f) | views $(stat 6 $f)"
done
