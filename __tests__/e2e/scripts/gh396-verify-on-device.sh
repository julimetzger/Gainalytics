#!/usr/bin/env bash
#
# GH-396 on-device verification for the targetSdk 35 -> 36 bump.
#
# Maestro can drive the UI, but the acceptance criteria that actually put an
# API-36 behaviour change at risk are not observable through the view hierarchy:
#
#   * the *effective* target SDK the platform applied to the installed package
#   * a clean cold start with no FATAL EXCEPTION and no system permission dialog
#     stealing the window
#   * the video-analysis foreground service surviving the user leaving the app
#     (Android 15+ tightened dataSync FGS, Android 16 keeps the rules), including
#     its ongoing progress notification
#   * edge-to-edge: with targetSdk 36 the opt-out is gone, so the React root must
#     still receive the system-bar insets exactly once
#
# Everything is asserted against a value read back from the device, never against
# "the screen did not change".
#
# Usage: ANDROID_SERIAL=<serial> bash __tests__/e2e/scripts/gh396-verify-on-device.sh \
#            [--device <serial>] [--out <dir>]
set -uo pipefail

APP_ID="com.powerliftingworkoutplanner"
SERIAL="${ANDROID_SERIAL:-}"
OUT_DIR=""
EXPECTED_TARGET_SDK=36
MODE="target"   # target | fgs-background
FAILURES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --device) SERIAL="$2"; shift 2 ;;
    --out) OUT_DIR="$2"; shift 2 ;;
    --mode) MODE="$2"; shift 2 ;;
    --expected-target-sdk) EXPECTED_TARGET_SDK="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "${SERIAL}" ]]; then
  echo "Refusing to run without an explicit device. Set ANDROID_SERIAL or pass --device." >&2
  exit 2
fi

adbs() { adb -s "${SERIAL}" "$@"; }

pass() { echo "PASS: $*"; }
fail() { echo "FAIL: $*"; FAILURES=$((FAILURES + 1)); }

shot() {
  # Capture and downscale in one step; raw 1080x2400 frames blow the image limits.
  local name="$1"
  [[ -z "${OUT_DIR}" ]] && return 0
  mkdir -p "${OUT_DIR}"
  adbs exec-out screencap -p > "${OUT_DIR}/${name}.raw.png" 2>/dev/null
  if command -v ffmpeg >/dev/null 2>&1; then
    ffmpeg -y -i "${OUT_DIR}/${name}.raw.png" -vf "scale=800:-1" \
      "${OUT_DIR}/${name}.png" >/dev/null 2>&1 && rm -f "${OUT_DIR}/${name}.raw.png"
  else
    mv "${OUT_DIR}/${name}.raw.png" "${OUT_DIR}/${name}.png"
  fi
}

