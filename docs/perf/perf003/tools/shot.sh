#!/bin/bash
# usage: shot.sh out.png
/tmp/a.sh exec-out screencap -p > /tmp/raw_shot.png && ffmpeg -y -i /tmp/raw_shot.png -vf "scale=400:-1" "$1" 2>/dev/null; rm -f /tmp/raw_shot.png
