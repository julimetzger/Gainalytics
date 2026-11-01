#!/system/bin/sh
# GH-672: drive the History screen to a fixed position for before/after screenshots.
#   sh nav.sh open      cold start -> Analyse -> drawer -> History (list top)
#   sh nav.sh fling N   N flings down (same gesture as the measurement), then settle
#   sh nav.sh drag N    N slow drags of 1350 px (1.5 s each, no momentum) -> reproducible position
P=com.powerliftingworkoutplanner
case "$1" in
  open)
    am force-stop $P; sleep 1
    am start -W -n $P/.MainActivity > /dev/null; sleep 7
    input tap 675 2232; sleep 3
    input tap 68 220; sleep 1.5
    input tap 150 973; sleep 4
    ;;
  fling)
    for i in $(seq 1 $2); do input swipe 540 1875 540 525 120; sleep 1.5; done
    sleep 3
    ;;
  drag)
    for i in $(seq 1 $2); do
      input motionevent DOWN 540 1875
      for y in 1800 1700 1600 1500 1400 1300 1200 1100 1000 900 800 700 600 525; do input motionevent MOVE 540 $y; done
      sleep 1; input motionevent MOVE 540 525; sleep 0.5
      input motionevent UP 540 525; sleep 1.5
    done
    sleep 3
    ;;
esac
dumpsys window | grep -q "mCurrentFocus.*$P" && echo "app in foreground" || echo "WARNING: app not in foreground"