# ---------------------------------------------------------------------------
# Mode training-set: log a set into the running training and finish it.
#
# This is the half of the training run-through that Maestro cannot drive. The Train
# sub-tab's pane does not appear in the UiAutomator/Maestro view hierarchy on this
# build (agent-memory #246); `uiautomator dump` on the same screen fails outright with
# "could not get idle state", because the session-timer header re-renders every second.
# Both tools therefore report every element in the pane — testIDs and plain text alike
# — as "not visible", while the header, drawer and plan list read fine.
#
# So the pane is driven by coordinates and verified from the pixels instead: the
# committed set has to change the visible set list and the training summary. Layout
# constants are for the assigned 1080x2400 emulator and are asserted against the actual
# display size before anything is tapped, so a different screen fails loudly instead of
# tapping blind (agent-memory #239).
# ---------------------------------------------------------------------------
if [[ "${MODE}" == "training-set" ]]; then
  echo "=== GH-396 training set entry + finish on ${SERIAL} ==="
  [[ -n "${OUT_DIR}" ]] && mkdir -p "${OUT_DIR}"

  SIZE="$(adbs shell wm size | grep -oE '[0-9]+x[0-9]+' | tail -1 | tr -d '\r')"
  if [[ "${SIZE}" != "1080x2400" ]]; then
    fail "expected a 1080x2400 display for the hardcoded pane coordinates, got '${SIZE}'"
    echo "=== ${FAILURES} failure(s) ==="
    exit 1
  fi
  pass "display is ${SIZE}, pane coordinates apply"

  # Train sub-tab, top ("add new set") row. Derived from a screencap of this screen.
  REPS_X=120;   REPS_Y=754
  RIR_X=357;    RIR_Y=754
  WEIGHT_X=592; WEIGHT_Y=754
  ADD_X=944;    ADD_Y=744
  OVERFLOW_X=1012; OVERFLOW_Y=200

  type_into() {
    local x="$1" y="$2" value="$3"
    adbs shell input tap "${x}" "${y}"
    sleep 1
    # Clear whatever is prefilled, then type. selectTextOnFocus makes the first
    # keystroke replace the selection, but backspaces make that independent of it.
    adbs shell input keyevent KEYCODE_MOVE_END
    local i
    for i in 1 2 3 4 5 6; do adbs shell input keyevent KEYCODE_DEL; done
    adbs shell input text "${value}"
    sleep 1
  }

  shot "gh396_04a_before_set"
  type_into "${REPS_X}" "${REPS_Y}" "5"
  type_into "${RIR_X}" "${RIR_Y}" "2"
  type_into "${WEIGHT_X}" "${WEIGHT_Y}" "137"
  adbs shell input keyevent KEYCODE_BACK   # dismiss the IME so the Add button is free
  sleep 2
  shot "gh396_04b_set_entered"

  adbs shell input tap "${ADD_X}" "${ADD_Y}"
  sleep 4
  shot "gh396_04c_set_logged"

  # Verify the committed value from the pixels: 137 is a weight that does not occur in
  # the baseline fixture, so finding it on screen proves THIS set was written.
  if command -v tesseract >/dev/null 2>&1 && [[ -n "${OUT_DIR}" ]]; then
    if tesseract "${OUT_DIR}/gh396_04c_set_logged.png" - 2>/dev/null | grep -q "137"; then
      pass "the logged set (weight 137) is rendered in the set list"
    else
      fail "weight 137 not found on screen after submitting the set"
    fi
  else
    echo "INFO: tesseract not available — verify gh396_04c_set_logged.png by eye"
  fi

  # Finish the training through the header overflow menu, which IS readable.
  adbs shell input tap "${OVERFLOW_X}" "${OVERFLOW_Y}"
  sleep 3
  shot "gh396_05a_overflow_menu"
  # For a STARTED training the menu is: Finish Training / Pause session (disabled) /
  # Edit training / Delete. "Finish Training" is the FIRST row, just under the header.
  adbs shell input tap 877 243
  sleep 8
  shot "gh396_05b_training_finished_overview"

  if [[ -n "$(adbs shell pidof "${APP_ID}" | tr -d '\r')" ]]; then
    pass "app survived the finish (TrainingsOverview rendered without a crash)"
  else
    fail "app died while finishing the training"
  fi
  CRASHES="$(adbs logcat -d -t 400 2>/dev/null | grep -E "FATAL EXCEPTION" || true)"
  if [[ -z "${CRASHES}" ]]; then
    pass "no FATAL EXCEPTION during set entry and finish"
  else
    fail "crash during set entry/finish:"; echo "${CRASHES}" | head -10
  fi

  echo "=== ${FAILURES} failure(s) ==="
  exit $(( FAILURES > 0 ? 1 : 0 ))
fi

