#!/system/bin/sh
# GH-671: median [min-max] of settle_ms / js_busy_ms / block_ms per set index (gesture i -> set i+1)
# and over all 12 taps of several scn2save runs.  usage (on the device): sh agg.sh <run label>...
cd /data/local/tmp/gh671
med() {  # stdin: numbers -> "median [min-max]"
  sort -n | awk '{ v[NR] = $1 } END { m = (NR % 2) ? v[(NR + 1) / 2] : (v[NR / 2] + v[NR / 2 + 1]) / 2;
    printf "%s [%s-%s]", m, v[1], v[NR] }'
}
col() {  # $1 = column, $2 = gesture index or "all"
  for d in $RUNS; do sed 1d $d/gestures.tsv; done | awk -F'\t' -v c=$1 -v g=$2 '(g == "all" || $1 == g) { print $c }' | med
}
RUNS="$*"
echo "runs: $RUNS"
printf "set\tsettle_ms\tjs_busy_ms\tblock_ms\n"
for g in 0 1 2 3 4 5 6 7 8 9 10 11; do
  printf "%d\t%s\t%s\t%s\n" $((g + 1)) "$(col 5 $g)" "$(col 4 $g)" "$(col 7 $g)"
done
printf "all\t%s\t%s\t%s\n" "$(col 5 all)" "$(col 4 all)" "$(col 7 all)"
