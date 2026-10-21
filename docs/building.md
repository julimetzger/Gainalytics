# Building Gainalytics

This guide builds the Android app from a fresh clone on Linux, macOS or Windows. It needs no
project-specific infrastructure: a standard React Native Android setup is enough.

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22 LTS (at least 20.19.4) | React Native 0.84 requires `>= 20.19.4`. npm ships with Node. |
| JDK | 17 | The Android Gradle Plugin 8.12 needs JDK 17 or newer; 17 is the version React Native tests against. Set `JAVA_HOME`. |
| Android SDK | Platform 36, Build-Tools 35.0.0 | Install via Android Studio (SDK Manager) or `sdkmanager`. |
| Android NDK | 27.1.12297006 | The app has native C++ code (`android/app/src/main/cpp`). |
| CMake | 3.22.1 | From the SDK Manager ("SDK Tools" tab). |
| Gradle | 8.14.1 | Downloaded automatically by `./gradlew`. Do not install it yourself. |
| Device | Android 7.0+ (API 24) | Emulator or USB device with USB debugging. |

Set the SDK location, for example in your shell profile:

```bash
export ANDROID_HOME="$HOME/Android/Sdk"          # macOS: $HOME/Library/Android/sdk
export PATH="$ANDROID_HOME/platform-tools:$PATH" # for adb
```

Alternatively, create `android/local.properties` with `sdk.dir=/path/to/Android/Sdk` (the file is
ignored by Git).

With `sdkmanager` the native toolchain can be installed in one go:

```bash
sdkmanager "platforms;android-36" "build-tools;35.0.0" "ndk;27.1.12297006" "cmake;3.22.1" "platform-tools"
```

The official [React Native environment setup](https://reactnative.dev/docs/set-up-your-environment)
describes the same steps with screenshots.

## 1. Install dependencies

```bash
git clone <repository-url> gainalytics
cd gainalytics
npm ci
```

`npm ci` installs exactly what `package-lock.json` pins and then runs `patch-package`, which applies
the patches in `patches/` to a few dependencies. Do not use `npm install` for a normal build; it may
update the lock file.

## 2. Run the tests

```bash
npm test          # Jest unit and component tests
```

No device is needed. `npm run typecheck` (TypeScript) and `npm run lint` (ESLint) are available as
well; the code base still has known pre-existing findings there, so judge a change by not adding new
ones rather than by a clean run.

## 3. Start Metro

Debug builds load JavaScript from the Metro bundler:

```bash
npm start
```

Keep it running in its own terminal.

## 4. Build and install a debug APK

With a device or emulator connected (`adb devices` lists it):

```bash
npm run android
```

This builds, installs and launches the app. To only build the APK:

```bash
cd android
./gradlew assembleDebug        # Windows: gradlew.bat assembleDebug
```

The APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. Install it with
`adb install -r android/app/build/outputs/apk/debug/app-debug.apk`. If the app shows a red
"Unable to load script" screen on a USB device, forward the Metro port with
`adb reverse tcp:8081 tcp:8081`.

The debug build is limited to the `x86_64` and `arm64-v8a` ABIs to keep build times down, which
covers current emulators and phones.

## 5. Release builds (optional)

Release builds are signed with your own keystore. See
[`docs/release-signing.example.env`](release-signing.example.env) for the variables and
[the React Native guide](https://reactnative.dev/docs/signed-apk-android) for creating a keystore.
In short:

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore android/app/your_key_name.keystore \
  -alias your_key_alias -keyalg RSA -keysize 2048 -validity 10000
export ANDROID_RELEASE_PASSWORD='...'   # store and key password
cd android && ./gradlew assembleRelease
```

Keystores (`*.keystore`) are ignored by Git. Never commit one.

### AI features need no build configuration

The AI coach and chat do not use any key at build time. Users enter their own Anthropic API key in
the app (**Settings**), or sign in with their ChatGPT account. Keys are stored on the device in
encrypted storage backed by the Android Keystore. There is no `.env` file to fill in for the app.

## 6. End-to-end tests with Maestro (optional)

UI flows live in `__tests__/e2e/maestro/flows/` and run with [Maestro](https://maestro.mobile.dev/)
against an installed debug build:

```bash
# install Maestro: https://docs.maestro.dev/getting-started/installing-maestro
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
adb reverse tcp:8081 tcp:8081
maestro test __tests__/e2e/maestro/flows/smoke.yaml
```

Many flows import a backup fixture first. Push it to the device before running them:

```bash
adb push __tests__/e2e/maestro/fixtures/baseline.gains /sdcard/Download/baseline.gains
maestro test __tests__/e2e/maestro/flows/suite.yaml
```

The `npm run e2e:*` scripts wrap these steps for the maintainers' own device setup; you do not
need them.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `SDK location not found` | Set `ANDROID_HOME` or create `android/local.properties`. |
| `NDK not configured` / CMake errors | Install NDK 27.1.12297006 and CMake 3.22.1 with the SDK Manager. |
| `Unsupported class file major version` | Gradle runs on the wrong JDK. Point `JAVA_HOME` to JDK 17. |
| Native module missing at runtime | Delete `android/build` and `android/app/build`, then rebuild. If `android/autolinking.source.json` exists and is stale, delete it too. |
| Patches fail during `npm ci` | A dependency version changed without updating `patches/`. Revert the version or regenerate the patch with `npx patch-package <name>`. |
