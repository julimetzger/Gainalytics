#!/usr/bin/env pwsh
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$androidBundlePassword
)

$ErrorActionPreference = 'Stop'

$env:ANDROID_RELEASE_PASSWORD = $androidBundlePassword
Write-Host 'start release'

git pull --rebase
if ($LASTEXITCODE -ne 0) { throw "git pull --rebase failed" }

# JS bundle
New-Item -ItemType Directory -Force -Path 'android/app/src/main/assets' | Out-Null
npx react-native bundle `
    --platform android `
    --dev false `
    --entry-file index.tsx `
    --bundle-output android/app/src/main/assets/index.android.bundle `
    --assets-dest android/app/src/main/res
if ($LASTEXITCODE -ne 0) { throw "react-native bundle failed" }

# Bump versionName
$buildGradle = Get-Content android/app/build.gradle -Raw
if ($buildGradle -notmatch 'versionName "([0-9]+\.[0-9]+)"') {
    throw "Could not find versionName in android/app/build.gradle"
}
$previousVersion = $matches[1]
$parts = $previousVersion -split '\.'
$parts[-1] = [int]$parts[-1] + 1
$newVersion = $parts -join '.'
Write-Host "update minor version from $previousVersion to $newVersion"
$buildGradle = $buildGradle -replace "versionName `"$previousVersion`"", "versionName `"$newVersion`""
Set-Content -Path android/app/build.gradle -Value $buildGradle -NoNewline

# RN 0.75 autolinking: pre-generate autolinking.source.json here using the
# current shell's own node/npx, so android/settings.gradle can read it via
# autolinkLibrariesFromConfigFile() and sidestep the Gradle ProcessBuilder
# that breaks on Windows. See android/settings.gradle for why.
$configJson = & npx react-native config
if ($LASTEXITCODE -ne 0) { throw "react-native config failed" }
[System.IO.File]::WriteAllText("$PWD\android\autolinking.source.json", ($configJson -join "`n"), [System.Text.UTF8Encoding]::new($false))

Write-Host 'releasing'
New-Item -ItemType Directory -Force -Path android/app/build/outputs/apk/release | Out-Null
New-Item -ItemType Directory -Force -Path app/build/outputs/bundle/release | Out-Null
$env:ENTRY_FILE = 'index.tsx'

Push-Location android
try {
    Remove-Item -Recurse -Force app/src/main/res/drawable* -ErrorAction SilentlyContinue

    .\gradlew.bat assembleRelease
    if ($LASTEXITCODE -ne 0) { throw "assembleRelease failed" }

    .\gradlew.bat bundleRelease
    if ($LASTEXITCODE -ne 0) { throw "bundleRelease failed" }

    # The APK/AAB stay local (app/build/outputs/...) — they exceed GitHub's 100 MB limit.
    git add app/build.gradle
    git commit -m "release android version $newVersion"
    if ($LASTEXITCODE -ne 0) { throw "git commit failed" }
    git tag $newVersion
    git push origin master
    if ($LASTEXITCODE -ne 0) { throw "git push master failed" }
    git push origin $newVersion
    if ($LASTEXITCODE -ne 0) { throw "git push tag failed" }
    Write-Host "apk: android/app/build/outputs/apk/release/app-release.apk"
    Write-Host "aab: android/app/build/outputs/bundle/release/app-release.aab"
}
finally {
    Pop-Location
}
