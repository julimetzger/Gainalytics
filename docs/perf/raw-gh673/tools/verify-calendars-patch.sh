#!/system/bin/sh
# GH-673: apply patches/react-native-calendars+1.1314.0.patch to pristine copies and compare the result with the
# patched node_modules files, ON the device (the CI host blocks `git apply`, `patch` and `npx patch-package`).
# Push first:  /data/local/tmp/pv/orig/<pristine copies, names below>   /data/local/tmp/pv/p.patch
#              /data/local/tmp/pv/expected/node_modules/react-native-calendars/src/...  (the patched files)
# Then: adb shell sh /data/local/tmp/pv/verify-calendars-patch.sh  ->  ALL_MATCH
B=/data/local/tmp/pv
P=node_modules/react-native-calendars/src
cd $B || exit 1
rm -rf work; mkdir -p work/$P/calendar-list work/$P/calendar/day/period work/$P/calendar/day/dot work/$P/calendar/day/marking work/$P/calendar/header
cp orig/calendar-list-index.js work/$P/calendar-list/index.js
cp orig/item.js work/$P/calendar-list/item.js
cp orig/calendar.js work/$P/calendar/index.js
cp orig/period.js work/$P/calendar/day/period/index.js
cp orig/dot.js work/$P/calendar/day/dot/index.js
cp orig/marking.js work/$P/calendar/day/marking/index.js
cp orig/header.js work/$P/calendar/header/index.js
cd work && patch -p1 -i $B/p.patch || { echo PATCH_FAILED; exit 1; }
ok=1
for f in calendar-list/index.js calendar-list/item.js calendar/index.js calendar/day/period/index.js calendar/day/dot/index.js calendar/day/marking/index.js calendar/header/index.js; do
  cmp $P/$f $B/expected/$P/$f || ok=0
done
[ $ok = 1 ] && echo ALL_MATCH || echo MISMATCH
