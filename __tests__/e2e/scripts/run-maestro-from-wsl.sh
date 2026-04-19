#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

MODE="full"
SUITE_PATH="${REPO_ROOT}/__tests__/e2e/maestro/flows/suite.yaml"
REPORT_PATH="${REPO_ROOT}/__tests__/reports/maestro.xml"
FIXTURE_PATH="${REPO_ROOT}/__tests__/testdata/1772318214222.gains"
VIDEO1_PATH="${REPO_ROOT}/__tests__/e2e/maestro/fixtures/squat-3reps.mp4"
VIDEO2_PATH="${REPO_ROOT}/__tests__/e2e/maestro/fixtures/squat-1rep.mp4"
APP_ID="com.powerliftingworkoutplanner"
MAESTRO_HOST="${E2E_MAESTRO_HOST:-}"
ADB_HOST="${E2E_ADB_HOST:-}"
ADB_PORT="${E2E_ADB_PORT:-5037}"
MAESTRO_RUN_HOME="${E2E_MAESTRO_HOME:-${REPO_ROOT}/__tests__/reports/.maestro-home}"
METRO_PORT="${E2E_METRO_PORT:-8081}"
DEVICE_METRO_PORT="${E2E_DEVICE_METRO_PORT:-8081}"
DRIVER_HOST_PORT="${E2E_MAESTRO_DRIVER_PORT:-}"
DEVICE_ID="${ANDROID_SERIAL:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)
      MODE="$2"
      shift 2
      ;;
    --suite)
      SUITE_PATH="$2"
      shift 2
      ;;
    --report)
      REPORT_PATH="$2"
      shift 2
      ;;
    --fixture)
      FIXTURE_PATH="$2"
      shift 2
      ;;
    --app-id)
      APP_ID="$2"
      shift 2
      ;;
    --host)
      MAESTRO_HOST="$2"
      shift 2
      ;;
    --adb-host)
      ADB_HOST="$2"
      shift 2
      ;;
    --adb-port)
      ADB_PORT="$2"
      shift 2
      ;;
    --metro-port)
      METRO_PORT="$2"
      shift 2
      ;;
    --device-metro-port)
      DEVICE_METRO_PORT="$2"
      shift 2
      ;;
    --driver-host-port)
      DRIVER_HOST_PORT="$2"
      shift 2
      ;;
    --device|--udid)
      DEVICE_ID="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "${MAESTRO_HOST}" ]] && [[ -f "/etc/resolv.conf" ]]; then
  MAESTRO_HOST="$(awk '/^nameserver / { print $2; exit }' /etc/resolv.conf)"
fi

SUITE_PATH="$(realpath "${SUITE_PATH}")"
FIXTURE_PATH="$(realpath "${FIXTURE_PATH}")"
[[ -f "${VIDEO1_PATH}" ]] && VIDEO1_PATH="$(realpath "${VIDEO1_PATH}")"
[[ -f "${VIDEO2_PATH}" ]] && VIDEO2_PATH="$(realpath "${VIDEO2_PATH}")"
REPORT_DIR="$(cd "$(dirname "${REPORT_PATH}")" && pwd)"
REPORT_PATH="${REPORT_DIR}/$(basename "${REPORT_PATH}")"

mkdir -p "$(dirname "${REPORT_PATH}")"
mkdir -p "${MAESTRO_RUN_HOME}/.cache"

if [[ -z "${ADB_HOST}" && -n "${MAESTRO_HOST}" ]]; then
  ADB_HOST="${MAESTRO_HOST}"
fi

ADB_ARGS=()
if [[ -n "${ADB_HOST}" ]]; then
  ADB_ARGS=(-H "${ADB_HOST}" -P "${ADB_PORT}")
  export ADB_SERVER_SOCKET="tcp:${ADB_HOST}:${ADB_PORT}"
else
  unset ADB_SERVER_SOCKET || true
