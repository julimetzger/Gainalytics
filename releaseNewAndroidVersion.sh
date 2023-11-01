#!/bin/bash

echo 'start release'

react-native bundle --platform android --dev false --entry-file index.tsx --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res

previousVersion=$(grep -oE 'versionName "([0-9]+\.[0-9]+)"' android/app/build.gradle | sed -E 's/versionName "([0-9]+\.[0-9]+)"/\1/')
newVersion=$(echo $previousVersion | awk -F. '{$NF = $NF + 1;} 1' | sed 's/ /./g')
echo "update minor version from $previousVersion to $newVersion"
sed -i "s/versionName \"$previousVersion\"/versionName \"$newVersion\"/g" android/app/build.gradle

echo 'releasing'
export ENTRY_FILE=index.tsx
cd android
rm -rf app/src/main/res/drawable*
./gradlew assembleRelease && ./gradlew bundleRelease

cd ..


