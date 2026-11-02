#!/system/bin/sh
# GH-671: which JS does the installed release APK carry? (run ON the device)
#   adb push verify-release.sh /data/local/tmp/ ; adb shell sh /data/local/tmp/verify-release.sh
P=com.powerliftingworkoutplanner
APK=$(pm path $P | head -1 | cut -d: -f2)
echo "apk: $APK"
dumpsys package $P | grep -E 'versionName|pkgFlags|lastUpdateTime'
echo "bundle magic (Hermes c61fbc03c103191f): $(unzip -p $APK assets/index.android.bundle | head -c 8 | od -An -tx1 | tr -d ' ')"
echo "GH-671 incremental storage strings: $(unzip -p $APK assets/index.android.bundle | grep -c 'incremental-storage: part')"
echo "profiling probe strings (must be 0): $(unzip -p $APK assets/index.android.bundle | grep -c GH671P)"
