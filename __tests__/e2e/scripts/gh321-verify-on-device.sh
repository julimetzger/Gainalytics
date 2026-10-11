#!/usr/bin/env bash
#
# GH-321 on-device verification.
#
# Asserts the resulting states of the gallery-backed video playback change:
#   * an analysis whose gallery source was deleted shows "Source video no longer available",
#     hides the player, and still renders the analysis results
#   * an analysis secured via the full-import button reports "Video secured in app"
#     and still plays
#
# This is the adb-driven equivalent of
# __tests__/e2e/maestro/flows/gh321_gallery_backed_playback.yaml. It exists because the
# Maestro driver cannot read the view hierarchy on the physical Samsung device (see
# docs/memory/agent-memory.md #136): every assertion resolves false even though the
# elements are on screen. Elements are resolved by their testID (resource-id or
# content-desc) from `uiautomator dump`, never by hardcoded pixel coordinates.
#
# Usage: ANDROID_SERIAL=<serial> bash __tests__/e2e/scripts/gh321-verify-on-device.sh \
#            --gallery-backed-analysis 6 --secured-analysis 7
set -uo pipefail

APP_ID="com.powerliftingworkoutplanner"
SERIAL="${ANDROID_SERIAL:-}"
GALLERY_ANALYSIS=6
SECURED_ANALYSIS=7
TMP_XML="$(mktemp -d)/ui.xml"
FAILURES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --gallery-backed-analysis) GALLERY_ANALYSIS="$2"; shift 2 ;;
    --secured-analysis) SECURED_ANALYSIS="$2"; shift 2 ;;
    --device) SERIAL="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "${SERIAL}" ]]; then
  echo "Refusing to run without an explicit device. Set ANDROID_SERIAL or pass --device." >&2
  exit 2
fi

adbs() { adb -s "${SERIAL}" "$@"; }

# Never tap while a system dialog owns the window (agent-memory #212).
assert_app_focused() {
  local focus
  focus="$(adbs shell dumpsys window | grep -i mCurrentFocus || true)"
  case "${focus}" in
    *"${APP_ID}"*) return 0 ;;
    *) echo "ABORT: app is not focused: ${focus}" >&2; exit 1 ;;
  esac
}

dump() {
  # uiautomator dump errors with "could not get idle state" while an animation runs
  # (e.g. the Metro "Bundling …%" overlay on first launch). Retry until it produces a file.
  local attempt
  for attempt in 1 2 3 4 5; do
    if adbs shell uiautomator dump /sdcard/gh321-ui.xml 2>&1 | grep -q "dumped to"; then
      adbs pull /sdcard/gh321-ui.xml "${TMP_XML}" >/dev/null 2>&1
      return 0
    fi
    sleep 2
  done
  # Last resort: pull whatever is there so callers still have something to grep.
  adbs pull /sdcard/gh321-ui.xml "${TMP_XML}" >/dev/null 2>&1
}

# Echo "x y" center of the node whose testID matches — RN testIDs surface as either
# resource-id or content-desc in the accessibility tree, so match both.
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

# True if a testID (resource-id or content-desc) is present in the current dump.
id_in_dump() {
  grep -qF "resource-id=\"$1\"" "${TMP_XML}" || grep -qF "content-desc=\"$1\"" "${TMP_XML}"
}

# Poll until the element shows up (debug builds bundle from Metro on first launch).
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

assert_text_present() {
  if grep -qF "text=\"$1\"" "${TMP_XML}"; then
    echo "  PASS  text present: $1"
  else
    echo "  FAIL  text MISSING: $1"
    FAILURES=$((FAILURES + 1))
  fi
}

assert_id_present() {
  if id_in_dump "$1"; then
    echo "  PASS  element present: $1"
  else
    echo "  FAIL  element MISSING: $1"
    FAILURES=$((FAILURES + 1))
  fi
}

assert_id_absent() {
  if id_in_dump "$1"; then
    echo "  FAIL  element unexpectedly present: $1"
    FAILURES=$((FAILURES + 1))
  else
    echo "  PASS  element absent: $1"
  fi
}

open_video_analyses() {
  adbs shell am force-stop "${APP_ID}"
  adbs shell am start -n "${APP_ID}/.MainActivity" >/dev/null 2>&1
  # Debug builds fetch the JS bundle from Metro on first launch.
  sleep 10
  assert_app_focused
  wait_for_id "tab-analyse" 180 || exit 1
  tap_id "tab-analyse";                  sleep 3
  dump; tap_id "analyse-drawer-toggle";  sleep 3
  # The drawer entry has no resource-id; resolve it by its label.
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

echo "=== GH-321 on-device verification (device ${SERIAL}) ==="
open_video_analyses
wait_for_id "video-analysis-import-button" 60 || exit 1
assert_id_present "video-analysis-import-button"

echo
echo "--- Analysis #${GALLERY_ANALYSIS}: gallery-backed, source video deleted ---"
wait_for_id "video-analysis-row-${GALLERY_ANALYSIS}" 60 || exit 1
tap_id "video-analysis-row-${GALLERY_ANALYSIS}"; sleep 8
assert_app_focused; dump
assert_id_present "video-analysis-source-unavailable"
assert_id_absent  "video-analysis-playback-player"
assert_text_present "Source video no longer available"
assert_text_present "The video was removed from the gallery. The analysis results are still available."
# The analysis results must remain usable even though the video is gone.
assert_id_present "video-analysis-playback-speed-plot"
# A vanished source can no longer be pulled into the app.
assert_text_present "The source video is no longer in the gallery and can no longer be imported into the app."

adbs shell input keyevent KEYCODE_BACK; sleep 4; assert_app_focused

echo
echo "--- Analysis #${SECURED_ANALYSIS}: secured in the app via full import ---"
wait_for_id "video-analysis-row-${SECURED_ANALYSIS}" 60 || exit 1
tap_id "video-analysis-row-${SECURED_ANALYSIS}"; sleep 8
assert_app_focused; dump
assert_id_present "video-analysis-playback-player"
assert_id_absent  "video-analysis-source-unavailable"
assert_text_present "Video secured in app"
assert_text_present "This video is stored in the app and will be kept, even if you delete it from the gallery."

echo
if [[ "${FAILURES}" -eq 0 ]]; then
  echo "=== RESULT: PASSED (all assertions held) ==="
  exit 0
fi
echo "=== RESULT: FAILED (${FAILURES} assertion(s)) ==="
exit 1
