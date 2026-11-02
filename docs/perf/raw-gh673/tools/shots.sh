#!/system/bin/sh
# GH-673: evidence screenshots in fixed states (run ON the device after prep5b.yaml):
#   sh shots.sh <prefix>  ->  /sdcard/<prefix>-dialog.png  (Custom dialog on the default period)
#                             /sdcard/<prefix>-dialog2025.png (start typed 01/01/2025, calendar scrolled to Feb 2026)
#                             /sdcard/<prefix>-graph.png   (after Save: Bankdruecken 1RM since 01/01/2025, panel collapsed)
X=${1:?prefix}
input tap 712 488; sleep 3                  # Custom
screencap -p /sdcard/$X-dialog.png
input tap 180 378; sleep 1; input keyevent 123
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do input keyevent 67; done
input text 01/01/2025; sleep 2
input tap 540 552; sleep 1                  # month title: closes the keyboard, picks no day
for i in 1 2 3 4 5 6 7 8 9; do              # nine slow drags (no fling) up to February 2026
  input motionevent DOWN 540 900
  for y in 1000 1100 1200 1300 1400 1500 1600 1700 1800; do input motionevent MOVE 540 $y; done
  sleep 0.6; input motionevent UP 540 1800; sleep 0.8
done
sleep 2
screencap -p /sdcard/$X-dialog2025.png
input tap 900 357; sleep 4                  # Save
input tap 984 382; sleep 3                  # collapse the filter panel
screencap -p /sdcard/$X-graph.png
