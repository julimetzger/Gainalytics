#!/usr/bin/env bash
# GH-418: drag a plan-editor item by its drag handle on a real device, with an
# optional hold at the end point (that is what makes the list auto-scroll when
# the end point lies in the top/bottom edge zone) and optional screenshots taken
# while the finger is still down.
#
# Maestro has no "press, move, hold" gesture and `adb shell input swipe` has no
# hold, so the drag is composed from `input motionevent` in ONE adb shell.
#
# Usage:
#   drag-gh418-plan-item.sh --device SERIAL --handle-id ID [--handle-index N] \
#       (--to-y Y | --by-y DY) [--hold-steps N] [--shot-dir DIR --shot-prefix NAME]
#
#   --handle-id     resource-id of the drag handle, e.g. plan-set-2-drag or
#                   plan-exercise-drag-handle-32 (N-th match in document order)
#   --to-y / --by-y end point (input coordinates) or offset from the handle
#   --hold-steps    ~0.25 s each on this phone (every motionevent spawns a process)
#   --shot-dir      writes <prefix>-mid.png (finger down, after the move) and
#                   <prefix>-hold.png (end of the hold), resized to 600 px wide
set -euo pipefail

DEVICE=""
HANDLE_ID=""
HANDLE_INDEX=0
TO_Y=""
BY_Y=""
HOLD_STEPS=0
SHOT_DIR=""
SHOT_PREFIX="drag"
MOVE_STEPS=16

while [[ $# -gt 0 ]]; do
  case "$1" in
    --device) DEVICE="$2"; shift 2 ;;
    --handle-id) HANDLE_ID="$2"; shift 2 ;;
    --handle-index) HANDLE_INDEX="$2"; shift 2 ;;
    --to-y) TO_Y="$2"; shift 2 ;;
    --by-y) BY_Y="$2"; shift 2 ;;
    --hold-steps) HOLD_STEPS="$2"; shift 2 ;;
    --shot-dir) SHOT_DIR="$2"; shift 2 ;;
    --shot-prefix) SHOT_PREFIX="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
[[ -n "$DEVICE" && -n "$HANDLE_ID" ]] || { echo "--device and --handle-id are required" >&2; exit 2; }

adb_() { adb -s "$DEVICE" "$@"; }

focus=$(adb_ shell dumpsys window | grep -i mCurrentFocus || true)
[[ "$focus" == *powerliftingworkoutplanner* ]] || { echo "ABORT: app not in front ($focus)"; exit 1; }

adb_ shell rm -f /sdcard/gh418_drag.xml >/dev/null 2>&1 || true
adb_ shell uiautomator dump /sdcard/gh418_drag.xml | grep -q 'dumped to' || { echo "uiautomator dump failed" >&2; exit 2; }
xml=$(adb_ shell cat /sdcard/gh418_drag.xml)
mapfile -t handles < <(grep -oE "<node [^>]*resource-id=\"$HANDLE_ID\"[^>]*>" <<<"$xml" || true)
[[ ${#handles[@]} -gt "$HANDLE_INDEX" ]] || { echo "FAIL: handle $HANDLE_ID[$HANDLE_INDEX] not on screen"; exit 1; }
read -r x1 y1 x2 y2 < <(sed -E 's/.*bounds="\[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\]".*/\1 \2 \3 \4/' <<<"${handles[$HANDLE_INDEX]}")
x=$(((x1 + x2) / 2))
y0=$(((y1 + y2) / 2))
if [[ -n "$BY_Y" ]]; then y_end=$((y0 + BY_Y)); else y_end=$TO_Y; fi
[[ -n "$y_end" ]] || { echo "--to-y or --by-y is required" >&2; exit 2; }
echo "drag $HANDLE_ID[$HANDLE_INDEX] from ($x,$y0) to y=$y_end, hold $HOLD_STEPS steps"

dy=$(((y_end - y0) / MOVE_STEPS))
cmd="input motionevent DOWN $x $y0"
for i in $(seq 1 $MOVE_STEPS); do cmd="$cmd && sleep 0.02 && input motionevent MOVE $x $((y0 + i * dy))"; done
cmd="$cmd && input motionevent MOVE $x $y_end"
for i in $(seq 1 "$HOLD_STEPS"); do cmd="$cmd && sleep 0.05 && input motionevent MOVE $x $((y_end + (i % 2)))"; done
# Keep the finger down a moment so a screenshot can catch the hovering state.
cmd="$cmd && sleep 1.5 && input motionevent UP $x $y_end"

shoot() {
  [[ -n "$SHOT_DIR" ]] || return 0
  mkdir -p "$SHOT_DIR"
  adb_ exec-out screencap -p >"$SHOT_DIR/.raw.png"
  ffmpeg -y -loglevel error -i "$SHOT_DIR/.raw.png" -vf scale=600:-1 "$SHOT_DIR/$1.png"
  rm -f "$SHOT_DIR/.raw.png"
}

adb_ shell "$cmd" &
gesture=$!
# The MOVE steps take ~0.15 s each (process spawn); catch the item mid-flight.
sleep $(awk "BEGIN {print ($MOVE_STEPS * 0.17) + 0.3}")
shoot "$SHOT_PREFIX-mid"
if [[ "$HOLD_STEPS" -gt 0 ]]; then
  sleep $(awk "BEGIN {print $HOLD_STEPS * 0.2}")
  shoot "$SHOT_PREFIX-hold"
fi
wait $gesture
sleep 3
shoot "$SHOT_PREFIX-dropped"
echo "done"
