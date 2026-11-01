#!/system/bin/sh
# GH-671 data safety: tap "Add" and kill the app right after it (am force-stop = SIGKILL, no
# lifecycle callbacks), then cold-start it again. Run ON the device:
#   adb shell sh /data/local/tmp/forcestop-after-add.sh <x> <y> <delay_s>
# <delay_s> = pause between the tap and the force-stop (0 = immediately after `input tap` returns).
P=com.powerliftingworkoutplanner
X=${1:?x}
Y=${2:?y}
D=${3:-0}
dumpsys window | grep -q "mCurrentFocus.*$P" || { echo "ABORT: app not in foreground"; exit 1; }
t0=$(date +%s%N)
input tap $X $Y
[ "$D" != "0" ] && sleep $D
am force-stop $P
t1=$(date +%s%N)
echo "tap -> force-stop returned after $(( (t1 - t0) / 1000000 )) ms (delay $D s)"
sleep 2
pidof $P > /dev/null && echo "WARN: still running" || echo "process gone"
am start -W -n $P/.MainActivity | grep -E 'Status|TotalTime'
