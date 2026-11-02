#!/system/bin/sh
# GH-671 ablation: copy the small result files of the 9 runs (A/B/C x r1..r3, no atrace dumps) into one
# export dir, plus per-variant aggregates (agg.sh: median [min-max] per set over the 3 runs) and per-run
# medians over the 12 taps, for a single `adb pull`.  usage (on the device): sh export-ablation.sh
cd /data/local/tmp/gh671
E=/data/local/tmp/gh671-ablation
rm -rf $E
mkdir -p $E
for v in A B C; do
  for r in 1 2 3; do
    d=$v-r$r
    [ -d $d ] || continue
    mkdir -p $E/$d
    for f in gestures.tsv conditions.txt ids.txt gfxinfo.txt meminfo.txt; do [ -f $d/$f ] && cp $d/$f $E/$d/; done
  done
  sh /data/local/tmp/agg.sh $v-r1 $v-r2 $v-r3 > $E/agg-$v.tsv
done
# probe builds of B and C (one run each): gestures + the GH671P logcat lines (probe.txt)
for d in probe-B probe-C; do
  [ -d $d ] || continue
  mkdir -p $E/$d
  for f in gestures.tsv conditions.txt ids.txt probe.txt; do [ -f $d/$f ] && cp $d/$f $E/$d/; done
done
printf "run\tsettle_ms\tjs_busy_ms\tblock_ms\n" > $E/per-run.tsv
for v in A B C; do
  for r in 1 2 3; do
    sh /data/local/tmp/agg.sh $v-r$r | grep '^all' | sed "s/^all/$v-r$r/" >> $E/per-run.tsv
  done
done
cat $E/agg-A.tsv $E/agg-B.tsv $E/agg-C.tsv $E/per-run.tsv
