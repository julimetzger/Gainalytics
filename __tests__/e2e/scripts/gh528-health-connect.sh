#!/usr/bin/env bash
# GH-528: Health Connect test data and checks for the gh528_* Maestro flows (debug builds only).
#
#   gh528-health-connect.sh <serial> seed-weights "82.5@1,84.0@400"   # kg@days ago, written by Gainalytics (debug)
#   gh528-health-connect.sh <serial> dump                              # logs Gainalytics' sessions + all weights
#   gh528-health-connect.sh <serial> clear                             # deletes Gainalytics' weights + sessions
#   gh528-health-connect.sh <serial> revoke-all | grant-write-weight
#
# Seeding goes through the debug-only HealthConnectTestDataActivity (release builds have no
# WRITE_WEIGHT). Its output is read back from logcat (tag GainalyticsHcTestData).
set -euo pipefail

SERIAL="${1:?usage: $0 <serial> <command> [args]}"
CMD="${2:?missing command}"
APP_ID="com.powerliftingworkoutplanner"
ACTIVITY="${APP_ID}/.healthconnect.HealthConnectTestDataActivity"
TAG="GainalyticsHcTestData"
HC="android.permission.health"

run_activity() {
  adb -s "${SERIAL}" logcat -c
  adb -s "${SERIAL}" shell am start -W -n "${ACTIVITY}" "$@" >/dev/null
  for _ in $(seq 1 30); do
    if adb -s "${SERIAL}" logcat -d -s "${TAG}:*" | grep -qE "${TAG}: (done|failed)"; then
      adb -s "${SERIAL}" logcat -d -s "${TAG}:*" | grep "${TAG}:" | sed 's/^.*'"${TAG}"': //'
      return 0
    fi
    sleep 1
  done
  echo "no result from ${ACTIVITY}" >&2
  return 1
}

case "${CMD}" in
  grant-write-weight)
    adb -s "${SERIAL}" shell pm grant "${APP_ID}" "${HC}.WRITE_WEIGHT"
    ;;
  seed-weights)
    adb -s "${SERIAL}" shell pm grant "${APP_ID}" "${HC}.WRITE_WEIGHT" || true
    run_activity --es weights "${3:?weights spec}"
    ;;
  dump)
    run_activity --ez dump true
    ;;
  clear)
    # Deleting needs the write permission of each record type (deleted by time range, own records only).
    adb -s "${SERIAL}" shell pm grant "${APP_ID}" "${HC}.WRITE_WEIGHT" || true
    adb -s "${SERIAL}" shell pm grant "${APP_ID}" "${HC}.WRITE_EXERCISE" || true
    run_activity --ez clear true --ez dump true
    ;;
  revoke-all)
    for p in READ_EXERCISE WRITE_EXERCISE READ_WEIGHT WRITE_WEIGHT READ_HEALTH_DATA_HISTORY; do
      adb -s "${SERIAL}" shell pm revoke "${APP_ID}" "${HC}.${p}" 2>/dev/null || true
    done
    ;;
  *)
    echo "unknown command ${CMD}" >&2
    exit 2
    ;;
esac
