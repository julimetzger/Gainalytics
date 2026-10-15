#!/bin/bash

# The keystore password is never taken as an argument (it would end up in the
# shell history and the process list). Either pre-set ANDROID_RELEASE_PASSWORD
# in the environment or enter it at the hidden prompt.
if [ $# -gt 0 ]; then
    echo "Usage: ./releaseNewAndroidVersion.sh  (the password is prompted for, not passed as an argument)"
    exit 1
fi

if [ -z "$ANDROID_RELEASE_PASSWORD" ]; then
    read -r -s -p "Android release keystore password: " ANDROID_RELEASE_PASSWORD
    echo
fi

if [ -z "$ANDROID_RELEASE_PASSWORD" ]; then
    echo "No password given, aborting."
    exit 1
fi

export ANDROID_RELEASE_PASSWORD
echo 'start release'
set -e
git pull --rebase
mkdir -p 'android/app/src/main/assets/'
npx react-native bundle --platform android --dev false --entry-file index.tsx --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res

previousVersion=$(grep -oE 'versionName "([0-9]+\.[0-9]+)"' android/app/build.gradle | sed -E 's/versionName "([0-9]+\.[0-9]+)"/\1/')
newVersion=$(echo $previousVersion | awk -F. '{$NF = $NF + 1;} 1' | sed 's/ /./g')
echo "update minor version from $previousVersion to $newVersion"
sed -i'' -e "s/versionName \"$previousVersion\"/versionName \"$newVersion\"/g" android/app/build.gradle

echo 'releasing'
mkdir -p android/app/build/outputs/apk/release/
mkdir -p app/build/outputs/bundle/release/

# RN 0.75 autolinking: pre-generate autolinking.source.json here using the
# current shell's own node/npx, so android/settings.gradle can read it via
# autolinkLibrariesFromConfigFile() and sidestep the Gradle ProcessBuilder
# that breaks on some Windows setups. See android/settings.gradle for why.
npx react-native config > android/autolinking.source.json

export ENTRY_FILE=index.tsx
cd android
rm -rf app/src/main/res/drawable*
./gradlew assembleRelease && ./gradlew bundleRelease
# The APK/AAB stay local (app/build/outputs/...) — they exceed GitHub's 100 MB limit.
git add app/build.gradle
git commit -m "release android version $newVersion"
git tag $newVersion
git push origin master
git push origin $newVersion
echo "apk: android/app/build/outputs/apk/release/app-release.apk"
echo "aab: android/app/build/outputs/bundle/release/app-release.aab"


cd ..


