#!/system/bin/sh
# GH-675: Metrics Overview after prep5c.yaml (Bankdruecken, current week = stale): tap the stale-range banner
# action ("Show up to Mon, 23/02/26" -> RangeSwiper setRange), then swipe one period back and two forward.
# Screenshot after every step, to compare the before and after builds pixel by pixel (setRange is a stable
# callback since GH-675 and MetricsNode panes skip renders when their period did not change).
#   adb shell sh /data/local/tmp/metrics-banner.sh <prefix>
X=${1:?prefix}
O=/data/local/tmp/gh675/shots
mkdir -p $O
input tap 358 856; sleep 3; screencap -p $O/$X-mbanner-1-applied.png
input swipe 150 1400 900 1400 150; sleep 3; screencap -p $O/$X-mbanner-2-back.png
input swipe 900 1400 150 1400 150; sleep 3
input swipe 900 1400 150 1400 150; sleep 3; screencap -p $O/$X-mbanner-3-forward2.png
ls $O | grep mbanner
