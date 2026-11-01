#!/usr/bin/env bash
# GH-545: smoke phase of the agent-emulator workflow (smoke_only mode) and of the
# PR check .github/workflows/maestro-smoke.yml (GH-588). Runs inside the
# android-emulator-runner script (emulator already booted).
# Fresh install; baseline.gains is pushed to Downloads and smoke.yaml imports it
# itself (00_import_baseline.yaml), then checks home, analysis and a training run.
set -euo pipefail

ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
TOOL="${ROOT}/.github/agent-emulator/tool.sh"
OUT="${AGENT_RUN_DIR:-${ROOT}/.agent-run}"
FLOW="${SMOKE_FLOW:-${ROOT}/__tests__/e2e/maestro/flows/smoke.yaml}"
mkdir -p "${OUT}"
S="$("${TOOL}" serial)"
"${TOOL}" display-geometry   # GH-636: same screen geometry the flows are calibrated on

now() { date +%s; }
t0=$(now)
# Marker for the workflow: the emulator booted (a failure after this point is not a boot failure,
# so maestro-smoke.yml does not retry it).
date +%s > "${OUT}/smoke.started"
uptime_s="$(adb -s "${S}" shell cat /proc/uptime | awk '{printf "%d", $1}')"
{
  echo "emulator_uptime_at_ready_s=${uptime_s}"
  if [[ -n "${EMULATOR_STEP_START:-}" ]]; then
    echo "emulator_step_to_ready_s=$(( t0 - EMULATOR_STEP_START ))"
  fi
} | tee -a "${OUT}/timings.txt"

adb -s "${S}" shell df -h /data | tail -1 || true

"${TOOL}" install
t_install=$(now)
echo "install_s=$(( t_install - t0 ))" | tee -a "${OUT}/timings.txt"
"${TOOL}" push-baseline

adb -s "${S}" logcat -c || true
"${TOOL}" launch
# Give the embedded-bundle app time for its first cold start before Maestro attaches.
sleep 20
"${TOOL}" screenshot smoke-01-cold-start

status=0
"${TOOL}" flow "${FLOW}" || status=$?
t_flow=$(now)
echo "maestro_flow_s=$(( t_flow - t_install ))" | tee -a "${OUT}/timings.txt"
echo "maestro_flow_exit=${status}" | tee -a "${OUT}/timings.txt"

"${TOOL}" screenshot smoke-02-after-flow
# Relaunch for a reference screenshot of the start screen (baseline data after the flow).
"${TOOL}" launch
sleep 10
"${TOOL}" screenshot smoke-03-relaunch
"${TOOL}" logcat smoke >/dev/null

if grep -q "FATAL EXCEPTION" "${OUT}/logcat/smoke.txt"; then
  echo "::warning::FATAL EXCEPTION in logcat during smoke phase"
fi
if grep -q "packager does not seem to be running\|isMetroRunning(): Async result = false" "${OUT}/logcat/smoke.txt"; then
  echo "App fell back to the embedded JS bundle (expected: no Metro in the smoke phase)"
fi

exit "${status}"
