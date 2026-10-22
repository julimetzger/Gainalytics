#!/usr/bin/env bash
# GH-545: small device helper for the agent-emulator workflow.
# Used by the smoke phase and by the Claude Code agent inside the workflow.
# Every adb call passes -s and every Maestro call passes --device explicitly.
#
#   tool.sh serial                 print the emulator serial
#   tool.sh wait-boot [timeout_s]  wait until sys.boot_completed=1
#   tool.sh install [apk]          adb install -r the debug APK
#   tool.sh launch                 force-stop + cold start the app
#   tool.sh screenshot <name>      save .agent-run/screenshots/<name>.png
#   tool.sh flow <flow.yaml>       run one Maestro flow, report under .agent-run/maestro/<name>/
#   tool.sh logcat [label]         dump logcat to .agent-run/logcat/<label>.txt
#   tool.sh metro-start            start Metro on :8081 (the emulator reaches it via 10.0.2.2)
#   tool.sh rebuild                assembleDebug (x86_64 only) + install
#   tool.sh import-baseline [file] push a .gains fixture as /sdcard/Download/baseline.gains, import it
#                                  via 00_import_baseline.yaml and check that "Push pull" is visible
#                                  (default: __tests__/e2e/maestro/fixtures/baseline.gains). The import
#                                  flow waits for "Push pull", so another fixture only works if it
#                                  contains that plan; otherwise push it and write a matching import flow.
set -euo pipefail

ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
OUT="${AGENT_RUN_DIR:-${ROOT}/.agent-run}"
APP_ID="com.powerliftingworkoutplanner"
APK_DEFAULT="${ROOT}/android/app/build/outputs/apk/debug/app-debug.apk"

serial() {
  if [[ -n "${ANDROID_SERIAL:-}" ]]; then
    echo "${ANDROID_SERIAL}"
    return
  fi
  local s
  s="$(adb devices | awk 'NR>1 && $2=="device" {print $1; exit}')"
  if [[ -z "${s}" ]]; then
    echo "No booted Android device found" >&2
    exit 1
  fi
  echo "${s}"
}

cmd="${1:-}"
shift || true

case "${cmd}" in
  serial)
    serial
    ;;
  wait-boot)
    timeout_s="${1:-600}"
    start=$(date +%s)
    adb wait-for-device
    S="$(serial)"
    until [[ "$(adb -s "${S}" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; do
      if (( $(date +%s) - start > timeout_s )); then
        echo "Emulator did not boot within ${timeout_s}s" >&2
        exit 1
      fi
      sleep 3
    done
    adb -s "${S}" shell input keyevent 82 >/dev/null 2>&1 || true
    for k in window_animation_scale transition_animation_scale animator_duration_scale; do
      adb -s "${S}" shell settings put global "${k}" 0.0
    done
    echo "booted after $(( $(date +%s) - start ))s"
    ;;
  install)
    S="$(serial)"
    adb -s "${S}" install -r "${1:-${APK_DEFAULT}}"
    ;;
  launch)
    S="$(serial)"
    adb -s "${S}" shell am force-stop "${APP_ID}"
    adb -s "${S}" shell monkey -p "${APP_ID}" -c android.intent.category.LAUNCHER 1 >/dev/null
    ;;
  screenshot)
    name="${1:?usage: tool.sh screenshot <name>}"
    S="$(serial)"
    mkdir -p "${OUT}/screenshots"
    adb -s "${S}" exec-out screencap -p > "${OUT}/screenshots/${name}.png"
    echo "${OUT}/screenshots/${name}.png"
    # Reduced copy (540 px wide) for reading the image back; raw device shots are too large.
    if command -v ffmpeg >/dev/null 2>&1; then
      mkdir -p "${OUT}/screenshots/small"
      ffmpeg -loglevel error -y -i "${OUT}/screenshots/${name}.png" -vf "scale=540:-1" \
        "${OUT}/screenshots/small/${name}.png"
      echo "${OUT}/screenshots/small/${name}.png"
    fi
    ;;
  flow)
    flow="$(realpath "${1:?usage: tool.sh flow <flow.yaml>}")"
    name="$(basename "${flow}" .yaml)"
    S="$(serial)"
    dir="${OUT}/maestro/${name}"
    mkdir -p "${dir}"
    # takeScreenshot writes relative to the Maestro CWD, so run inside the report dir.
    cd "${dir}"
    MAESTRO_CLI_NO_ANALYTICS=1 \
      MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-180000}" \
      maestro --device "${S}" test "${flow}" \
        --format junit --output "${dir}/report.xml" --debug-output "${dir}/debug"
    ;;
  logcat)
    label="${1:-logcat-$(date +%H%M%S)}"
    S="$(serial)"
    mkdir -p "${OUT}/logcat"
    adb -s "${S}" logcat -d -v threadtime > "${OUT}/logcat/${label}.txt" || true
    echo "${OUT}/logcat/${label}.txt"
    ;;
  metro-start)
    mkdir -p "${OUT}"
    cd "${ROOT}"
    nohup npx react-native start --port 8081 > "${OUT}/metro.log" 2>&1 < /dev/null &
    for _ in $(seq 1 60); do
      if curl -fs http://127.0.0.1:8081/status >/dev/null 2>&1; then
        echo "Metro running on :8081 (emulator uses 10.0.2.2:8081); relaunch the app to load it"
        exit 0
      fi
      sleep 2
    done
    echo "Metro did not come up, see ${OUT}/metro.log" >&2
    exit 1
    ;;
  rebuild)
    (cd "${ROOT}/android" && ./gradlew assembleDebug -PreactNativeArchitectures=x86_64 --console=plain && ./gradlew --stop)
    "$0" install
    ;;
  import-baseline)
    fixture="$(realpath "${1:-${ROOT}/__tests__/e2e/maestro/fixtures/baseline.gains}")"
    S="$(serial)"
    # 00_import_baseline.yaml picks the file named baseline.gains in Downloads.
    adb -s "${S}" shell rm -f /sdcard/Download/baseline.gains >/dev/null 2>&1 || true
    adb -s "${S}" push "${fixture}" /sdcard/Download/baseline.gains
    "$0" flow "${ROOT}/__tests__/e2e/maestro/flows/00_import_baseline.yaml"
    adb -s "${S}" shell uiautomator dump /sdcard/ui-after-import.xml >/dev/null
    mkdir -p "${OUT}/checks"
    adb -s "${S}" pull /sdcard/ui-after-import.xml "${OUT}/checks/ui-after-import.xml" >/dev/null
    if [[ "$(basename "${fixture}")" == "baseline.gains" ]] \
      && ! grep -q "Push pull" "${OUT}/checks/ui-after-import.xml"; then
      echo "Baseline data not loaded (\"Push pull\" not visible) — ABORT" >&2
      exit 1
    fi
    echo "Imported $(basename "${fixture}")"
    ;;
  *)
    sed -n '2,18p' "$0"
    exit 2
    ;;
esac
