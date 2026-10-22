#!/usr/bin/env bash
# GH-545: device setup that runs in the background while the agent already reads the ticket and
# code. Started by the workflow with nohup; the agent waits for it with `tool.sh wait-ready`.
#
# Status file ${AGENT_RUN_DIR}/setup.status holds one line:
#   building | booting | installing | ready | failed:<step>
# Log: ${AGENT_RUN_DIR}/setup.log (written by the caller's redirect).
set -uo pipefail

ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
OUT="${AGENT_RUN_DIR:-${ROOT}/.agent-run}"
TOOL="${ROOT}/.github/agent-emulator/tool.sh"
STATUS="${OUT}/setup.status"
TIMINGS="${OUT}/timings.txt"
mkdir -p "${OUT}"

status() { echo "$1" > "${STATUS}.tmp" && mv "${STATUS}.tmp" "${STATUS}"; echo "== setup: $1 ($(date +%T))"; }
fail() { status "failed:$1"; exit 1; }
now() { date +%s; }
t_start=$(now)

status building

# Side tasks that only need the network run in parallel with Gradle.
(
  set -e
  if [[ ! -x "$HOME/maestro/bin/maestro" ]]; then
    curl -fsSL -o "${RUNNER_TEMP:-/tmp}/maestro.zip" \
      "https://github.com/mobile-dev-inc/maestro/releases/download/cli-${MAESTRO_VERSION}/maestro.zip"
    echo "${MAESTRO_SHA256}  ${RUNNER_TEMP:-/tmp}/maestro.zip" | sha256sum -c -
    unzip -q -o "${RUNNER_TEMP:-/tmp}/maestro.zip" -d "$HOME"
  fi
  "$HOME/maestro/bin/maestro" --version
) > "${OUT}/setup-maestro.log" 2>&1 &
pid_maestro=$!

(
  set -e
  command -v ffmpeg >/dev/null || sudo apt-get install -y -qq ffmpeg >/dev/null
  img="system-images;android-${API_LEVEL};${AVD_TARGET};${AVD_ARCH}"
  sdk="${ANDROID_HOME}/cmdline-tools/latest/bin/sdkmanager"
  # The AVD comes from the cache; the system image and emulator binary must exist in the SDK too.
  if [[ ! -d "${ANDROID_HOME}/system-images/android-${API_LEVEL}/${AVD_TARGET}/${AVD_ARCH}" \
        || ! -x "${ANDROID_HOME}/emulator/emulator" ]]; then
    yes | "${sdk}" --licenses >/dev/null || true
    "${sdk}" --install "emulator" "platform-tools" "${img}" >/dev/null
  fi
  ls "${ANDROID_HOME}/system-images/android-${API_LEVEL}/${AVD_TARGET}/${AVD_ARCH}" >/dev/null
) > "${OUT}/setup-sdk.log" 2>&1 &
pid_sdk=$!

t0=$(now)
(cd "${ROOT}/android" && ./gradlew assembleDebug -PreactNativeArchitectures=x86_64 --console=plain --no-daemon) \
  || fail gradle
echo "gradle_build_s=$(( $(now) - t0 ))" >> "${TIMINGS}"

wait "${pid_maestro}" || { cat "${OUT}/setup-maestro.log"; fail maestro; }
wait "${pid_sdk}" || { cat "${OUT}/setup-sdk.log"; fail sdk; }

status booting
t0=$(now)
nohup "${ANDROID_HOME}/emulator/emulator" -port 5554 -avd test -no-snapshot-save -no-window \
  -gpu swiftshader_indirect -noaudio -no-boot-anim -camera-back none \
  > "${OUT}/emulator.log" 2>&1 < /dev/null &
"${TOOL}" wait-boot 600 || fail boot
echo "emulator_boot_s=$(( $(now) - t0 ))" >> "${TIMINGS}"

status installing
"${TOOL}" install || fail install
"${TOOL}" launch || fail launch
sleep 15

echo "setup_total_s=$(( $(now) - t_start ))" >> "${TIMINGS}"
status ready
