#!/system/bin/sh
# GH-675: screenshots of the four measured screens in fixed states (before/after comparison), run ON the device:
#   adb shell sh /data/local/tmp/shots.sh <prefix> [ex|dash|vdetail|vdetail-bottom|metrics]...
# ex/dash/vdetail: cold start -> same taps as open.sh, 5 s settle. vdetail-mid / vdetail-bottom: continue from
# vdetail with one / six zero-velocity drags (speed chart / bottom of the screen). metrics: the current screen (run after scn5c.sh, which
# ends on the week 16-22/02/26). Files: /data/local/tmp/gh675/shots/<prefix>-<screen>.png
P=com.powerliftingworkoutplanner
X=${1:?prefix}; shift
O=/data/local/tmp/gh675/shots
mkdir -p $O
cold() { am force-stop $P; sleep 1; am start -W -n $P/.MainActivity > /dev/null; sleep 7; }
drag_up() {  # one slow 900 px drag at the right edge (no fling), like GH-672 nav.sh drag
  input motionevent DOWN 1040 1900
  for y in 1800 1700 1600 1500 1400 1300 1200 1100 1000; do input motionevent MOVE 1040 $y; done
  sleep 1; input motionevent MOVE 1040 1000; sleep 0.5; input motionevent UP 1040 1000; sleep 1
}
for s in "$@"; do
  case $s in
    ex) cold; input tap 405 2232; sleep 5 ;;
    dash) cold; input tap 675 2232; sleep 5 ;;
    vdetail) cold; input tap 675 2232; sleep 3; input tap 68 220; sleep 1.5; input tap 300 1398; sleep 3; input tap 400 880; sleep 5 ;;
    vdetail-bottom) for i in 1 2 3 4 5 6; do drag_up; done; sleep 2 ;;
    vdetail-mid) drag_up; sleep 2 ;;
    metrics) sleep 1 ;;
  esac
  screencap -p $O/$X-$s.png
done
ls $O
