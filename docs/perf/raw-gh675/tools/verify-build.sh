#!/system/bin/sh
# GH-675: prove which build is installed, run ON the device: adb shell sh /data/local/tmp/verify-build.sh
# Release flags (no DEBUGGABLE) + whether the installed Hermes bundle contains a property name that only the
# GH-675 change has (knownVideoDurationMs) and none of the temporary probe strings (GH675PROBE).
P=com.powerliftingworkoutplanner
apk=$(pm path $P | sed 's/^package://')
dumpsys package $P | grep -E 'pkgFlags|versionName' | head -2
echo "bundle magic: $(unzip -p $apk assets/index.android.bundle | head -c 8 | od -An -tx1 | tr -d ' ')"
echo "knownVideoDurationMs: $(unzip -p $apk assets/index.android.bundle | grep -c knownVideoDurationMs)"
echo "GH675PROBE: $(unzip -p $apk assets/index.android.bundle | grep -c GH675PROBE)"
