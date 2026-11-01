#!/system/bin/sh
# GH-671: copy the small result files of every run (no atrace dumps, 100 MB each) into one export
# dir on the device, plus the aggregates, for a single `adb pull`.  usage: sh export.sh
cd /data/local/tmp/gh671
E=/data/local/tmp/gh671-export
rm -rf $E
mkdir -p $E
for d in before-r* after-r* probe-r1 probe-after-r1; do
  [ -d $d ] || continue
  mkdir -p $E/$d
  for f in gestures.tsv conditions.txt ids.txt gfxinfo.txt meminfo.txt; do [ -f $d/$f ] && cp $d/$f $E/$d/; done
done
sh agg.sh before-r1 before-r2 before-r3 > $E/agg-before.tsv
sh agg.sh after-r1 after-r2 after-r3 after-r4 > $E/agg-after.tsv
cat $E/agg-before.tsv $E/agg-after.tsv