fi
if [[ -n "${DEVICE_ID}" ]]; then
  ADB_ARGS+=(-s "${DEVICE_ID}")
fi

MAESTRO_ARGS=()
if [[ -n "${MAESTRO_HOST}" ]]; then
  MAESTRO_ARGS=(--host "${MAESTRO_HOST}")
fi
if [[ -n "${DEVICE_ID}" ]]; then
  MAESTRO_ARGS+=(--device "${DEVICE_ID}")
fi

adb_cmd() {
  adb "${ADB_ARGS[@]}" "$@"
}

require_explicit_device_if_needed() {
  if [[ -z "${DEVICE_ID}" ]]; then
    echo "Refusing to run Maestro without an explicit Android device. Set ANDROID_SERIAL or pass --device/--udid." >&2
    exit 2
  fi
}

run_maestro_test() {
  local debug_dir
  debug_dir="$(dirname "${REPORT_PATH}")/maestro-debug"
  mkdir -p "${debug_dir}"
  local maestro_test_args=("${MAESTRO_ARGS[@]}")
  if [[ -n "${DRIVER_HOST_PORT}" ]]; then
    maestro_test_args+=(--driver-host-port "${DRIVER_HOST_PORT}")
  fi
  HOME="${MAESTRO_RUN_HOME}" \
    XDG_CACHE_HOME="${MAESTRO_RUN_HOME}/.cache" \
    MAESTRO_CLI_NO_ANALYTICS=1 \
    maestro "${maestro_test_args[@]}" test "${SUITE_PATH}" --format junit --output "${REPORT_PATH}" --debug-output "${debug_dir}"
}

if [[ "${MODE}" == "build" ]]; then
  if ! command -v adb >/dev/null 2>&1; then
    echo "adb is required in WSL PATH for build mode." >&2
    exit 127
  fi
  require_explicit_device_if_needed
  cd "${REPO_ROOT}/android"
  if [[ -x "./gradlew" ]]; then
    ./gradlew assembleDebug
  else
    bash ./gradlew assembleDebug
  fi
  APK_PATH="${REPO_ROOT}/android/app/build/outputs/apk/debug/app-debug.apk"
  if [[ ! -f "${APK_PATH}" ]]; then
    echo "Debug APK not found at ${APK_PATH} after assembleDebug." >&2
    exit 1
  fi
  adb_cmd wait-for-device
  adb_cmd install -r "${APK_PATH}"
  exit 0
fi

if [[ "${MODE}" == "bootstrap" || "${MODE}" == "full" || "${MODE}" == "smoke" ]]; then
  if ! command -v adb >/dev/null 2>&1; then
    echo "adb is required in WSL PATH." >&2
    exit 127
  fi
  if ! command -v maestro >/dev/null 2>&1; then
    echo "maestro is required in WSL PATH." >&2
    exit 127
  fi
  require_explicit_device_if_needed
  adb_cmd push "${FIXTURE_PATH}" "/sdcard/Download/baseline.gains"
  if [[ -f "${VIDEO1_PATH}" ]]; then
    adb_cmd push "${VIDEO1_PATH}" "/sdcard/Download/squat-3reps.mp4"
  fi
  if [[ -f "${VIDEO2_PATH}" ]]; then
    adb_cmd push "${VIDEO2_PATH}" "/sdcard/Download/squat-1rep.mp4"
  fi
  adb_cmd reverse "tcp:${DEVICE_METRO_PORT}" "tcp:${METRO_PORT}" >/dev/null 2>&1 || true
  adb_cmd shell am force-stop "${APP_ID}" >/dev/null 2>&1 || true
fi

if [[ "${MODE}" == "bootstrap" ]]; then
  exit 0
fi

if run_maestro_test; then
  exit 0
fi

sleep 2
if [[ -z "${ADB_HOST}" ]]; then
  adb kill-server || true
  adb start-server
fi
adb_cmd wait-for-device || true
run_maestro_test
