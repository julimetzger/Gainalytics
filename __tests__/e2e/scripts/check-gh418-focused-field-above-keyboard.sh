#!/usr/bin/env bash
# GH-418 (UX audit GH-498 F1): automated check that the focused input sits ABOVE
# the soft keyboard. Maestro has no position assertion, so this reads the focused
# EditText's bounds from a uiautomator dump and the keyboard's top edge from
# `dumpsys window` (IME window frame top + its given content inset), both in the
# input coordinate space (the `wm size` override on the test phone).
#
# Usage:
#   check-gh418-focused-field-above-keyboard.sh --device SERIAL [--tap-id ID [--tap-index N]] \
#       [--expect-id-prefix PREFIX] [--no-move-down] [--label NAME] [--out DIR]
#
#   --tap-id ID        tap the EditText with this resource-id first (N-th match in
#                      document order, default 0 = first; -1 = the last one that is
#                      fully above the bottom navigation). Without it the field that
#                      is focused right now is checked.
#   --keep-keyboard    do not close the keyboard before the tap: checks a focus
#                      CHANGE while the keyboard stays open (field to field).
#   --maestro-hierarchy read the views through `maestro hierarchy` instead of
#                      uiautomator — needed on a RUNNING training, where the
#                      ticking header timer makes `uiautomator dump` fail
#                      ("could not get idle state"). Needs --maestro-host and
#                      --driver-host-port (the adb proxy / driver port of the run).
#   --no-move-down     also fail if the tapped field ended up LOWER on screen than
#                      before the tap — that is the "list jumps to the top" bug.
#   --expect-id-prefix the focused field's resource-id must start with this.
#
# Exit codes: 0 pass, 1 check failed, 2 measurement failed (no dump/keyboard).
set -euo pipefail

DEVICE=""
TAP_ID=""
TAP_INDEX=0
EXPECT_PREFIX=""
NO_MOVE_DOWN=0
KEEP_KEYBOARD=0
USE_MAESTRO=0
MAESTRO_HOST=""
DRIVER_PORT="${E2E_MAESTRO_DRIVER_PORT:-7001}"
LABEL="check"
OUT_DIR="${TMPDIR:-/tmp}"
# Breathing room the field must keep to the keyboard (px in input space; the
# phone runs at density 2, so 8 px = 4 dp).
MIN_GAP=8

while [[ $# -gt 0 ]]; do
  case "$1" in
    --device) DEVICE="$2"; shift 2 ;;
    --tap-id) TAP_ID="$2"; shift 2 ;;
    --tap-index) TAP_INDEX="$2"; shift 2 ;;
    --expect-id-prefix) EXPECT_PREFIX="$2"; shift 2 ;;
    --no-move-down) NO_MOVE_DOWN=1; shift ;;
    --keep-keyboard) KEEP_KEYBOARD=1; shift ;;
    --maestro-hierarchy) USE_MAESTRO=1; shift ;;
    --maestro-host) MAESTRO_HOST="$2"; shift 2 ;;
    --driver-host-port) DRIVER_PORT="$2"; shift 2 ;;
    --label) LABEL="$2"; shift 2 ;;
    --out) OUT_DIR="$2"; shift 2 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
[[ -n "$DEVICE" ]] || { echo "--device is required" >&2; exit 2; }
mkdir -p "$OUT_DIR"

adb_() { adb -s "$DEVICE" "$@"; }

# Writes the Maestro view hierarchy as one '<node …>' line per view, in the same
# attribute format the uiautomator parsing below expects.
dump_maestro() {
  local target="$1" json="$1.json"
  local host_args=()
  [[ -n "$MAESTRO_HOST" ]] && host_args=(--host "$MAESTRO_HOST")
  HOME="${E2E_MAESTRO_HOME:-$HOME}" XDG_CACHE_HOME="${E2E_MAESTRO_HOME:-$HOME}/.cache" MAESTRO_CLI_NO_ANALYTICS=1 \
    timeout 120 maestro "${host_args[@]}" --device "$DEVICE" --driver-host-port "$DRIVER_PORT" hierarchy >"$json" 2>/dev/null
  python3 - "$json" >"$target" <<'PY'
import json, sys
def walk(node):
    a = node.get('attributes', {})
    if a.get('bounds'):
        print('<node class="%s" resource-id="%s" text="%s" focused="%s" bounds="%s">' % (
            a.get('class', ''), a.get('resource-id', ''), a.get('text', '').replace('"', "'"), a.get('focused', 'false'), a['bounds']))
    for child in node.get('children', []):
        walk(child)
walk(json.load(open(sys.argv[1])))
PY
}

dump() {
  local target="$1" attempt out
  if [[ $USE_MAESTRO -eq 1 ]]; then
    dump_maestro "$target"
    return $?
  fi
  for attempt in 1 2 3 4 5; do
    adb_ shell rm -f /sdcard/gh418_ui.xml >/dev/null 2>&1 || true
    out=$(adb_ shell uiautomator dump /sdcard/gh418_ui.xml 2>&1 || true)
    if grep -q 'dumped to' <<<"$out"; then
      adb_ pull /sdcard/gh418_ui.xml "$target" >/dev/null
      return 0
    fi
    sleep 1
  done
  echo "uiautomator dump failed: $out" >&2
  return 1
}

# Prints "x1 y1 x2 y2" for a bounds="[x1,y1][x2,y2]" attribute value.
bounds_of() { sed -E 's/.*bounds="\[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\]".*/\1 \2 \3 \4/'; }