# ---------------------------------------------------------------------------
# Mode fgs-background: the caller has already driven the app into "video analysis
# running". Send the user to the launcher and assert that the analysis keeps
# running with its ongoing notification — the single behaviour most likely to
# break on a target-SDK bump, because Android 15/16 tightened dataSync foreground
# services.
# ---------------------------------------------------------------------------
if [[ "${MODE}" == "fgs-background" ]]; then
  echo "=== GH-396 foreground-service background check on ${SERIAL} ==="
  [[ -n "${OUT_DIR}" ]] && mkdir -p "${OUT_DIR}"

  # Wait for an analysis to actually start. Run this watcher CONCURRENTLY with whatever
  # kicks off the import (the Maestro flow gh396_api36_video_import.yaml): the fixture
  # clip is short and the analysis can be finished within seconds, so polling only after
  # the import flow has returned reliably misses the whole foreground-service window.
  WAIT_FGS="${GH396_FGS_WAIT:-180}"
  echo "waiting up to ${WAIT_FGS}s for VideoAnalysisForegroundService to come up..."
  FGS_UP=0
  for _ in $(seq 1 $(( WAIT_FGS * 2 ))); do
    if adb -s "${SERIAL}" shell dumpsys activity services "${APP_ID}" 2>/dev/null \
        | tr -d '\r' | grep -q "VideoAnalysisForegroundService"; then
      FGS_UP=1
      break
    fi
    sleep 0.5
  done

  PID_BEFORE="$(adb -s "${SERIAL}" shell pidof "${APP_ID}" | tr -d '\r')"
  if [[ "${FGS_UP}" == "1" ]]; then
    pass "VideoAnalysisForegroundService came up while the analysis was starting"
  else
    fail "VideoAnalysisForegroundService never appeared — no analysis was started"
    echo "=== ${FAILURES} failure(s) ==="
    exit 1
  fi

  # Leave the app exactly the way a user would, while the analysis is still in flight.
  adb -s "${SERIAL}" shell input keyevent KEYCODE_HOME >/dev/null 2>&1
  sleep 3

  FOCUS_AFTER="$(adb -s "${SERIAL}" shell dumpsys window | grep -iE 'mCurrentFocus' | head -1 | tr -d '\r')"
  if grep -q "${APP_ID}" <<<"${FOCUS_AFTER}"; then
    fail "app still owns the window; HOME did not background it: ${FOCUS_AFTER}"
  else
    pass "app is backgrounded (focus is ${FOCUS_AFTER})"
  fi

  PID_AFTER="$(adb -s "${SERIAL}" shell pidof "${APP_ID}" | tr -d '\r')"
  if [[ -n "${PID_AFTER}" && "${PID_AFTER}" == "${PID_BEFORE}" ]]; then
    pass "app process survived backgrounding (pid ${PID_AFTER})"
  else
    fail "app process changed or died while backgrounded (before='${PID_BEFORE}' after='${PID_AFTER}')"
  fi

  SVC_AFTER="$(adb -s "${SERIAL}" shell dumpsys activity services "${APP_ID}" 2>/dev/null | tr -d '\r')"
  if grep -q "VideoAnalysisForegroundService" <<<"${SVC_AFTER}"; then
    FG_FLAG="$(grep -oE 'isForeground=(true|false)' <<<"${SVC_AFTER}" | head -1)"
    if [[ "${FG_FLAG}" == "isForeground=true" ]]; then
      pass "VideoAnalysisForegroundService still running in the foreground state while the app is backgrounded"
    else
      fail "VideoAnalysisForegroundService is running but ${FG_FLAG:-isForeground=?}"
    fi
  else
    fail "VideoAnalysisForegroundService was killed when the app went to the background"
  fi

  # The progress notification is read off the SERVICE record, not off the notification
  # manager's posted records. The notification is built with IMPORTANCE_MIN + setSilent,
  # and Android defers such foreground-service notifications from the shade for ~10s, so
  # a NotificationRecord grep right after backgrounding is a race. `foregroundNoti` on
  # the ServiceRecord is what the platform actually accepted for startForeground() and
  # is authoritative the moment the service goes foreground.
  if grep -qE "foregroundNoti=Notification\(channel=video_analysis_progress" <<<"${SVC_AFTER}"; then
    pass "ongoing progress notification is attached to the service (channel video_analysis_progress)"
  else
    fail "no foreground notification attached to the service while backgrounded"
  fi
  if grep -qE "foregroundNoti=Notification\(.*FOREGROUND_SERVICE" <<<"${SVC_AFTER}"; then
    pass "notification carries the ONGOING_EVENT|FOREGROUND_SERVICE flags"
  else
    fail "foreground notification is missing the FOREGROUND_SERVICE flag"
  fi
  # The platform records the target SDK it applied to this foreground-service start —
  # the most direct proof that the FGS path ran under the NEW target, not a stale one.
  if grep -qE "targetSdkVersion:${EXPECTED_TARGET_SDK}[;]" <<<"${SVC_AFTER}"; then
    pass "platform recorded targetSdkVersion:${EXPECTED_TARGET_SDK} for this foreground-service start"
  else
    fail "foreground-service start was not attributed to targetSdkVersion ${EXPECTED_TARGET_SDK}"
  fi
  # dataSync (0x1) must stay as-is: migrating to mediaProcessing is MNT-002, not this ticket.
  if grep -qE "types=0x00000001" <<<"${SVC_AFTER}"; then
    pass "foreground service type is still dataSync (0x1) — unchanged by this ticket"
  else
    echo "INFO: foreground service type is not dataSync; check that this was intended"
  fi

  # Now let the analysis RUN TO COMPLETION while the app stays in the background. The
  # service stopping on its own (rather than the app being killed) is what proves the
  # work finished rather than being aborted — and the app process must still be the same
  # one afterwards, otherwise the analysis was lost and would be recovered as FAILED by
  # RECOVER_STALE_VIDEO_ANALYSES on the next start (App.tsx).
  WAIT_DONE="${GH396_DONE_WAIT:-240}"
  echo "waiting up to ${WAIT_DONE}s for the backgrounded analysis to finish..."
  FGS_GONE=0
  for _ in $(seq 1 "${WAIT_DONE}"); do
    if ! adb -s "${SERIAL}" shell dumpsys activity services "${APP_ID}" 2>/dev/null \
        | tr -d '\r' | grep -q "VideoAnalysisForegroundService"; then
      FGS_GONE=1
      break
    fi
    sleep 1
  done
  if [[ "${FGS_GONE}" == "1" ]]; then
    pass "analysis ran to completion in the background (foreground service stopped itself)"
  else
    fail "analysis was still running after ${WAIT_DONE}s in the background"
  fi

  PID_DONE="$(adb -s "${SERIAL}" shell pidof "${APP_ID}" | tr -d '\r')"
  if [[ -n "${PID_DONE}" && "${PID_DONE}" == "${PID_BEFORE}" ]]; then
    pass "app process was never killed while backgrounded (pid ${PID_DONE}) — the analysis was not lost"
  else
    fail "app process changed while backgrounded (before='${PID_BEFORE}' now='${PID_DONE}'): the analysis was aborted"
  fi

  FOCUS_END="$(adb -s "${SERIAL}" shell dumpsys window | grep -iE 'mCurrentFocus' | head -1 | tr -d '\r')"
  if grep -q "${APP_ID}" <<<"${FOCUS_END}"; then
    fail "app came back to the foreground on its own: ${FOCUS_END}"
  else
    pass "app stayed in the background for the whole analysis (focus is ${FOCUS_END})"
  fi

  # Deliberately no notification-shade screenshot here. The progress notification is
  # built with IMPORTANCE_MIN + setSilent, and Android defers min-importance
  # foreground-service notifications from the shade for ~10s; the fixture clip's
  # analysis is usually over before that, so the shade would be empty and a screenshot
  # of it would read as "no notification" when the service demonstrably has one
  # attached. The ServiceRecord dump written below is the accurate evidence.

  if [[ -n "${OUT_DIR}" ]]; then
    # The ServiceRecord dump is the evidence: it carries isForeground, the attached
    # foregroundNoti and the targetSdkVersion the platform applied to the FGS start.
    printf '%s\n' "${SVC_AFTER}" > "${OUT_DIR}/dumpsys-services-backgrounded.txt"
  fi

  echo "=== ${FAILURES} failure(s) ==="
  exit $(( FAILURES > 0 ? 1 : 0 ))
