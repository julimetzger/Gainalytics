# Gainalytics

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
![Platform: Android](https://img.shields.io/badge/platform-Android-3DDC84.svg)
![React Native 0.84](https://img.shields.io/badge/React_Native-0.84-61DAFB.svg)

**Log your gains with Gainalytics.** A privacy-first, offline-first training log and analytics app
for advanced lifters and powerlifters.

Your training data stays on your phone. There is no account, no cloud and no tracking. Backups are
plain files you own.

<!--
TODO(screenshots): add 3-5 screenshots made with synthetic demo data (no real training logs, no
status bar notifications), e.g. training plan, workout logging, analytics dashboard, video bar-path
analysis, AI chat. Suggested location: docs/images/readme/.
-->

> Screenshots will be added once synthetic demo data is available.

## Features

- **Training logging**: custom exercises, sets, reps, weight, RIR/RPE and a rest timer with
  notifications.
- **Planning**: mesocycles and microcycles, program templates, progression, and suggestions based on
  your previous blocks.
- **Analytics**: volume, sets and estimated 1RM per exercise, muscle group, week or micro; records,
  training length, history and comparisons over time ranges.
- **Video bar-path analysis**: an on-device object detector (TensorFlow Lite) tracks the barbell
  plate in a lifting video and shows the bar path, rep detection, velocity and velocity loss. No
  video leaves the device.
- **AI coach and chat (optional)**: ask questions about your training or get coach insights, with
  your own Anthropic API key or your ChatGPT account. Nothing is sent unless you configure it and
  ask.
- **Your data, your files**: export and import full backups (`.gains`), import from and export to
  the Strong app's CSV format.
- **Theming**: light and dark mode, with a full Material 3 color scheme generated from one color you pick.

## Quickstart

You need Node.js 22, JDK 17 and the Android SDK (with NDK and CMake). The full guide, including
versions and troubleshooting, is in [docs/building.md](docs/building.md).

```bash
npm ci                 # install dependencies (applies patches/)
npm test               # run the Jest test suite
npm start              # start Metro (keep it running)
npm run android        # build, install and launch on a device or emulator
```

To build only the debug APK: `cd android && ./gradlew assembleDebug`.

## Architecture

```
App.tsx / index.tsx        entry point: Redux store, navigation, theme
app/
  routing/                 React Navigation: bottom tabs (Training, Exercises, Analyse, Settings) and stacks
  tabs/                    screens per tab
  components/              reusable UI components (React Native Paper)
  redux/                   Redux slices with normalized state (byId/allIds), selectors, reduce-reducers
  models/                  domain types and entities (Training, TrainingsPlan, Exercise, Workout, WorkoutSet)
  utils/                   pure logic: analytics, date helpers, import/export, AI clients
  theme/                   Material 3 theme generation
android/app/src/main/
  java/.../                native modules: video analysis (TFLite, MediaCodec, Media3 player), ChatGPT sign-in, file sharing
  cpp/                     native YUV-to-RGB conversion for the video pipeline
  assets/models/           TFLite plate-detection model
__tests__/                 Jest tests and Maestro end-to-end flows
```

- **UI**: React Native 0.84 (new architecture, Hermes), React Navigation, React Native Paper,
  FlashList for long lists, MPAndroidChart via `react-native-charts-wrapper`.
- **State and storage**: Redux Toolkit with `redux-persist` on MMKV. All data is local.
  Credentials (API key, ChatGPT session) are kept in MMKV encrypted with a key held in the Android
  Keystore.
- **Video analysis**: a native Android module decodes the video with `MediaCodec`, runs a YOLO-based
  TensorFlow Lite model on each frame (GPU delegate when available) and reports bar-path points
  and reps back to JavaScript. It runs in a foreground service so long videos survive backgrounding.
- **AI**: direct HTTPS calls from the device to the provider the user configured. There is no
  Gainalytics server.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and follow the
[Code of Conduct](CODE_OF_CONDUCT.md). Security issues: see [SECURITY.md](SECURITY.md).

## License

Gainalytics is free software, licensed under the
[GNU Affero General Public License v3.0 or later](LICENSE), with an additional permission under
section 7 that allows linking the proprietary Google Play services libraries required on Android.

The bundled plate-detection model is an Ultralytics YOLO export and is itself licensed under
AGPL-3.0. Third-party components and their licenses are listed in
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