edit_nodes() {
  # One EditText node per line, in document order.
  grep -oE '<node [^>]*class="android.widget.EditText"[^>]*>' "$1" || true
}

keyboard_top() {
  local win frame_top inset_top
  win=$(adb_ shell dumpsys window windows | grep -A60 'Window{[^}]*InputMethod}' || true)
  frame_top=$(grep -oE ' frame=\[[0-9]+,[0-9]+\]' <<<"$win" | head -1 | sed -E 's/.*,([0-9]+)\]/\1/')
  inset_top=$(grep -oE 'mGivenContentInsets=\[[0-9]+,[0-9]+\]' <<<"$win" | head -1 | sed -E 's/.*,([0-9]+)\]/\1/')
  [[ -n "$frame_top" && -n "$inset_top" ]] || return 1
  echo $((frame_top + inset_top))
}

ime_shown() { adb_ shell dumpsys input_method | grep -q 'mInputShown=true'; }

nav_top() {
  # Top edge of the bottom navigation (tab-training), or the screen height.
  local line
  line=$(grep -oE '<node [^>]*(resource-id|content-desc)="tab-training"[^>]*>' "$1" | head -1 || true)
  if [[ -n "$line" ]]; then
    bounds_of <<<"$line" | awk '{print $2}'
  else
    adb_ shell wm size | grep -oE '[0-9]+x[0-9]+' | tail -1 | cut -dx -f2
  fi
}

BEFORE_TOP=""
if [[ -n "$TAP_ID" ]]; then
  if [[ $KEEP_KEYBOARD -eq 0 ]] && ime_shown; then
    adb_ shell input keyevent 4
    sleep 1.2
  fi
  dump "$OUT_DIR/$LABEL-before.xml"
  mapfile -t matches < <(edit_nodes "$OUT_DIR/$LABEL-before.xml" | grep "resource-id=\"$TAP_ID\"")
  [[ ${#matches[@]} -gt 0 ]] || { echo "FAIL [$LABEL]: no EditText $TAP_ID on screen"; exit 1; }
  if [[ "$TAP_INDEX" == "-1" ]]; then
    # Only a field the user can actually see can be tapped: above the bottom
    # navigation, or above the keyboard while it is open.
    if ime_shown; then
      limit=$(keyboard_top)
    else
      limit=$(nav_top "$OUT_DIR/$LABEL-before.xml")
    fi
    pick=""
    for node in "${matches[@]}"; do
      read -r _ _ _ y2 < <(bounds_of <<<"$node")
      if (( y2 <= limit )); then pick="$node"; fi
    done
    [[ -n "$pick" ]] || { echo "FAIL [$LABEL]: no fully visible $TAP_ID"; exit 1; }
  else
    pick="${matches[$TAP_INDEX]}"
  fi
  read -r x1 y1 x2 y2 < <(bounds_of <<<"$pick")
  BEFORE_TOP=$y1
  echo "[$LABEL] tapping $TAP_ID at y=$y1..$y2 (keyboard $([[ $KEEP_KEYBOARD -eq 1 ]] && echo open || echo closed))"
  adb_ shell input tap $(((x1 + x2) / 2)) $(((y1 + y2) / 2))
  # Keyboard animation + the scroll correction (120 ms delay + animated scroll).
  sleep 2.5
fi

ime_shown || { echo "FAIL [$LABEL]: soft keyboard is not shown"; exit 1; }
KB_TOP=$(keyboard_top) || { echo "MEASURE-FAIL [$LABEL]: could not read the keyboard frame"; exit 2; }
dump "$OUT_DIR/$LABEL-after.xml"
focused=$(edit_nodes "$OUT_DIR/$LABEL-after.xml" | grep 'focused="true"' | head -1 || true)
[[ -n "$focused" ]] || { echo "FAIL [$LABEL]: no focused EditText"; exit 1; }
fid=$(grep -oE 'resource-id="[^"]*"' <<<"$focused" | head -1 | cut -d'"' -f2)
ftext=$(grep -oE ' text="[^"]*"' <<<"$focused" | head -1 | cut -d'"' -f2)
read -r fx1 fy1 fx2 fy2 < <(bounds_of <<<"$focused")

status=0
echo "[$LABEL] focused=$fid text='$ftext' bounds=[$fx1,$fy1][$fx2,$fy2] keyboardTop=$KB_TOP gap=$((KB_TOP - fy2))"
if [[ -n "$EXPECT_PREFIX" && "$fid" != "$EXPECT_PREFIX"* ]]; then
  echo "FAIL [$LABEL]: focused field $fid does not match $EXPECT_PREFIX"; status=1
fi
if (( fy2 + MIN_GAP > KB_TOP )); then
  echo "FAIL [$LABEL]: focused field bottom $fy2 is not above the keyboard top $KB_TOP"; status=1
fi
if (( fy1 < 0 )); then
  echo "FAIL [$LABEL]: focused field is above the screen"; status=1
fi
if [[ $NO_MOVE_DOWN -eq 1 && -n "$BEFORE_TOP" ]] && (( fy1 > BEFORE_TOP )); then
  echo "FAIL [$LABEL]: the field moved DOWN from y=$BEFORE_TOP to y=$fy1 (list jumped towards its start)"; status=1
fi
if [[ $status -eq 0 ]]; then
  echo "PASS [$LABEL]"
fi
exit $status
