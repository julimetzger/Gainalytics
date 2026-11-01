#!/bin/bash
# usage: shot.sh <name> [width]  -> $R/screenshots/<name>.png (resized)
R=${PERF004_RUN_DIR:-$(dirname $(dirname $(dirname "$(readlink -f "$0")")))}
adb -s ${ANDROID_SERIAL:?set ANDROID_SERIAL} exec-out screencap -p > /tmp/perf004raw.png
ffmpeg -y -i /tmp/perf004raw.png -vf "scale=${2:-800}:-1" $R/screenshots/$1.png 2>/dev/null
ffmpeg -y -i /tmp/perf004raw.png -vf "scale=360:-1" /tmp/perf004small.png 2>/dev/null
rm -f /tmp/perf004raw.png; echo $R/screenshots/$1.png
