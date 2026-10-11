#!/usr/bin/env bash
#
# GH-378 on-device verification.
#
# Asserts the resulting rep boundaries of the v7 rep detector on the real 5-rep
# bench recording (analysis-4) stored on the device. Opening the detail screen
# triggers migrateBarTrackingResultIfNeeded, which re-runs detection on the
# stored barPathSeries; the Rep Summary must then show the movement-snapped rep
# times instead of the pause-inflated v6 values:
#   * rep 1 total 5.41s (v6: 5.96s)
#   * rep 5 total 3.46s (v6: 9.76s — it used to absorb a >6s standing pause)
#   * "Rep Summary (5 reps)" — rep count unchanged by the snap
#
# This is the adb-driven equivalent of __tests__/e2e/flows/GH-378-rep-boundaries.yaml.
# It exists because the Maestro driver cannot always read the view hierarchy on the
# physical Samsung device (agent-memory #136). Elements are resolved by testID
# (resource-id or content-desc) from `uiautomator dump`.
#
# Usage: ANDROID_SERIAL=<serial> bash __tests__/e2e/scripts/gh378-verify-on-device.sh
set -uo pipefail

APP_ID="com.powerliftingworkoutplanner"
SERIAL="${ANDROID_SERIAL:-}"
ANALYSIS_ID=4
TMP_XML="$(mktemp -d)/ui.xml"
FAILURES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --analysis) ANALYSIS_ID="$2"; shift 2 ;;
    --device) SERIAL="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "${SERIAL}" ]]; then
  echo "Refusing to run without an explicit device. Set ANDROID_SERIAL or pass --device." >&2
  exit 2
fi

adbs() { adb -s "${SERIAL}" "$@"; }

assert_app_focused() {
  local focus
  focus="$(adbs shell dumpsys window | grep -i mCurrentFocus || true)"
  case "${focus}" in
    *"${APP_ID}"*) return 0 ;;
    *) echo "ABORT: app is not focused: ${focus}" >&2; exit 1 ;;
  esac
}

dump() {
  local attempt
  for attempt in 1 2 3 4 5; do
    if adbs shell uiautomator dump /sdcard/gh378-ui.xml 2>&1 | grep -q "dumped to"; then
      adbs pull /sdcard/gh378-ui.xml "${TMP_XML}" >/dev/null 2>&1
      return 0
    fi
    sleep 2
  done
  adbs pull /sdcard/gh378-ui.xml "${TMP_XML}" >/dev/null 2>&1
}

center_of() {
  python3 - "$1" "${TMP_XML}" <<'PY'
import re, sys
target, path = sys.argv[1], sys.argv[2]
xml = open(path, encoding='utf-8').read()
for node in re.finditer(r'<node[^>]*>', xml):
    s = node.group(0)
    rid = re.search(r'resource-id="([^"]*)"', s)
    cd = re.search(r'content-desc="([^"]*)"', s)
    box = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', s)
    matches = (rid and rid.group(1) == target) or (cd and cd.group(1) == target)
    if matches and box:
        x1, y1, x2, y2 = map(int, box.groups())
        print((x1 + x2) // 2, (y1 + y2) // 2)
        break
PY
}

id_in_dump() {
  grep -qF "resource-id=\"$1\"" "${TMP_XML}" || grep -qF "content-desc=\"$1\"" "${TMP_XML}"
}

wait_for_id() {
  local target="$1" timeout="${2:-120}" waited=0
  while [[ "${waited}" -lt "${timeout}" ]]; do
    dump
    if [[ -n "$(center_of "${target}")" ]]; then
      return 0
    fi
    sleep 3
    waited=$((waited + 3))
  done
  echo "FAIL: element '${target}' never appeared within ${timeout}s" >&2
  return 1
}

tap_id() {
  local coords
  coords="$(center_of "$1")"
  if [[ -z "${coords}" ]]; then
    echo "FAIL: cannot find element '$1' to tap" >&2
    exit 1
  fi
  assert_app_focused
  # shellcheck disable=SC2086
  adbs shell input tap ${coords}
}

# Asserts a testID's node carries the exact text (rep times render as text of the
# testID'd Text node).
assert_id_text() {
  local target="$1" expected="$2"
  local actual
  actual="$(python3 - "${target}" "${TMP_XML}" <<'PY'
import re, sys
target, path = sys.argv[1], sys.argv[2]
xml = open(path, encoding='utf-8').read()
for node in re.finditer(r'<node[^>]*>', xml):
    s = node.group(0)
    rid = re.search(r'resource-id="([^"]*)"', s)
    cd = re.search(r'content-desc="([^"]*)"', s)
    txt = re.search(r'text="([^"]*)"', s)
    if ((rid and rid.group(1) == target) or (cd and cd.group(1) == target)) and txt:
        print(txt.group(1))
        break
PY
)"
  if [[ "${actual}" == "${expected}" ]]; then
    echo "  PASS  ${target} = '${expected}'"
  else
    echo "  FAIL  ${target}: expected '${expected}' but found '${actual}'"
    FAILURES=$((FAILURES + 1))
  fi
}

