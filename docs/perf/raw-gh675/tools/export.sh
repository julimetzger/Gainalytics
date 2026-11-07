#!/system/bin/sh
# GH-675: copy the per-series results (no traces) into one export dir for a single `adb pull`, run ON the device:
#   adb shell sh /data/local/tmp/export.sh <series>...  ->  /data/local/tmp/gh675-export/<series>/
E=/data/local/tmp/gh675-export
rm -rf $E; mkdir -p $E
cd /data/local/tmp/gh675
for d in "$@"; do
  mkdir -p $E/$d
  for f in gestures.tsv frames.tsv frames-win.tsv start.txt ids.txt conditions.txt; do
    [ -f $d/$f ] && cp $d/$f $E/$d/
  done
  [ -f $d/gfxinfo-1.txt ] && grep -h -E 'Total frames|Janky frames|50th|90th|99th' $d/gfxinfo-*.txt > $E/$d/gfxinfo-summary.txt
  [ -f $d/gfxinfo.txt ] && grep -h -E 'Total frames|Janky frames|50th|90th|99th' $d/gfxinfo.txt > $E/$d/gfxinfo-summary.txt
  if ls $d/trace-*.txt > /dev/null 2>&1 || [ -f $d/trace.txt ]; then
    for f in $d/trace-*.txt $d/trace.txt; do
      [ -f $f ] || continue
      pid=$(grep -m1 -o 'gworkoutplanner-[0-9]*' $f | cut -d- -f2)
      echo "$(basename $f) $(awk -v app=$pid -v min=15 -f /data/local/tmp/heavy.awk $f)" >> $E/$d/heavy.txt
      echo "== $(basename $f)" >> $E/$d/mounts.txt
      awk -v app=$pid -f /data/local/tmp/mounts.awk $f | tail -1 >> $E/$d/mounts.txt
    done
  fi
done
ls $E
