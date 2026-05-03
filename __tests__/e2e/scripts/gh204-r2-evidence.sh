#!/usr/bin/env bash
set -euo pipefail

# GH-204 r2 — capture five evidence screenshots of the redesigned Training Home.
#
# Why this wrapper exists:
#   1. The debug APK in this repo bakes a stale JS bundle that predates this round.
#   2. RN dev-mode does NOT persist `debug_http_host` across app process death — it
#      reverts to the emulator default (10.0.2.2:8081) on every cold start.
#   3. With Metro running on host port 8085 (orchestrator's E2E_METRO_PORT) and
#      adb reverse tcp:8081 → tcp:8085, the URL must be `localhost:8081` for the
#      device-side fetch to be forwarded to host Metro.
#   4. `run-maestro-from-wsl.sh --mode smoke` force-stops the app right before the
#      flow, which would wipe our URL — so we drive maestro directly here.
#
# Usage:
#   ANDROID_SERIAL=emulator-5556 \
#   E2E_METRO_PORT=8085 E2E_DEVICE_METRO_PORT=8081 \
#   E2E_MAESTRO_DRIVER_PORT=7089 \
#     bash ./__tests__/e2e/scripts/gh204-r2-evidence.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
APP_ID="com.powerliftingworkoutplanner"
DEVICE="${ANDROID_SERIAL:-}"
METRO_PORT="${E2E_METRO_PORT:-8081}"
DEVICE_METRO_PORT="${E2E_DEVICE_METRO_PORT:-8081}"
DRIVER_PORT="${E2E_MAESTRO_DRIVER_PORT:-}"
FLOW="${REPO_ROOT}/__tests__/e2e/maestro/flows/gh204_training_home_dashboard.yaml"
REPORT="${REPO_ROOT}/__tests__/reports/maestro-gh204.xml"

if [[ -z "${DEVICE}" ]]; then
  echo "ANDROID_SERIAL must be set." >&2
  exit 2
fi

adb_dev() { adb -s "${DEVICE}" "$@"; }

# Tap coordinates for the dev menu / bundle dialog on a 1080x2400 device.
TAP_CHANGE_BUNDLE="540 1164"
TAP_URL_FIELD="540 950"
TAP_APPLY="540 1564"
TAP_DONT_ALLOW_GBOARD="540 1560"

echo "[gh204-r2] Ensuring adb reverse tcp:${DEVICE_METRO_PORT} → tcp:${METRO_PORT}..."
adb_dev reverse "tcp:${DEVICE_METRO_PORT}" "tcp:${METRO_PORT}" >/dev/null 2>&1 || true

echo "[gh204-r2] Force-stopping app and relaunching..."
adb_dev shell am force-stop "${APP_ID}" || true
adb_dev shell am start -n "${APP_ID}/.MainActivity" >/dev/null
sleep 6

echo "[gh204-r2] Opening dev menu (keyevent 82)..."
adb_dev shell input keyevent 82
sleep 2

echo "[gh204-r2] Tapping 'Change Bundle Location'..."
adb_dev shell input tap ${TAP_CHANGE_BUNDLE}
sleep 2

echo "[gh204-r2] Clearing URL field..."
adb_dev shell input tap ${TAP_URL_FIELD}
sleep 0.5
for _ in $(seq 1 24); do adb_dev shell input keyevent KEYCODE_DEL ; done
adb_dev shell input text "localhost:8081"
sleep 0.5

echo "[gh204-r2] Tapping APPLY CHANGES..."
adb_dev shell input tap ${TAP_APPLY}
sleep 4

# Gboard might prompt for audio permission first — dismiss with Don't allow.
adb_dev shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || true
adb_dev pull /sdcard/ui.xml /tmp/gh204_r2_ui.xml >/dev/null 2>&1 || true
if grep -q "Allow Gboard" /tmp/gh204_r2_ui.xml 2>/dev/null; then
  echo "[gh204-r2] Dismissing Gboard audio prompt..."
  adb_dev shell input tap ${TAP_DONT_ALLOW_GBOARD}
  sleep 1
  adb_dev shell input tap ${TAP_APPLY}
fi
sleep 8

echo "[gh204-r2] Verifying new bundle loaded (looking for micro-hero-card testID)..."
ATTEMPTS=0
LOADED=0
while [[ "${ATTEMPTS}" -lt 8 ]]; do
  adb_dev shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 || true
  adb_dev pull /sdcard/ui.xml /tmp/gh204_r2_ui.xml >/dev/null 2>&1 || true
  if grep -q "micro-hero-card" /tmp/gh204_r2_ui.xml 2>/dev/null; then
    LOADED=1
    break
  fi
  sleep 4
  ATTEMPTS=$((ATTEMPTS+1))
done
if [[ "${LOADED}" -ne 1 ]]; then
  echo "[gh204-r2] WARN: micro-hero-card not visible after ${ATTEMPTS} attempts." >&2
fi

# Run Maestro directly — DO NOT use run-maestro-from-wsl.sh because it force-stops
# the app between setup and test, which would reset our bundle URL.
MAESTRO_HOME_DIR="${REPO_ROOT}/__tests__/reports/.maestro-home-gh204"
JAVA_HOME_DIR="${REPO_ROOT}/__tests__/reports/.maestro-java-home-gh204"
mkdir -p "${MAESTRO_HOME_DIR}" "${JAVA_HOME_DIR}"
mkdir -p "$(dirname "${REPORT}")"

MAESTRO_CMD=(maestro --device "${DEVICE}")
if [[ -n "${DRIVER_PORT}" ]]; then
  MAESTRO_CMD+=(--driver-host-port "${DRIVER_PORT}")
fi

echo "[gh204-r2] Running Maestro flow ${FLOW}..."
echo "[gh204-r2]   ADB_SERVER_SOCKET=${ADB_SERVER_SOCKET:-(unset)}"
HOME="${MAESTRO_HOME_DIR}" JAVA_TOOL_OPTIONS="-Duser.home=${JAVA_HOME_DIR}" \
  ADB_SERVER_SOCKET="${ADB_SERVER_SOCKET:-}" \
  "${MAESTRO_CMD[@]}" test "${FLOW}" --format junit --output "${REPORT}"
