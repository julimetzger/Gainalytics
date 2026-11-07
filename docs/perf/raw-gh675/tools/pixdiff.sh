#!/system/bin/sh
# GH-675: before/after screenshot comparison (ffmpeg on the CI host, like GH-672):
#   sh pixdiff.sh <shots dir>    -> per screen: max / mean grey-level difference below the status bar
# YMAX 0 = pixel-identical. Crops y 100..2400 (the status bar holds the clock).
cd "${1:?shots dir}" || exit 1
for s in ex dash vdetail vdetail-bottom metrics; do
  r=$(ffmpeg -loglevel error -i before-$s.png -i after-$s.png -filter_complex \
    "[0:v]crop=1080:2300:0:100,format=gray[a];[1:v]crop=1080:2300:0:100,format=gray[b];[a][b]blend=all_mode=difference,signalstats,metadata=print:file=-" \
    -f null - | grep -oE "YMAX=[0-9.]+|YAVG=[0-9.]+" | tr '\n' ' ')
  echo "$s: $r"
done
