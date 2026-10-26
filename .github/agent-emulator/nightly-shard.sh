#!/usr/bin/env bash
# GH-589: one shard of the nightly Maestro run (.github/workflows/maestro-nightly.yml).
# Runs inside the android-emulator-runner script (emulator already booted).
#
#   NIGHTLY_FLOWS="00_import_baseline home_dashboard ..."  flow names (without .yaml), in order
#   NIGHTLY_FLOW_TIMEOUT_S=900                             per-flow timeout
#
# Fresh install, all fixtures in /sdcard/Download (same set as the bootstrap of
# __tests__/e2e/scripts/run-maestro-from-wsl.sh), gh415-result.json in the app's files dir.
# Every flow runs once; a failed flow is retried once and the retry is reported.
# Writes <run dir>/results.tsv: flow, result (pass|pass-on-retry|fail|timeout), seconds, retried.
# Exit code is always 0 once the emulator is up; the workflow decides from results.tsv.
set -uo pipefail

ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel)"
TOOL="${ROOT}/.github/agent-emulator/tool.sh"
OUT="${AGENT_RUN_DIR:?AGENT_RUN_DIR not set}"
FLOWS_DIR="${ROOT}/__tests__/e2e/maestro/flows"
FIX="${ROOT}/__tests__/e2e/maestro/fixtures"
APP_ID="com.powerliftingworkoutplanner"
TIMEOUT_S="${NIGHTLY_FLOW_TIMEOUT_S:-900}"
mkdir -p "${OUT}" "${OUT}/retries"
S="$("${TOOL}" serial)"
date +%s > "${OUT}/shard.started"

DOWNLOADS=(
  "${FIX}/baseline.gains"
  "${FIX}/squat-3reps.mp4"
  "${FIX}/squat-1rep.mp4"
  "${FIX}/gh496/gh496_invalid.csv"
  "${FIX}/gh496/gh496_invalid_weight.csv"
  "${FIX}/gh496/gh496_new_record.csv"
  "${FIX}/gh496/strong_sample_export.csv"
  "${FIX}/gh393-compare-labels.gains"
  "${FIX}/gh415-workout-linked-analysis.gains"
  "${ROOT}/__tests__/testdata/gh391_planned_fixture.gains"
  "${ROOT}/__tests__/testdata/gh391_newplan_fixture.gains"
  "${ROOT}/__tests__/testdata/gh508_chat_fixture.gains"
)

"${TOOL}" install || { echo "::error title=nightly::APK install failed"; exit 1; }
for f in "${DOWNLOADS[@]}"; do
  if [[ -f "${f}" ]]; then
    adb -s "${S}" push "${f}" "/sdcard/Download/$(basename "${f}")" >/dev/null
  else
    echo "::warning title=nightly fixture::missing ${f#"${ROOT}/"}"
  fi
done
adb -s "${S}" shell content call --method scan_volume --uri content://media \
  --arg external_primary >/dev/null 2>&1 || true
# video_list_filters_vl reads this from the app's files dir (RNFS cannot read /sdcard/Download).
adb -s "${S}" push "${FIX}/gh415-result.json" /data/local/tmp/gh415-result.json >/dev/null
adb -s "${S}" shell "run-as ${APP_ID} sh -c 'mkdir -p files; cat /data/local/tmp/gh415-result.json > files/gh415-result.json'" || true

adb -s "${S}" logcat -c || true
"${TOOL}" launch
sleep 20

: > "${OUT}/results.tsv"
run_one() {
  local name="$1" t0 rc
  t0=$(date +%s)
  timeout --kill-after=30 "${TIMEOUT_S}" "${TOOL}" flow "${FLOWS_DIR}/${name}.yaml" > /dev/null 2>&1
  rc=$?
  echo "$(( $(date +%s) - t0 )) ${rc}"
}

for name in ${NIGHTLY_FLOWS:?NIGHTLY_FLOWS not set}; do
  if [[ ! -f "${FLOWS_DIR}/${name}.yaml" ]]; then
    printf '%s\tfail\t0\t0\n' "${name}" >> "${OUT}/results.tsv"
    echo "::error title=nightly ${name}::flow file not found"
    continue
  fi
  read -r secs rc < <(run_one "${name}")
  result=pass retried=0
  if [[ "${rc}" != 0 ]]; then
    "${TOOL}" screenshot "fail-${name}" >/dev/null 2>&1 || true
    "${TOOL}" logcat "fail-${name}" >/dev/null 2>&1 || true
    # Keep the failed attempt out of maestro/ so maestro-summary.py reports the final attempt.
    rm -rf "${OUT}/retries/${name}"
    mv "${OUT}/maestro/${name}" "${OUT}/retries/${name}" 2>/dev/null || true
    retried=1
    "${TOOL}" launch >/dev/null 2>&1 || true
    sleep 5
    read -r secs2 rc2 < <(run_one "${name}")
    secs=$(( secs + secs2 ))
    if [[ "${rc2}" == 0 ]]; then
      result=pass-on-retry
    else
      result=fail
      [[ "${rc2}" == 124 || "${rc2}" == 137 ]] && result=timeout
      "${TOOL}" screenshot "fail-${name}-retry" >/dev/null 2>&1 || true
      "${TOOL}" logcat "fail-${name}-retry" >/dev/null 2>&1 || true
    fi
  fi
  printf '%s\t%s\t%s\t%s\n' "${name}" "${result}" "${secs}" "${retried}" >> "${OUT}/results.tsv"
  echo "${name}: ${result} (${secs}s, retried=${retried})"
done

"${TOOL}" logcat shard >/dev/null 2>&1 || true
exit 0
