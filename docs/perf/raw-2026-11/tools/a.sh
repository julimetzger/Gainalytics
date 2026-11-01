#!/bin/bash
# adb with timeout, pinned to the measured device (uses the inherited ADB_SERVER_SOCKET)
exec timeout ${ADB_TIMEOUT:-25} adb -s "${ANDROID_SERIAL:?set ANDROID_SERIAL}" "$@"