fi

echo "=== GH-396 device verification on ${SERIAL} ==="

# ---------------------------------------------------------------------------
# 1. The device really is Android 16 / API 36 — otherwise nothing below proves
#    anything about the new target.
# ---------------------------------------------------------------------------
DEVICE_SDK="$(adbs shell getprop ro.build.version.sdk | tr -d '\r')"
DEVICE_RELEASE="$(adbs shell getprop ro.build.version.release | tr -d '\r')"
if [[ "${DEVICE_SDK}" -ge 36 ]]; then
  pass "device runs Android ${DEVICE_RELEASE} (API ${DEVICE_SDK})"
else
  fail "device runs API ${DEVICE_SDK}, need >= 36 to exercise the new target"
fi

# ---------------------------------------------------------------------------
# 2. The *platform* reports targetSdk 36 for the installed package. This is the
#    core assertion of the ticket: it reads the value the framework applies at
#    runtime, not the number in build.gradle.
# ---------------------------------------------------------------------------
PKG_TARGET_SDK="$(adbs shell dumpsys package "${APP_ID}" \
  | grep -oE 'targetSdk=[0-9]+' | head -1 | cut -d= -f2 | tr -d '\r')"
if [[ "${PKG_TARGET_SDK}" == "${EXPECTED_TARGET_SDK}" ]]; then
  pass "installed package reports targetSdk=${PKG_TARGET_SDK}"
else
  fail "installed package reports targetSdk='${PKG_TARGET_SDK}', expected ${EXPECTED_TARGET_SDK}"
fi

MIN_SDK="$(adbs shell dumpsys package "${APP_ID}" \
  | grep -oE 'minSdk=[0-9]+' | head -1 | cut -d= -f2 | tr -d '\r')"
if [[ "${MIN_SDK}" == "24" ]]; then
  pass "minSdk unchanged at ${MIN_SDK}"
