#!/bin/bash
# Cuts a new Android release: bumps versionName, commits, tags and pushes.
#
# The pushed tag triggers .github/workflows/release.yml, which builds the signed
# app-release.apk + .aab with the release key from the GitHub secrets and publishes them as a
# GitHub Release. See docs/release.md.
#
#   ./releaseNewAndroidVersion.sh                bump + tag + push (CI builds and publishes)
#   ./releaseNewAndroidVersion.sh --local-build  additionally build and sign locally first
#                                                (old flow; needs the local release keystore)
#
# The keystore password is never taken as an argument (it would end up in the shell history
# and the process list). Either pre-set ANDROID_RELEASE_PASSWORD or enter it at the prompt.

localBuild=false
case "$1" in
    "") ;;
    --local-build) localBuild=true ;;
    *)
        echo "Usage: ./releaseNewAndroidVersion.sh [--local-build]  (the password is prompted for, not passed as an argument)"
        exit 1
        ;;
esac

if [ "$localBuild" = true ]; then
    if [ -z "$ANDROID_RELEASE_PASSWORD" ]; then
        read -r -s -p "Android release keystore password: " ANDROID_RELEASE_PASSWORD
        echo
    fi
    if [ -z "$ANDROID_RELEASE_PASSWORD" ]; then
        echo "No password given, aborting."
        exit 1
    fi
    export ANDROID_RELEASE_PASSWORD
fi

echo 'start release'
set -e
git pull --rebase

git fetch --tags --quiet

# Releases can also be cut by tag alone (Actions -> Release -> Run workflow), which leaves
# versionName in build.gradle behind. Continue from whichever is higher: build.gradle or the latest x.y tag.
gradleVersion=$(sed -nE 's/^\s*versionName "([0-9]+\.[0-9]+)".*/\1/p' android/app/build.gradle)
if [ -z "$gradleVersion" ]; then
    echo "Could not find versionName in android/app/build.gradle"
    exit 1
fi
latestTag=$(git tag -l | grep -E '^[0-9]+\.[0-9]+$' | sort -V | tail -n1)
previousVersion=$(printf '%s\n' "$gradleVersion" "$latestTag" | grep . | sort -V | tail -n1)
newVersion=$(echo "$previousVersion" | awk -F. '{$NF = $NF + 1;} 1' | sed 's/ /./g')
if git rev-parse -q --verify "refs/tags/$newVersion" > /dev/null; then
    echo "Tag $newVersion already exists, aborting."
    exit 1
fi
echo "update minor version from $previousVersion to $newVersion"
sed -i'' -e "s/versionName \"$gradleVersion\"/versionName \"$newVersion\"/" android/app/build.gradle

if [ "$localBuild" = true ]; then
    echo 'building locally'
    mkdir -p 'android/app/src/main/assets/'
    npx react-native bundle --platform android --dev false --entry-file index.tsx --bundle-output android/app/src/main/assets/index.android.bundle --assets-dest android/app/src/main/res

    # RN 0.75 autolinking: pre-generate autolinking.source.json here using the
    # current shell's own node/npx, so android/settings.gradle can read it via
    # autolinkLibrariesFromConfigFile() and sidestep the Gradle ProcessBuilder
    # that breaks on some Windows setups. See android/settings.gradle for why.
    npx react-native config > android/autolinking.source.json

    export ENTRY_FILE=index.tsx
    (
        cd android
        rm -rf app/src/main/res/drawable*
        ./gradlew assembleRelease && ./gradlew bundleRelease
    )
    echo "apk: android/app/build/outputs/apk/release/app-release.apk"
    echo "aab: android/app/build/outputs/bundle/release/app-release.aab"
fi

git add android/app/build.gradle
git commit -m "release android version $newVersion"
git tag $newVersion
git push origin master
git push origin $newVersion
echo "Tag $newVersion pushed. GitHub Actions (release.yml) builds, signs and publishes the release."
