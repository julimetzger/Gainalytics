#!/system/bin/sh
# GH-671 ablation: which variant (A master / B render / C render + persistence) is installed?
# Run ON the device:  adb shell sh /data/local/tmp/variant-check.sh
# Hermes keeps function names and string literals in the bytecode, so a string count tells them apart:
#   A: render 0, persist 0   B: render >0, persist 0   C: render >0, persist >0
P=com.powerliftingworkoutplanner
APK=$(pm path $P | head -1 | cut -d: -f2)
B=/data/local/tmp/vc-bundle
unzip -p $APK assets/index.android.bundle > $B
magic=$(head -c 8 $B | od -An -tx1 | tr -d ' ')
render=$(grep -c selectIsAnyTrainingStarted $B)
persist=$(grep -c 'incremental-storage: part' $B)
probe=$(grep -c GH671P $B)
v=?
[ "$render" = 0 ] && [ "$persist" = 0 ] && v=A
[ "$render" != 0 ] && [ "$persist" = 0 ] && v=B
[ "$render" != 0 ] && [ "$persist" != 0 ] && v=C
echo "variant=$v magic=$magic render=$render persist=$persist probe=$probe $(dumpsys package $P | grep -E 'pkgFlags' | head -1 | tr -s ' ')"
rm -f $B
