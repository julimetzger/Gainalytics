#!/bin/bash
# adb with a timeout, pinned to one device. Install as /tmp/a.sh (see README.md).
#   ANDROID_SERIAL  serial of the measured device (required)
#   PERF_ADB_HOST   adb server host, e.g. an orchestrator filter proxy (default 127.0.0.1)
#   PERF_ADB_PORT   adb server port (default 5037)
exec timeout ${ADB_TIMEOUT:-25} adb -H "${PERF_ADB_HOST:-127.0.0.1}" -P "${PERF_ADB_PORT:-5037}" -s "${ANDROID_SERIAL:?set ANDROID_SERIAL}" "$@"