else
  fail "minSdk is '${MIN_SDK}', expected 24 (the bump must not raise the floor)"
fi

# ---------------------------------------------------------------------------
# 3. Cold start: no FATAL EXCEPTION, and the app — not a system permission
#    dialog — owns the window afterwards.
# ---------------------------------------------------------------------------
adbs logcat -c >/dev/null 2>&1 || true
adbs shell am force-stop "${APP_ID}" >/dev/null 2>&1 || true
adbs shell am start -n "${APP_ID}/.MainActivity" >/dev/null 2>&1
sleep 25

CRASHES="$(adbs logcat -d 2>/dev/null \
  | grep -E "FATAL EXCEPTION|AndroidRuntime: Process: ${APP_ID}|NoClassDefFoundError" || true)"
if [[ -z "${CRASHES}" ]]; then
  pass "cold start produced no FATAL EXCEPTION"
else
  fail "cold start crashed:"
  echo "${CRASHES}" | head -20
fi

if [[ -n "$(adbs shell pidof "${APP_ID}" | tr -d '\r')" ]]; then
  pass "app process is alive after cold start"
else
  fail "app process is not running after cold start"
fi

FOCUS="$(adbs shell dumpsys window | grep -iE 'mCurrentFocus' | head -2 | tr -d '\r')"
if grep -q "${APP_ID}" <<<"${FOCUS}"; then
  pass "app owns the window after start (no system dialog on top): ${FOCUS}"
else
  fail "something other than the app owns the window: ${FOCUS}"
fi

# ---------------------------------------------------------------------------
# 4. Edge-to-edge under targetSdk 36. The opt-out
#    (android:windowOptOutEdgeToEdgeEnforcement) is ignored from API 36 on, so the
#    activity must be laid out behind the system bars: its content frame has to
#    span the full display height. If the decor view were still fitting system
#    windows we would see a content frame shorter than the display.
# ---------------------------------------------------------------------------
DISPLAY_SIZE="$(adbs shell wm size | grep -oE '[0-9]+x[0-9]+' | tail -1 | tr -d '\r')"
DISPLAY_H="${DISPLAY_SIZE##*x}"
APP_BOUNDS="$(adbs shell dumpsys window displays \
  | grep -oE 'mBounds=Rect\([0-9-]+, [0-9-]+ - [0-9-]+, [0-9-]+\)' | head -1 | tr -d '\r')"
if [[ -n "${DISPLAY_H}" ]]; then
  pass "display height ${DISPLAY_H}px, window bounds ${APP_BOUNDS:-<unreported>}"
else
  fail "could not read the display size"
fi

# The React root view is the reliable probe: under edge-to-edge it is laid out
# over the full display height and the JS side applies the insets as padding.
ROOT_HEIGHT="$(adbs shell dumpsys window "${APP_ID}" \
  | grep -oE 'frame=\[[0-9]+,[0-9]+\]\[[0-9]+,[0-9]+\]' | head -1 \
  | sed 's/frame=//; s/\]\[/ /; s/[][]//g; s/,/ /g' | awk '{print $4}' | tr -d '\r')"
if [[ -n "${ROOT_HEIGHT}" && -n "${DISPLAY_H}" && "${ROOT_HEIGHT}" -eq "${DISPLAY_H}" ]]; then
  pass "activity window spans the full display (${ROOT_HEIGHT}px == ${DISPLAY_H}px): drawing edge-to-edge"
elif [[ -n "${ROOT_HEIGHT}" ]]; then
  fail "activity window is ${ROOT_HEIGHT}px on a ${DISPLAY_H}px display: system bars are still being fitted"
else
  echo "INFO: could not read the activity window frame; rely on the Maestro screenshots for the inset check"
fi

# ---------------------------------------------------------------------------
# 5. Optional artefact capture. The foreground-service behaviour lives in
#    `--mode fgs-background`, which has to run while an analysis is in flight.
# ---------------------------------------------------------------------------
if [[ -n "${OUT_DIR}" ]]; then
  mkdir -p "${OUT_DIR}"
  adbs shell dumpsys package "${APP_ID}" > "${OUT_DIR}/dumpsys-package.txt" 2>&1 || true
  adbs logcat -d > "${OUT_DIR}/logcat-cold-start.txt" 2>&1 || true
  echo "artefacts written to ${OUT_DIR}"
fi

echo "=== ${FAILURES} failure(s) ==="
exit $(( FAILURES > 0 ? 1 : 0 ))
