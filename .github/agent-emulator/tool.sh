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
#   tool.sh setup-status           background setup state (building/booting/installing/ready/failed:*)
#   tool.sh wait-ready [timeout_s] block until the background setup is ready (APK built, emulator
#                                  booted, app installed); exit 1 + log tail if it failed, exit 3 if
#                                  still running after timeout_s (default 540) -> call again
#   tool.sh push-baseline [file]   only push a .gains fixture as /sdcard/Download/baseline.gains (and
#                                  index it for the file picker) without importing it; for flows that
#                                  import it themselves (smoke.yaml)
#   tool.sh import-baseline [file] push-baseline, then import it
#                                  via 00_import_baseline.yaml and check that "Push pull" is visible
#                                  (default: __tests__/e2e/maestro/fixtures/baseline.gains). The import
#                                  flow waits for "Push pull", so another fixture only works if it
#                                  contains that plan; otherwise push it and write a matching import flow.
#   tool.sh set-ai-key             store the budget-capped real Anthropic test key in the app (Settings >
#                                  AI Configuration) for a LIVE check of an AI feature. The key is typed
#                                  with adb (never via Maestro inputText, whose reports keep the text) and
#                                  is never printed. Exit 4 if this run has no key.
#   tool.sh clear-ai-key           remove the key from the app again (empty input + Save)
set -euo pipefail

ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
OUT="${AGENT_RUN_DIR:-${ROOT}/.agent-run}"
APP_ID="com.powerliftingworkoutplanner"
APK_DEFAULT="${ROOT}/android/app/build/outputs/apk/debug/app-debug.apk"
# Background setup builds in a frozen copy; use that APK until the agent rebuilds in the checkout.
if [[ ! -f "${APK_DEFAULT}" && -f "${RUNNER_TEMP:-/tmp}/build-src/android/app/build/outputs/apk/debug/app-debug.apk" ]]; then
  APK_DEFAULT="${RUNNER_TEMP:-/tmp}/build-src/android/app/build/outputs/apk/debug/app-debug.apk"
fi

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
    # The console output is kept too: its per-command COMPLETED/FAILED lines name the failing step
    # (maestro-summary.py reads it). pipefail keeps Maestro's exit code.
    MAESTRO_CLI_NO_ANALYTICS=1 \
      MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-180000}" \
      maestro --device "${S}" test "${flow}" \
        --format junit --output "${dir}/report.xml" --debug-output "${dir}/debug" 2>&1 \
      | tee "${dir}/console.txt"
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
  setup-status)
    cat "${OUT}/setup.status" 2>/dev/null || echo "not started"
    tail -5 "${OUT}/setup.log" 2>/dev/null || true
    ;;
  wait-ready)
    # Default stays below the agent's 10-min Bash limit; exit 3 = not ready yet, call again.
    timeout_s="${1:-540}"
    start=$(date +%s)
    last=""
    while true; do
      st="$(cat "${OUT}/setup.status" 2>/dev/null || echo "not started")"
      [[ "${st}" != "${last}" ]] && { echo "setup: ${st} (+$(( $(date +%s) - start ))s)"; last="${st}"; }
      case "${st}" in
        ready) exit 0 ;;
        failed:*)
          echo "Background setup failed (${st}). Last log lines:" >&2
          tail -40 "${OUT}/setup.log" >&2 || true
          exit 1 ;;
      esac
      if (( $(date +%s) - start > timeout_s )); then
        echo "Not ready yet after ${timeout_s}s (state: ${st}). Run 'tool.sh wait-ready' again in the foreground." >&2
        exit 3
      fi
      sleep 10
    done
    ;;
  rebuild)
    # Never run a second Gradle build next to the background one.
    "$0" wait-ready 3000
    (cd "${ROOT}/android" && ./gradlew assembleDebug -PreactNativeArchitectures=x86_64 --console=plain && ./gradlew --stop)
    "$0" install
    ;;
  push-baseline)
    fixture="$(realpath "${1:-${ROOT}/__tests__/e2e/maestro/fixtures/baseline.gains}")"
    S="$(serial)"
    # 00_import_baseline.yaml picks the file named baseline.gains in Downloads.
    adb -s "${S}" shell rm -f /sdcard/Download/baseline.gains >/dev/null 2>&1 || true
    adb -s "${S}" push "${fixture}" /sdcard/Download/baseline.gains
    # Index it: the picker's "Recent" view only lists files the media store knows about.
    adb -s "${S}" shell content call --method scan_volume --uri content://media \
      --arg external_primary >/dev/null 2>&1 || true
    ;;
  import-baseline)
    fixture="$(realpath "${1:-${ROOT}/__tests__/e2e/maestro/fixtures/baseline.gains}")"
    S="$(serial)"
    "$0" push-baseline "${fixture}"
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
  set-ai-key)
    keyfile="${RUNNER_TEMP:-/nonexistent}/ai-test-key/key"
    if [[ ! -s "${keyfile}" ]]; then
      echo "No AI test key in this run (secret ANTHROPIC_TEST_API_KEY missing)." >&2
      exit 4
    fi
    key="$(<"${keyfile}")"
    # Only the characters Anthropic keys use, so `adb shell input text` needs no escaping.
    if [[ ! "${key}" =~ ^[A-Za-z0-9_-]+$ ]]; then
      echo "AI test key has unexpected characters; not typed." >&2
      exit 4
    fi
    S="$(serial)"
    "$0" flow "${ROOT}/.github/agent-emulator/flows/ai_key_focus_input.yaml" >/dev/null
    adb -s "${S}" shell input text "${key}"
    unset key
    "$0" flow "${ROOT}/.github/agent-emulator/flows/ai_key_save.yaml" >/dev/null
    echo "AI test key stored in the app (not printed)."
    ;;
  clear-ai-key)
    "$0" flow "${ROOT}/.github/agent-emulator/flows/ai_key_focus_input.yaml" >/dev/null
    "$0" flow "${ROOT}/.github/agent-emulator/flows/ai_key_save.yaml" >/dev/null
    echo "AI key removed from the app."
    ;;
  *)
    sed -n '2,31p' "$0"
    exit 2
    ;;
esac
