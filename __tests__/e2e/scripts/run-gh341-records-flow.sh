#!/usr/bin/env bash
# GH-341 driver: prepares the Records screen (navigation + date range via adb),
# then runs the assertion flow gh341_records_redesign.yaml WITHOUT restarting
# the app. Maestro cannot type into the masked DatePickerInput (its inputText
# races the date mask), so the range is set with adb `input text` instead.
#
# Precondition: baseline fixture already imported on the device.
# Usage: ANDROID_SERIAL=<serial> bash run-gh341-records-flow.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
FLOW="${REPO_ROOT}/__tests__/e2e/maestro/flows/gh341_records_redesign.yaml"
DEVICE="${ANDROID_SERIAL:?set ANDROID_SERIAL}"
DRIVER_HOST_PORT="${E2E_MAESTRO_DRIVER_PORT:-7040}"
MAESTRO_RUN_HOME="${E2E_MAESTRO_HOME:-${REPO_ROOT}/__tests__/reports/.maestro-home}"
REPORT_PATH="${REPO_ROOT}/__tests__/reports/maestro-gh341.xml"
MAESTRO_HOST="${E2E_MAESTRO_HOST:-$(awk '/^nameserver / { print $2; exit }' /etc/resolv.conf)}"

# Coordinates assume the device's `wm size` override 720x1600 (R5CN30HWZFN).
tap() { adb -s "$DEVICE" shell input tap "$1" "$2"; sleep "${3:-2}"; }

adb -s "$DEVICE" shell am force-stop com.powerliftingworkoutplanner
adb -s "$DEVICE" shell am start -n com.powerliftingworkoutplanner/.MainActivity

# Wait for the JS bundle: Training tab label appears on the start screen.
for i in $(seq 1 30); do
  adb -s "$DEVICE" shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || true
  if adb -s "$DEVICE" shell cat /sdcard/ui.xml 2>/dev/null | grep -q 'tab-analyse'; then
    break
  fi
  sleep 3
done

tap 450 1462 3   # Analyse tab
tap 45 105 2.5   # drawer hamburger
tap 94 590 4     # Records entry

# Type a date into one of the DatePickerInput fields and verify the masked
# field accepted it (the mask drops characters under fast injection).
field_text() { # $1 = value to look for in an EditText node; returns 0 when present
  adb -s "$DEVICE" shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || true
  adb -s "$DEVICE" shell cat /sdcard/ui.xml 2>/dev/null |
    grep -o "<node[^>]*class=\"android.widget.EditText\"[^>]*>" |
    grep -q "text=\"$1\""
}

set_date() { # $1 = x of input, $2 = value MM/DD/YYYY
  local attempt
  for attempt in 1 2 3 4 5; do
    tap "$1" 228 1.5
    # Cursor to the end, then enough backspaces to clear any accumulated text.
    adb -s "$DEVICE" shell input keyevent 123
    for i in $(seq 1 15); do adb -s "$DEVICE" shell input keyevent 67; done
    sleep 0.5
    # Char-by-char: bulk `input text` races the date mask and drops the last digit.
    local char
    for char in $(echo "$2" | fold -w1); do
      adb -s "$DEVICE" shell input text "$char"
      sleep 0.1
    done
    sleep 1.5
    if field_text "$2"; then
      return 0
    fi
    echo "date field attempt ${attempt} for $2 failed, retrying" >&2
  done
  echo "could not set date field to $2" >&2
  return 1
}

tap 360 385 2.5  # open date range picker
set_date 108 "11/01/2025"
set_date 350 "02/28/2026"
adb -s "$DEVICE" shell input keyevent 111; sleep 1  # close keyboard
tap 598 195 3    # Save

# Verify the confirmed range on the picker button before running assertions.
adb -s "$DEVICE" shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || true
if ! adb -s "$DEVICE" shell cat /sdcard/ui.xml 2>/dev/null | grep -q "01/11/25 to"; then
  echo "range not applied (button text mismatch)" >&2
  exit 1
fi

run_flow() { # $1 = flow file, $2 = report path
  HOME="${MAESTRO_RUN_HOME}" \
    XDG_CACHE_HOME="${MAESTRO_RUN_HOME}/.cache" \
    MAESTRO_CLI_NO_ANALYTICS=1 \
    maestro ${MAESTRO_HOST:+--host "${MAESTRO_HOST}"} --device "${DEVICE}" --driver-host-port "${DRIVER_HOST_PORT}" \
    test "$1" --format junit --output "$2"
}

mkdir -p "$(dirname "${REPORT_PATH}")" "${MAESTRO_RUN_HOME}/.cache"
run_flow "${FLOW}" "${REPORT_PATH}"

# ── Part 2: micro mode. Select the plan accumulation "Push pull" via adb ──
# The dropdown's search field double-commits text on this device (Samsung IME
# race), so searching is unreliable — scroll the UNFILTERED list instead and
# only tap once the row's dumped position has settled inside the modal list.
tap 324 187 2    # open the dropdown
ROW_XY=""
for i in $(seq 1 40); do
  adb -s "$DEVICE" shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
  ROW=$(adb -s "$DEVICE" shell cat /sdcard/ui.xml 2>/dev/null |
    grep -o '<node[^>]*text="Push pull"[^>]*bounds="\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]"' | head -1 |
    grep -o 'bounds="\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]"' || true)
  X=$(echo "$ROW" | tr -dc '0-9,[]' | awk -F'[][,]' '{print int(($2+$5)/2)}')
  Y=$(echo "$ROW" | tr -dc '0-9,[]' | awk -F'[][,]' '{print int(($3+$6)/2)}')
  if [[ -n "$Y" && "$Y" -ge 430 && "$Y" -le 760 ]]; then
    ROW_XY="$X $Y"
    break
  elif [[ -n "$Y" && "$Y" -gt 760 ]]; then
    adb -s "$DEVICE" shell input swipe 360 650 360 500 400; sleep 1.2
  else
    adb -s "$DEVICE" shell input swipe 360 750 360 430 400; sleep 1.2
  fi
done
if [[ -z "$ROW_XY" ]]; then
  echo "could not position 'Push pull' row in dropdown list" >&2
  exit 1
fi
tap $ROW_XY 2
tap 360 1300 2   # tap backdrop below the modal to close it

# Verify the caption switched to micro before running the assertions.
adb -s "$DEVICE" shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
if ! adb -s "$DEVICE" shell cat /sdcard/ui.xml 2>/dev/null | grep -q 'by micro'; then
  echo "accumulation did not switch to plan micro mode" >&2
  exit 1
fi
run_flow "${REPO_ROOT}/__tests__/e2e/maestro/flows/gh341_records_micro.yaml" "${REPORT_PATH%.xml}-micro.xml"