assert_text_present() {
  if grep -qF "text=\"$1\"" "${TMP_XML}"; then
    echo "  PASS  text present: $1"
  else
    echo "  FAIL  text MISSING: $1"
    FAILURES=$((FAILURES + 1))
  fi
}

open_video_analyses() {
  adbs shell am force-stop "${APP_ID}"
  adbs shell am start -n "${APP_ID}/.MainActivity" >/dev/null 2>&1
  sleep 10
  assert_app_focused
  wait_for_id "tab-analyse" 180 || exit 1
  tap_id "tab-analyse";                  sleep 3
  dump; tap_id "analyse-drawer-toggle";  sleep 3
  local coords
  dump
  coords="$(python3 - "${TMP_XML}" <<'PY'
import re, sys
xml = open(sys.argv[1], encoding='utf-8').read()
for node in re.finditer(r'<node[^>]*>', xml):
    s = node.group(0)
    box = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', s)
    if 'text="Video Analysis"' in s and box:
        x1, y1, x2, y2 = map(int, box.groups())
        print((x1 + x2) // 2, (y1 + y2) // 2)
        break
PY
)"
  if [[ -z "${coords}" ]]; then
    echo "FAIL: 'Video Analysis' drawer entry not found" >&2
    exit 1
  fi
  assert_app_focused
  # shellcheck disable=SC2086
  adbs shell input tap ${coords}
  sleep 4
  assert_app_focused
}

echo "=== GH-378 on-device verification (device ${SERIAL}) ==="
open_video_analyses

echo
echo "--- Analysis #${ANALYSIS_ID}: 5-rep bench with standing pauses ---"
wait_for_id "video-analysis-row-${ANALYSIS_ID}" 60 || exit 1
tap_id "video-analysis-row-${ANALYSIS_ID}"
# Opening the detail triggers the v6→v7 migration (re-runs detection) before render.
sleep 12
assert_app_focused

# Scroll to the Rep Summary: the playback overlay eats centered gestures, so
# swipe along the right edge (input coords are in the 720x1600 override space).
adbs shell input touchscreen swipe 700 1300 700 300 1500
sleep 2
adbs shell input touchscreen swipe 700 1300 700 300 1500
sleep 2
dump
if ! grep -qF 'text="Rep Summary (5 reps)"' "${TMP_XML}"; then
  adbs shell input touchscreen swipe 700 1300 700 500 1500
  sleep 2
  dump
fi

assert_text_present "Rep Summary (5 reps)"
# The actual resulting values of the changed UI (v6 values were 5.96s / 9.76s):
assert_id_text "video-analysis-rep-time-0" "5.41s"
assert_id_text "video-analysis-rep-time-4" "3.46s"

echo
if [[ "${FAILURES}" -gt 0 ]]; then
  echo "=== GH-378 verification FAILED (${FAILURES} assertion(s)) ==="
  exit 1
fi
echo "=== GH-378 verification PASSED ==="
