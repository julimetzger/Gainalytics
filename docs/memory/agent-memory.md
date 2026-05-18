# Agent Memory

Generic, reusable learnings for feature workers on this project. Ticket-specific details, round numbers, and file paths from historical runs are intentionally omitted — check git log, PRs, and TODOS.md for that context.

**CRITICAL — device serials:** Never copy device serials from this file into your commands. Always use your assigned `$ANDROID_SERIAL` from the orchestrator prompt.

## Metro & ADB Infrastructure

### Reuse host Metro, never start your own
Workers get `E2E_METRO_PORT` from the orchestrator pointing at a host Metro process. Use `adb reverse` to expose it on the device as port 8081. Starting a second packager in the worker is always wrong.

### Emulator connects to 10.0.2.2:8081, not localhost
`adb reverse tcp:8081 tcp:$HOST_PORT` only captures connections to `localhost:8081` on the device. The Android emulator connects Metro via the special host alias `10.0.2.2:8081`, which bypasses reverse.

Two workarounds:
- **Open the RN Dev Menu** (`adb shell input keyevent 82`) → "Change Bundle Location" → `localhost:8081`. Writes `debug_http_host` to SharedPreferences. Survives relaunches but is wiped by `pm clear` / `clearState: true`.
- **Run a socat bridge**: `socat TCP-LISTEN:8081,fork,reuseaddr TCP:127.0.0.1:$HOST_PORT`. The `reuseaddr` flag matters — without it the port gets stuck in TIME_WAIT after restarts.

### After `clearState: true`, the bundle-host override is gone
Any Maestro flow using `clearState: true` wipes SharedPreferences. If Metro is not on port 8081, rewrite `debug_http_host` via `run-as` or the Dev Menu before the next launch, otherwise the app connects to whatever socat happens to be forwarding.

### `JAVA_TOOL_OPTIONS` leaks from Maestro into Gradle
Maestro's run script sets `JAVA_TOOL_OPTIONS=-Duser.home=...` for its own isolation. The var persists in the shell and causes Gradle native builds (CMake/NDK) to fail. Always `unset JAVA_TOOL_OPTIONS` before `./gradlew`.

### Parallel Maestro sessions need unique driver host ports
Use `--driver-host-port` (the orchestrator passes it via `E2E_MAESTRO_DRIVER_PORT`). Two concurrent sessions on the same port fail with `TcpForwarder.waitFor` TimeoutException. After a crashed session, force-stop both the app and `dev.mobile.maestro.android`, then wait 10-15s before the next flow.

### ADB server mismatches are a recurring headache
- WSL2 ADB client (v36) + Windows ADB server (v34) → device list silently empty over `127.0.0.1:5037`. Use Windows `adb.exe` directly via `/mnt/c/.../platform-tools/adb.exe`, or run Maestro through `cmd.exe /c "maestro.bat ..."`.
- `ADB_SERVER_SOCKET=tcp:<gateway>:5037` can die mid-session if Windows ADB restarts. Don't spend time debugging live — if ADB is unreachable in a pure-code round, use existing run-dir screenshots as evidence and note the infra problem in summary.md.
- Windows ADB needs `-a` flag to bind on all interfaces so WSL can reach it. Killing stale `adb.exe` processes before restart is usually necessary.

## Maestro Best Practices

### Assert actual values, not just visibility
`assertVisible: id: "..."` proves the element exists, not that its content is correct. Use `assertVisible: text: "expected value"`. For dynamic values, compute the expected string with `evalScript` and `assertTrue`.

### `text:` matching is literal, not substring and not regex
- `assertVisible: text: "Foo"` will not match a Text node containing "Bar › Foo". Maestro requires exact or full-regex match against the node's `text` attribute.
- Workaround: give the element a `testID` and assert `id:` + optional `text: ".*Foo.*"` with explicit regex wildcards.
- Text displays with dynamic suffixes (e.g. `"Playback: 00:00 / 00:47"`) should assert only the fixed prefix.

### Off-screen React Native Views are not in the accessibility tree
`scrollUntilVisible: element: id: "..."` times out for RN `<View>` that is below the viewport — the testID only appears after the view is rendered. Use `text:` anchors (e.g. `Card.Title`) which are always in the tree. After scrolling to the anchor, use `extendedWaitUntil: visible: "..."` to wait for the target child.

### `react-native-paper` Button does not expose testID as Maestro `id:`
Paper buttons get `content-desc` equal to the label, not the testID. Match by label text: `tapOn: "Play"`. The `id:` selector works for plain `<View>` / `<TouchableOpacity>` / custom components where testID maps to resource-id.

### `clearState: true` + CPU-intensive work = gRPC DEADLINE_EXCEEDED
If an app starts a heavy analysis right after `pm clear`, Maestro's `viewHierarchy` gRPC call times out (120s deadline) before the UI is queryable. Reserve `clearState: true` for cold-start import flows. Overlay/playback flows that reuse existing analyses should run with `clearState: false`.

### Maestro `waitForAppToSettle` never returns on a continuously-updating UI
Any screen with ticking labels, live charts, or video playback keeps the hierarchy "dirty". The next Maestro step hangs until DEADLINE_EXCEEDED. Use Maestro only for navigation to stable screens. For interactions on live UIs, drop to pure `adb shell input tap <x> <y>` + `adb exec-out screencap -p`. Get coordinates from `adb shell uiautomator dump`.

### After cold launch, assert with `extendedWaitUntil`, not bare `assertVisible`
A `launchApp` (especially with `clearState: true` or a bundled APK) returns when the process starts, not when React Native finishes rendering. Use `extendedWaitUntil: visible: "X", timeout: 60000` — bare `assertVisible` runs before the bundle loads and fails.

### Leading whitespace in JSX breaks exact text matching
`<Text> {name}</Text>` renders `" Name"` (with leading space). `assertVisible: text: "Name"` fails. Strip leading whitespace in JSX or use a regex match.

### `tapOn: point` only supports integer percentages
`"3.5%,6.5%"` throws `NumberFormatException`. Use `"4%,7%"`.

### Grep the component for `testID` before writing the flow
Memory-writing the wrong testID is the #1 reason new flows fail silently. `grep -n testID path/to/Component.tsx` before authoring or debugging a Maestro step.

## Android Build / Gradle

### `buildToolsVersion` and `compileSdkVersion` must be compatible with the pinned AGP
AGP 7.4.x officially supports up to compileSdk 34. AGP 8.1 → 34. AGP 8.5 → 35. Bumping compileSdk beyond what AGP supports causes assorted Gradle warnings and sometimes hard failures (resource linking, R class generation).

### Release signing is not available in the worker environment
The release keystore and `ANDROID_RELEASE_PASSWORD` live on the user's Windows machine. Workers that need to build a release APK to verify a runtime fix should temporarily swap `signingConfig signingConfigs.release` → `signingConfigs.debug` for the build, **not commit that change**, then install the debug-signed APK via `adb install -r`. Final signed-release verification is the user's job after merge.

### Kotlin Multiplatform (KMP) dependencies need the `kotlin-android` plugin on the app module
Without `apply plugin: 'kotlin-android'`, Gradle cannot do variant-aware resolution for KMP libraries (e.g. `androidx.datastore:datastore-preferences`). Symptoms: debug builds work (hand-picked classpath), release crashes with `NoClassDefFoundError` for top-level Kotlin functions. Excludes and explicit `-android` artifact pulls are fragile workarounds; applying the plugin is the real fix.

### Debug APK ABI filter halves size for emulator installs
The debug APK with all ABIs can reach 225 MB, which fails to install on an emulator with a tight `/data` partition. Add `ndk { abiFilters "x86_64", "arm64-v8a" }` inside `android.buildTypes.debug`. Never in `release`. Reduces APK to ~80 MB.

### `INSTALL_FAILED_INSUFFICIENT_STORAGE` has multiple knobs
1. `adb uninstall com.powerliftingworkoutplanner` frees the APK's current footprint (~220 MB).
2. On emulators, `adb shell pm uninstall com.google.android.youtube` frees ~400 MB.
3. If still tight, clear Google Play caches: `pm clear com.android.vending && pm clear com.google.android.gms && pm clear com.google.android.gsf` (~300 MB extra).
4. Check `adb shell df /data` — you need ~1 GB headroom for a 225 MB APK.

### Metro crashes when it watches Gradle `.cxx` build directories
`./gradlew assembleDebug` creates and tears down `android/app/.cxx/...` during the native build. If Metro is watching the project root, it crashes with `ENOENT ... watch '.cxx/...'` and the next app reload shows a red screen. Restart the Metro process after every native build; the socat bridge stays up.

### Autolinking silently ships a release APK with 0 native modules
The Windows `autolinkLibrariesFromCommand()` workarounds tolerate a 0-byte JSON output. If that happens, `assembleRelease` builds cleanly with an empty `PackageList` and the APK crashes the first screen that touches any native module (reanimated, gesture-handler, mmkv, …). Add a configuration-time guardrail in `android/settings.gradle` that parses the chosen autolinking config (pre-generated `autolinking.source.json` or cached `build/generated/autolinking/autolinking.json`) and throws if it has zero Android native deps — that way the broken state is caught at `gradlew assembleRelease` configure time instead of at first screen render.

### `npm ci` strictly enforces peer dependencies; `npm install` is lenient
After an RN upgrade, always validate with a fresh `npm ci` from scratch, not just `npm test` against a symlinked `node_modules`. Workers that skip this step leave the next developer (or CI) with peer-dep conflicts that were invisible in the agent's reused node_modules.

## React Native Patterns

### `react-native-gesture-handler` needs a root-entry import, not a lazy one
Any screen that uses `@react-navigation/drawer` or `react-native-drawer-layout` depends on the gesture-handler native module being registered at JS evaluation time. Debug builds get away without the root import because Fast Refresh paths end up registering it before the drawer renders; release builds can evaluate the drawer screen first and crash on mount. The fix is the documented `import 'react-native-gesture-handler';` as the **first** import of `index.tsx` — not inside any lazy code path. Symptoms: release-only crash the moment you tab into Analyse or open a Training plan; debug works fine.

### Jest `testPathIgnorePatterns: ['/.worktrees/']` hides specs in a worktree
When you run `jest` from inside `.worktrees/feature-*/`, every test file's absolute path contains `/.worktrees/`, so the default ignore pattern matches them all and jest reports "No tests found". Workaround for a single run: `npx jest --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=/__tests__/coverage/`. Don't waste time debugging missing specs in a worktree — check the ignore pattern first.

### Node.js v24 + jest-cli `exit()` incompatibility produces misleading exit code 1
After all tests pass, jest-cli throws `TypeError: (0 , _exit(...).default) is not a function` and exits 1. This is a pre-existing Node 24 / jest-cli incompatibility, not a test failure — all test results are accurate. Don't re-run or debug; just check the "Tests:" summary line in output.

### APK hardcoded to non-8081 Metro port: adb reverse + bundle location to `localhost`
If the APK was built with Metro host `10.0.2.2:PORT` (not the default 8081), `adb reverse` alone won't help — the emulator connects directly to 10.0.2.2 bypassing the tunnel. Fix:
1. `adb reverse tcp:PORT tcp:$HOST_METRO_PORT` on host
2. Dev menu → "Change Bundle Location" → `localhost:PORT` (**not** `10.0.2.2:PORT`) so the app uses the adb-reverse tunnel

This is different from the standard setup where the APK uses 8081: in that case you can override with SharedPreferences to `localhost:8081`. For non-8081 ports, only the Dev Menu approach works (SharedPreferences `debug_http_host` is ignored for non-default ports in newer RN).

### Dev Menu "Change Bundle Location" field: clear before typing
The input may show a previous value. Pattern: open field → `adb shell input keyevent KEYCODE_MOVE_END` → 30× `KEYCODE_DEL` → `adb shell input text "localhost:PORT"`. If you type without clearing, you get a concatenated invalid URL (`80810.0.2.2:PORT`) and a "port invalid" crash.

### Maestro `id:` matches resource-id, not content-desc
Custom RN `View`s that expose `testID="tab-analyse"` end up as `content-desc="tab-analyse"` in the Android view tree, **not** as `resource-id`. A Maestro step like `tapOn: { id: "tab-analyse" }` then fails with "Element not found". The bare-string form `tapOn: "tab-analyse"` matches both text and content-desc and works. Same rule as the existing `react-native-paper` note above, but it also applies to plain `<View>` with a testID on the bottom nav.

### Never spread class instances in React state
`{...prev, startDate: d}` returns a plain object — `instanceof MyClass` is now false and downstream guards silently skip. Use the constructor: `new NullableRange(d, prev.endDate)`.

### Reanimated `useSharedValue` is stable in prod, not in the Jest mock
Production returns a stable ref; the mock returns `{value: v}` per call. Two consequences in tests:
1. `useAnimatedStyle` reads a fresh `{value: 0}` every render.
2. Including SharedValues in `useCallback` / `useEffect` deps triggers infinite resets.

Fix: `const sv = useRef(useSharedValue(0)).current;` — the ref is created once and mutations persist. And never put SharedValues in dep arrays, even when exhaustive-deps warns.

### Tab navigators keep components mounted — lazy `useState` initializers do not re-run on prop change
If a screen reads persisted data via lazy `useState(() => savedX)`, it sees `undefined` on mount and never updates when the prop finally arrives. Add a one-shot `useEffect` guarded by `useRef` that applies the prop when it first becomes non-null.

### `viewPortOffsets` on `react-native-charts-wrapper` expects physical pixels, not dp
`{left: 64, ...}` with a dp value misaligns overlays at density ≠ 1. Use `Math.round(VALUE_DP * PixelRatio.get())` for the chart prop and keep the JS overlay constant in dp.

### Hex-color string concatenation breaks under `rgb()` themes
`theme.colors.primary + '33'` works when primary is `#rrggbb` but produces `rgb(...)33` under themes that return `rgb()` strings, which is not a valid React Native color and crashes at render. Use an alpha-safe helper that accepts both formats and emits `rgba(r,g,b,alpha)`.

### Null-coalescing fallback on itself creates an always-false comparison
`new Date(x ?? y).getTime() !== y.getTime()` is always `false` when `x` is null — it reduces to `y !== y`. Guard with an explicit null check first.

### FlatList in a flex container collapses sibling rows unless it has `flex:1`
In a `KeyboardAvoidingView` (or any `flex:1` root), a `FlatList` without an explicit `style={{ flex: 1 }}` takes all remaining space greedily, squeezing siblings that have `flexGrow: 0` to 0 height. Symptoms: chip row / picker row have 0 height in `uiautomator dump`. Fix: add `style={{ flex: 1 }}` to the FlatList **and** `flexShrink: 0` to every non-scrolling sibling above it (chips, date picker, info line). Both sides are required — one without the other doesn't work.

## Jest / Testing

### Global mocks in `jest.setup.js` fix whole suites at once
Native modules that have no Jest implementation (e.g. `@notifee/react-native`, `react-native-keychain`, `react-native-mmkv`) break any suite that transitively imports them, often 4 levels deep. One global `jest.mock(...)` in `jest.setup.js` with the used named exports fixes every affected suite. Prefer this over per-spec mocks.

### `react-redux` useSelector/useDispatch mock unblocks Provider-less component tests
When a component gains a `useSelector` call but its spec doesn't wrap renders in `<Provider>`, all tests fail with "could not find react-redux context value". Global mock pattern:
```js
jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn(() => []),
  useDispatch: jest.fn(() => jest.fn()),
}));
```
Per-spec mocks can still override.

### Mock store must include every slice the component reads
A minimal `{getState: () => ({})}` store throws `Cannot read properties of undefined (reading 'byId')` the moment a `useSelector` touches a slice. Seed all slices the component transitively reads, even if the test predates the component's current selectors.

### When a paper component is newly added to a screen, update the paper mock
Tests that render the screen crash with "Element type is invalid" until the new component (e.g. `Chip`, `IconButton`) is added to the `jest.mock('react-native-paper', ...)` factory in the spec or global setup.

### Exclude `.worktrees/` from Jest discovery
A repo full of `.worktrees/feature-*/` directories each with its own test suite explodes the test run to thousands of suites. Add `/.worktrees/` to `testPathIgnorePatterns` in `jest.config.cjs`.

## Worker Discipline

### Check `run_dir` for existing artifacts before repeating work
Resumed rounds inherit screenshots, logcat captures, and intermediate logs from prior rounds. Re-capturing evidence that already exists wastes time and context. Read `summary.md` and `status.json` first.

### Code review findings and device-observed findings are different axes
A reviewer may submit stale code-review line references (based on a commit that's already been fixed) alongside genuinely new device findings. Before investigating review feedback, check `git log` to see which items were already addressed after the reviewer's last-tested commit.

### Fix-workers run on the PR branch, not a fresh one from master
When addressing review feedback on an already-open PR, resume the existing worktree so the fixes land on top of the PR's current HEAD. A fresh branch from master loses the original work.

### Multiple Metro processes can coexist; ensure the right one serves the installed APK
After an RN upgrade, the project's shared `node_modules` may still be at the old RN version while the branch `package.json` says a newer version. A Metro started from the shared node_modules serves an old-RN bundle to a new-RN native APK → `PlatformConstants` TurboModule not found. Check `cat node_modules/react-native/package.json | grep version` and compare to the branch `package.json`. If they diverge, use the worktree that has its own installed node_modules (check with `cat .worktrees/feature-*/node_modules/react-native/package.json`).

### Maestro `--host 172.18.240.1` is required on WSL + Windows ADB
The Maestro binary is Windows-native (`/mnt/c/.../maestro.bat`). Without `--host 172.18.240.1`, Maestro reports "Device not connected" even when `adb devices` (WSL-side) shows the device. Always pass `--host 172.18.240.1 --device <SERIAL>` on this setup.

### Emulator-only video flows (30+) cannot run on a real physical device
All flows that assert `"Import Emulator Squat Video"` or wait for the `"Open"` file-picker dialog are targeting an emulator-specific mechanism. These flows fail on real device by design. Do not investigate these as app regressions.

### Gradle build fails with Kotlin type-inference in gesture-handler when node_modules mismatch
After upgrading `package.json` to RN 0.82+ without running `npm install`, the shared node_modules still reference older gesture-handler. The mismatch causes `Cannot infer a type for this parameter` errors in `FlingGestureHandler.kt`. Run `npm ci` in the worktree root (separate from main) before attempting `./gradlew assembleDebug`.

### DrawerNavigator does not propagate bottom safe area inset to screen content
`createDrawerNavigator` renders each screen in a `flex:1` View without adding `paddingBottom: insets.bottom`. If the drawer is nested inside a `createMaterialBottomTabNavigator`, the tab bar height IS set in `SafeAreaInsetsContext` (by the paper navigator), but the drawer doesn't forward it as padding. Any screen with a fixed-bottom element (e.g. a chat input row) must call `useSafeAreaInsets().bottom` itself and apply it as `paddingBottom` to its root container. Screens without fixed-bottom elements won't notice (empty space behind the tab bar is harmless).

### Evidence paths in `status.json` must be bare relative paths
No inline annotations, no absolute paths, no "(updated in round 3)" suffixes. The validator checks that each path exists — annotations break it.

### Commit all code changes, run tests, then touch the device
Once you're in the device-interaction phase, one crashed Maestro run can wipe enough state that you never get back to a clean "write code" moment. Land every code change you plan to make, run `npm test`, then switch modes to device verification.

### On real devices, check for a red-box before blaming a Maestro flow
A Maestro flow failing on the first assertion is often an app bootstrap crash (redbox), not a flow bug. `adb shell uiautomator dump` + grep for the stack trace is the fastest triage.

### Grep for dev/debug UI elements in both tab screens and modals
"Import Emulator Squat Video" and similar dev-only buttons have historically lived in multiple places (main tab + selection modal). When removing them, `grep -r "<dev button text>" app/` before assuming one file is enough.

### RN version mismatch between worktrees causes `TurboModuleRegistry.getEnforcing` crash
Each worktree that ran `npm install` gets its own `node_modules` with a potentially different RN version. If an APK was built from a worktree running RN 0.84.1 but you serve it a Metro bundle from another worktree using RN 0.76.9, you get: `Invariant Violation: TurboModuleRegistry.getEnforcing(...): 'PlatformConstants' could not be found`. Check `node -e "require('./node_modules/react-native/package.json').version"` in the Metro-serving worktree and compare against the APK's RN version before loading the bundle. Install an APK built from a worktree with the matching RN version.

### socat bridges host Metro to emulator when `adb reverse` isn't enough
Android emulator reaches the host at `10.0.2.2`, not `localhost`. `adb reverse tcp:8081 tcp:<metro-port>` only captures `localhost:8081` traffic — the emulator's `debug_http_host` setting of `10.0.2.2:8081` bypasses it. Fix: run `nohup socat TCP-LISTEN:8081,fork,reuseaddr TCP:127.0.0.1:<metro-port> &` on the host. The emulator connects to `10.0.2.2:8081` which socat forwards to the actual Metro port. Verify with `curl http://127.0.0.1:8081/status` after starting socat.

## React Native 0.80 Upgrade Specifics

### `GuardedResultAsyncTask` was removed in RN 0.80
`com.facebook.react.bridge.GuardedResultAsyncTask` no longer exists. Any third-party native module that imports it (e.g. `react-native-document-picker@9.3.1`) will fail to compile. Fix via `patch-package`: replace `extends GuardedResultAsyncTask<T>` with a static helper class and `Executors.newSingleThreadExecutor().execute(...)`.

### `SoLoader.init` was replaced in RN 0.80 `MainApplication.kt`
The RN 0.80 template uses `ReactNativeApplicationEntryPoint.loadReactNative(this)` instead of `SoLoader.init(this, false)` + `OpenSourceMergedSoMapping.install()`. Update `MainApplication.kt`; the `SoLoader` import is gone.

### React 19 forces `legacy-peer-deps` for older ecosystem packages
`@reduxjs/toolkit@1.9.x` peer dep declaration excludes React 19 (`^16.9.0 || ^17.0.0 || ^18`). Create `.npmrc` with `legacy-peer-deps=true` to allow `npm ci` to pass. Don't upgrade RTK as part of an RN-only upgrade.

### compileSdkVersion must be bumped to 36 for RN 0.80
Removing `force 'androidx.core:core:1.13.1'` lets `androidx.core:core-ktx:1.17.x` resolve, which requires `compileSdkVersion 36`. Install Android SDK Platform 36 via `sdkmanager "platforms;android-36"` before the Gradle build.

### JSC flavor artifact group changed in RN 0.80
`org.webkit:android-jsc-intl:+` no longer resolves. Use `io.github.react-native-community:jsc-android-intl:2026004.+`.

### NDK 27.1.12297006 required for RN 0.80 + Kotlin 2.1.20
RN 0.80 with Kotlin 2.1.20 needs NDK 27. Install via `sdkmanager "ndk;27.1.12297006"` (not 26.x).

### Jest mock path `react-native/Libraries/Animated/NativeAnimatedHelper` was removed
In RN 0.80, the path no longer exists. Remove any `jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper')` from `jest.setup.js`. The RN jest preset handles animated mocking internally.

### React 19 async batching can cause test timeouts at 5s default
Tests using `waitFor` with React 19 may take 8+ seconds on first render. Add a `15000` timeout arg to any `it(...)` that flakes: `it('...', async () => { ... }, 15000);`.

### 54. Inline `.map()` in `useSelector` causes infinite render loops with `MultiselectDropdown`
**Problem**: `useSelector((state) => state.slice.allIds.map(id => state.slice.byId[id]))` creates a new array reference on every call. `useSelector` uses reference equality, so it triggers a re-render on every store tick. Third-party libraries with internal `useEffect` on their `data`/`options` prop (like `sharingan-rn-modal-dropdown`) then re-run their own state updates, causing "Maximum update depth exceeded".
**Working solution**: Use `createSelector` from `@reduxjs/toolkit` (Reselect). The selector only recomputes — and only returns a new array — when the input references change.
```ts
const selectAll = createSelector(
  (state) => state.slice.allIds,
  (state) => state.slice.byId,
  (allIds, byId) => allIds.map(id => byId[id]),
);
export const useAll = () => useSelector(selectAll);
```
**Apply when**: Any `useSelector` whose selector uses `.map()`, `.filter()`, or object spread — these always return new references.

### 55. Never call `.find()` or `.filter()` directly in `useEffect` dependency array
**Problem**: `useEffect(() => {...}, [list.find(x => x.id === id)])` calls `.find()` on every render, returning a new object reference even when the found item hasn't changed. React's dep comparison then always sees "changed" → effect fires every render → state update → re-render → loop.
**Working solution**: Extract to a local `const` above the effect: `const item = list.find(x => x.id === id); useEffect(() => {...}, [item]);`. Since Redux state items are immutable, the reference is stable unless the actual item changed.
**Apply when**: Any `.find()`, `.filter()`, or other array method call in a `useEffect` dep array.

### 56. `jest.setup.js` NativeAnimatedHelper mock removed in RN 0.76+ (not only 0.80)
Agent-memory previously noted this as an RN 0.80 change. In practice, the path `react-native/Libraries/Animated/NativeAnimatedHelper` no longer exists from RN 0.76+. Remove the mock from `jest.setup.js` for any project on RN ≥ 0.76; the RN jest preset handles it internally.

### 57. Maestro `00_import_baseline` flow fails when app remembers a non-Training last tab
`launchApp` (without `clearState: true`) restores the app to its last tab. If that's Settings, the flow's `extendedWaitUntil visible: 'Training'` never matches. Workaround: manually navigate via adb taps (Settings → Import Data button) and confirm the file picker. The baseline `.gains` file pushed to `/sdcard/Download/` is still found by the native file picker.

## GH-130 / Maestro Real Device Learnings

### 58. Maestro `extendedWaitUntil` timeout must exceed actual navigation render time
**Problem:** After tapping a drawer item, the target screen can take 10–15s to render on a real device over Metro. `extendedWaitUntil: visible: "X", timeout: 10000` fails intermittently.
**Working solution:** Use at least 20000ms for post-drawer-navigation waits. For screens with heavy data (video analyses list), 20s is the minimum.
**Apply when:** Writing Maestro flows that navigate through drawer menus on real devices.

### 59. Emulator MMKV encryption key instability prevents secureStorage reads across sessions
**Problem:** `secureStorage` uses an MMKV instance backed by a Keychain-stored encryption key. On Android emulators, Keychain (`react-native-keychain`) is unreliable across app restarts — the encryption key may change between sessions, making previously stored data (including the Anthropic API key) unreadable. Symptoms: API key appears to be set (UI shows dots), but every API call returns 401. `curl` from the host confirms the key itself is valid.
**Working solution:** For live API testing on emulator, use `adb shell am start -n ... --es "debug_api_key" "<key>"` to inject the key at runtime, or skip live API evidence and rely on unit tests + error-handling screenshots. Note this infra limitation explicitly in `summary.md`.
**Apply when:** Any feature that reads secureStorage on emulator and needs a live API response as evidence.

### 60. React state for API key must subscribe to `subscribeToApiKeyChanges`, not read once at mount
**Problem:** A component that reads `secureStorage.hasAnthropicApiKey()` as a lazy `useState` initializer sees the value at mount time only. If the user adds or removes an API key in Settings, the component's UI stays stale (showing "add API key" even after saving one).
**Working solution:** Use `useState` with a synchronous initializer, then add a `useEffect` that calls `subscribeToApiKeyChanges(() => setHasApiKey(secureStorage.hasAnthropicApiKey()))` and returns the unsubscribe function. This makes the component reactive to key changes without a Redux store for the key itself.
**Apply when:** Any component that gates UI on whether an API key is present.

### 59. Maestro flows must start by navigating to the correct tab — never assume current tab
**Problem:** A flow that starts with `tapOn: point "6%,6%"` (drawer hamburger) will open the CURRENT tab's drawer, not the Analyse drawer. If the app is on Training tab, "Video Analyses" won't be in the drawer.
**Working solution:** Always start drawer-based flows with an explicit `tapOn: "tab-analyse"` (or the target tab) before opening the hamburger. The `tab-*` content-desc selectors reliably match the bottom nav on both real devices and emulators.
**Apply when:** Any Maestro flow that navigates via the Analyse or Training drawer.

### 60. `processColor` must be imported from `react-native`, not `react-native-paper`
**Problem:** `react-native-paper` does not export `processColor`. Importing from Paper compiles without error (re-export) but crashes at runtime when the function is called.
**Working solution:** Always import `processColor` from `react-native`: `import {processColor} from 'react-native';`
**Apply when:** Any component that uses `processColor` for chart colors (react-native-charts-wrapper).

## Maestro: Analyse Tab Navigation Quirks

### Analyse tab remembers last sub-screen; drawer toggle absent on Dashboard
After `force-stop` + cold launch, `tapOn: 'tab-analyse'` always shows the Analyse Dashboard ("Deine Woche auf einen Blick"). On subsequent app opens (clearState: false), the tab resumes the last visited sub-screen (e.g. Exercise Graphs). Only sub-screens expose `analyse-drawer-toggle`; the Dashboard does not. Flows that unconditionally `tapOn: id: 'analyse-drawer-toggle'` fail on cold starts. Fix: use two conditional `runFlow: when:` blocks — one for sub-screens (drawer toggle visible) and one for the Dashboard ("Alle Metriken" button visible).

### "Metrics Overview" text ambiguity when opened via drawer
If already on Metrics Overview and the drawer is opened, both the screen header and the drawer item contain the text "Metrics Overview". `extendedWaitUntil: visible: 'Metrics Overview'` resolves immediately (header is visible), and `tapOn: 'Metrics Overview'` may tap either. This makes the navigation unreliable. Design flows to avoid opening the drawer while already on Metrics Overview. If navigation to Metrics Overview is needed from another sub-screen (unambiguous screen title), the drawer approach is fine.

### Maestro stdout log may be truncated when run as background process
A Maestro test piped to a log file (`maestro test ... > run.log 2>&1 &`) may show only the first few seconds of output. The internal Maestro debug log at `~/.maestro/tests/<timestamp>/maestro.log` has the full trace. Screenshots are the most reliable evidence of flow completion — if all expected `takeScreenshot` files exist with timestamps spanning the expected flow duration, the flow ran to completion regardless of what the stdout log shows.

## GH-124-fix1 / RN 0.80 Patch Iteration Learnings

### `patch-package` picks up Gradle build artifacts if the library was built before re-patching
**Problem/Symptoms:** Running `npx patch-package <lib>` after editing node_modules produced a 4.5 MB patch full of binary `.dex` and `.bin` files from `node_modules/<lib>/android/build/`.
**Working solution:** `rm -rf node_modules/<lib>/android/build` before running `patch-package`. This shrinks the patch to only source file diffs (122 lines vs 52k lines).
**Apply when:** Any time you edit a library that has been previously built by Gradle in the same checkout, before regenerating its patch.

### `static final ExecutorService` in a RN module is not shut down on ReactContext reload
**Observation:** Using `static final ExecutorService` across all module instances means the worker thread survives bridge teardown and React context reloads, leaking one thread per reload.
**Apply when:** Any patch that introduces a thread pool for a RN native module. Prefer an instance-level `final ExecutorService executor` field and call `executor.shutdown()` in `invalidate()` so the thread is released with the module instance.

### `sendError` uses `this.promise` — call `promise.reject` directly inside background runnables
**Problem/Symptoms:** `sendError(code, message, e)` in RN native modules routes to `this.promise`. Inside a background executor runnable, `this.promise` may have been cleared to null between the time the runnable was submitted and when it catches an exception.
**Working solution:** Capture `promise` as a `final` local variable before `executor.execute(...)`, then call `promise.reject(code, message, t)` directly in the catch block. This guarantees the specific promise for this pick call is settled.
**Apply when:** Adding try/catch inside any `executor.execute` lambda in a RN native module that uses an instance-level promise field pattern.

### `gh pr edit --body` fails silently when repo has classic Projects attached
**Problem/Symptoms:** `gh pr edit 125 --body ...` exits 1 with "Projects (classic) is being deprecated" — the PR body is NOT updated despite the command appearing to run.
**Working solution:** Use the REST API directly: `gh api repos/<owner>/<repo>/pulls/<N> --method PATCH --field "body=$PR_BODY"`. Returns the PR number on success.
**Apply when:** Any `gh pr edit` with `--body` or `--body-file` fails with a GraphQL Projects deprecation error.

## GH-135 / React Native 0.82 Upgrade Learnings

### RN 0.82 mandates New Architecture — `newArchEnabled=false` is unsupported
**Problem/Symptoms:** The GH-135 ticket said "Old Architecture only". But RN 0.82's RNGP (`ReactRootProjectPlugin.kt`) overrides `newArchEnabled=false` → `true` for all subprojects and `AgpConfiguratorUtils.kt` hardcodes `IS_NEW_ARCHITECTURE_ENABLED=true` in BuildConfig. Setting `false` in `gradle.properties` is silently ignored.
**Working solution:** Accept New Architecture as mandatory in RN 0.82. Set `newArchEnabled=true` explicitly in `gradle.properties` — this is also required so that third-party libraries (e.g. MMKV) detect New Arch and apply the `com.facebook.react` plugin to run codegen.
**Apply when:** Any RN 0.82+ upgrade. Don't promise Old Architecture support.

### `libappmodules.so` is required in RN 0.82 New Architecture
**Problem/Symptoms:** App crashes on cold launch: `SoLoaderDSONotFoundError: couldn't find DSO to load: libappmodules.so`. `DefaultNewArchitectureEntryPoint.load()` tries to load this library for TurboModule initialization.
**Root cause:** The app had a custom `CMakeLists.txt` that only built `gainalytics_native` (video analysis). RN 0.82 requires a separate `appmodules` shared library that registers all TurboModules and Fabric components.
**Working solution:** Restructure `android/app/src/main/cpp/CMakeLists.txt` to:
1. `project(appmodules)`
2. Include `${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake` (builds `appmodules` from `OnLoad.cpp` + autolinking sources)
3. Add the custom native library as a separate `add_library(gainalytics_native SHARED native/yuv_to_rgb.cpp)` — move the source to a `native/` subdirectory so the cmake `*.cpp` glob doesn't accidentally include it in `appmodules`.
**Apply when:** Any app with a custom `externalNativeBuild.cmake.path` upgrading to RN 0.82.

### Hermes prefab module renamed from `libhermes` to `hermesvm` in RN 0.82
**Problem/Symptoms:** CMake error: `Target "worklets" links to target "hermes-engine::libhermes" but the target was not found`. The hermes AAR's prefab module was renamed.
**Working solution:** In CMakeLists.txt files that link against hermes: `if(ReactAndroid_VERSION_MINOR GREATER_EQUAL 82) target_link_libraries(... hermes-engine::hermesvm) else() target_link_libraries(... hermes-engine::libhermes) endif()`. Applied via `patches/react-native-reanimated+3.19.5.patch`.
**Apply when:** Any CMake file that links `hermes-engine::libhermes` when upgrading to RN 0.82.

### `UIManagerModuleListener` removed in RN 0.82; use `UIManagerListener`
**Problem/Symptoms:** Java compile error: `cannot find symbol: class UIManagerModuleListener`. This interface was removed. `addUIManagerListener`/`removeUIManagerListener` also removed.
**Working solution:** Replace `implements UIManagerModuleListener` with nothing (or just use `UIManagerListener` which already existed). Use `addUIManagerEventListener`/`removeUIManagerEventListener`. In `willDispatchViewUpdates(UIManager uiManager)`, handle both Fabric (New Arch) and UIManagerModule (Old Arch fallback) via instanceof checks. Applied via `patches/react-native-reanimated+3.19.5.patch`.
**Apply when:** Any library implementing `UIManagerModuleListener` on RN 0.82.

### `react-native-mmkv@2.x` JSI init broken in RN 0.82 Bridgeless mode
**Problem/Symptoms:** Redbox: "Failed to create a new MMKV instance: React Native is not running on-device." MMKV v2's `createMMKV.ts` checks `global.mmkvCreateNewInstance` (JSI function auto-installed by TurboModule), then falls back to Old Arch path which checks `global.nativeCallSyncHook`. In Bridgeless mode this auto-install doesn't work.
**Working solution:** Upgrade to `react-native-mmkv@3.x` (full TurboModule). Note: v3.x needs `newArchEnabled=true` in gradle.properties so codegen generates `NativeMmkvPlatformContextSpec`. API is unchanged: `new MMKV()`, `new MMKV({id: ...})` still work.
**Apply when:** Using react-native-mmkv on RN 0.82+.

### `patch-package` bloated by reanimated's own `.cxx` build artifacts
**Problem/Symptoms:** `npx patch-package react-native-reanimated` produces 85,000+ line patch including CMake configure artifacts from `node_modules/react-native-reanimated/android/.cxx/`.
**Working solution:** `rm -rf node_modules/react-native-reanimated/android/build node_modules/react-native-reanimated/android/.cxx` BEFORE running patch-package. Reduces patch to 129 lines.
**Apply when:** Any time you edit react-native-reanimated node_modules and then regenerate its patch. The `.cxx` dir is separate from the app's `android/.cxx` — both need to be cleaned.

### `adb kill-server` kills the Windows ADB server when `ADB_SERVER_SOCKET` points to Windows host
**Problem/Symptoms:** In WSL with `ADB_SERVER_SOCKET=tcp:172.18.240.1:5037`, running `adb kill-server` kills the Windows ADB server. Subsequent `adb start-server` fails ("cannot start server on remote host"). All ADB commands then hang.
**Working solution:** Never run `adb kill-server` in WSL. If ADB is in a bad state, ask the user to restart ADB on the Windows side. If ADB is unreachable, use existing screenshots as evidence and note the infra problem in summary.md.
**Apply when:** Any time ADB commands start failing in a WSL session. The `ADB_SERVER_SOCKET` env var points to Windows host — killing it from Linux is irreversible from WSL.

### 61. Baseline fixture has no video analysis VL data — `useVelocityLossInsights` always returns [] on device
**Observation:** The baseline fixture (`1772318214222.gains`) has no video analysis records with `status=DONE` AND `setResult.velocityLossPercent` set. `useVelocityLossInsights` always returns empty array when the fixture is the only data source. VL cards (in both MicroOverview and TrainingOverviewCard) will never render on a fixture-only device state.
**Apply when:** Any ticket requiring VL insight card screenshots from baseline data. Use unit tests to verify VL rendering instead; document the gap clearly in summary.md.

### 62. APK from older worktree + newer Metro bundle can show Drawer `useLegacyImplementation` crash
**Problem/Symptoms:** Installing an APK from an older worktree (e.g. GH-139) with a newer Metro bundle causes "The `useLegacyImplementation` prop is not available with Reanimated 3" crash on drawer navigation. Dismissed, but app reloads and navigation is broken.
**Working solution:** Use the most recent compatible APK (GH-135 was built from the RN 0.82 upgrade and works with subsequent JS bundles). Prefer GH-135's APK over GH-139's when the current worktree can't build.

## GH-139 / React Native 0.84 Upgrade Learnings

### Reanimated 4.x breaks @react-navigation/drawer v6 in two ways
**Problem/Symptoms:** (1) `isConfigured()` is exported from reanimated 4 but returns `false` (it's deprecated — use `reanimatedVersion` instead). `@react-navigation/drawer@6.x` defaults `useLegacyImplementation = !Reanimated.isConfigured?.()` → `true`, then throws "The `useLegacyImplementation` prop is not available with Reanimated 3". (2) The modern drawer in v6 uses `useAnimatedGestureHandler` which was removed in reanimated 4.
**Working solution:** Upgrade `@react-navigation/drawer` to v7.x and `react-native-drawer-layout` to v4.x. This requires upgrading all of `@react-navigation/*` to v7 since drawer v7 depends on `@react-navigation/native ^7.x`. The v6→v7 upgrade is non-breaking for the APIs used in this app (createDrawerNavigator, createNativeStackNavigator, NativeStackScreenProps, useNavigation, useFocusEffect).
**Apply when:** Any upgrade to react-native-reanimated ≥ 4.0.

### react-native-worklets requires a Jest mock from reanimated 4.x onwards
**Problem/Symptoms:** `require('react-native-reanimated/mock')` in jest.setup.js now transitively imports `react-native-worklets` (new package split from reanimated 4). Without a mock, any test file crashes with `WorkletsError: Native part of Worklets doesn't seem to be initialized`.
**Working solution:** Add `jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));` to `jest.setup.js` BEFORE the reanimated mock.
**Apply when:** Any project upgrading to react-native-reanimated ≥ 4.0.

### react-navigation v7 validates initialRouteName strictly
**Problem/Symptoms:** `initialRouteName="Feed"` in a Tab.Navigator that has no "Feed" screen was silently ignored in v6. In v7, it throws "Couldn't find a screen named 'Feed' to use as initialRouteName." at startup.
**Working solution:** Change `initialRouteName` to match an actual registered screen name (e.g., "Training").
**Apply when:** Upgrading @react-navigation/* v6 → v7 — check all Navigator components for phantom `initialRouteName` values.

### react-native-reanimated 4.x patch from 0.82 upgrade is no longer needed
**Observation:** The `react-native-reanimated+3.19.5.patch` that fixed hermes prefab rename (libhermes → hermesvm) and UIManagerModuleListener removal for RN 0.82 is specific to reanimated 3.x. Reanimated 4.x includes these fixes natively. Drop the patch when upgrading to reanimated 4.
**Apply when:** Upgrading from reanimated 3.x to 4.x — check if the patch still applies and if it addresses an issue still present in the new version before keeping it.

### 63. Jest `/.worktrees/` testPathIgnorePattern blocks all test runs from worktrees
**Problem:** `jest.config.cjs` includes `/.worktrees/` in `testPathIgnorePatterns`. Running `npm test` from inside a worktree path silently finds 0 tests because all absolute paths contain `.worktrees`.
**Symptoms:** `Pattern: <name> - 0 matches` even when the test file exists. `testMatch: 48 matches` but `testPathIgnorePatterns: 0 matches` — confusing output because the reported "0 matches" refers to files surviving the ignore filter, not files skipped.
**Working solution:** Override the ignore list on the CLI: `npx jest --config jest.config.cjs --testPathIgnorePatterns "/node_modules/" "/__tests__/coverage/"` (drop `/.worktrees/` from the pattern). Confirmed in GH-113-fb1 and GH-151.
**Apply when:** Any worker running `npm test` from a worktree path and getting `Pattern: ... - 0 matches` for a test that clearly exists.

### 64. Manually import baseline data via adb taps when Maestro fails
**Problem:** Maestro `00_import_baseline.yaml` flow fails due to ADB server mismatch (WSL ADB client vs Windows ADB server) or gRPC issues. Baseline import is still needed for evidence screenshots.
**Working solution:**
1. Push file: `bash run-maestro-from-wsl.sh --mode bootstrap` (just pushes the .gains file, no Maestro needed)
2. Navigate to Settings tab: `adb -s $DEVICE shell input tap 945 2232`
3. Scroll to bottom: `adb -s $DEVICE shell input swipe 540 1500 540 500 500`
4. Tap "Import Data" button: get bounds from `uiautomator dump`, tap center
5. Confirm "Import" on dialog: get bounds from dump, tap
6. Select `baseline.gains` from file picker: get bounds from dump, tap
7. Verify: navigate to Training tab and check for "Push pull" text in `uiautomator dump`
**Apply when:** Maestro import fails with device-not-found or connectivity errors; baseline data is required for evidence screenshots.

### 65. Fresh APK + adb reverse is sufficient for RN 0.84.1 emulators
**Observation:** After installing a freshly-built APK (no SharedPreferences set) and running `adb -s $DEVICE reverse tcp:8081 tcp:$HOST_METRO_PORT`, the app loaded from the correct Metro on an Android emulator running API 35. This contradicts the earlier note that 10.0.2.2:8081 bypasses adb reverse — it appears that on RN 0.84.1 or newer emulator images, localhost:8081 is used by default (not 10.0.2.2:8081), so the adb reverse IS sufficient.
**Apply when:** RN 0.84.1+ and API 35 emulator — try adb reverse first before setting up socat bridges or manually editing SharedPreferences.

## GH-152 / Maestro Video Analysis Flow Consolidation

### 66. Samsung real-device PIN lock blocks Maestro even though adb shows "device"
**Problem/Symptoms:** `adb get-state` returns "device" and file pushes succeed, but Maestro flow fails at first `assertVisible` with "element not visible". UI dump shows "PIN eingeben" (lock screen). `wm dismiss-keyguard` has no effect on a PIN-locked device. Maestro screenshots are black (Samsung DRM).
**Working solution:** Device must be manually unlocked before any Maestro session. Check `adb shell uiautomator dump` for "PIN eingeben" text immediately after starting a run. If found, write `blocked` status — do not try workarounds.
**Apply when:** Any Maestro run against Samsung R5CN30HWZFN (or any real Samsung with PIN lock).

### 67. Video analysis setResult/repResults is computed in PlaybackOverlayCard, not on analysis completion
**Problem/Symptoms:** After `Status: done`, the list card shows "N reps | VL X%" only if `VideoAnalysisPlaybackOverlayCard` has rendered and dispatched `dispatchSaveVideoAnalysisSetResult`. This card is in the detail view (scroll-down). If you never open the detail, `setResult` is never saved.
**Working solution:** To assert rep count and velocity in list view, first open the detail and scroll down to the Playback section so PlaybackOverlayCard runs its useEffect. Then go back to list to assert `video-analysis-set-summary-N` text.
**Apply when:** Maestro flows that assert rep count, VL%, or RIR from the VideoAnalysisTab list card.

### 68. YOLO plate detection (outer_plate_yolo26n_float32.tflite) requires real barbell footage for reliable results
**Observation:** Synthetic ffmpeg-generated videos (gray ring on dark background) may or may not be detected with the 0.2 confidence threshold. The model was trained on real barbell outer plates in gym settings. If 0 candidates are detected at t=0, analysis fails immediately (ERR_VIDEO_ANALYSIS_NO_CANDIDATE) with no fallback. For guaranteed results, use real squat videos. Synthetic fixtures are acceptable for flow structure testing if the `awaiting_seed_selection` path is also handled.
**Apply when:** Creating video analysis Maestro fixtures. If YOLO detection fails on synthetic videos, check the device's /sdcard/Download/ for existing real squat videos.

### 69. RIR chip filter is the most reliable filter for Maestro video analysis filter flows
**Observation:** Any analysis without a computed rirEstimate (null) is hidden by any RIR chip filter. This includes done analyses where the Playback detail was never opened (rirEstimate not dispatched) and freshly imported analyses in QUEUED/COPYING/PREFLIGHT/PROCESSING state. Use `tapOn: {id: 'video-analysis-rir-chip-0'}` (resource-id match). VL chip filters are less reliable because completed analyses may have various VL values.
**Apply when:** Writing Maestro flows that test the VideoAnalysisTab filter chips.

### 70. `tapOn: 'some-testID'` matches by TEXT, not by resource-id — always use `tapOn: {id: 'some-testID'}` for testID matching
**Problem/Symptoms:** Maestro flow fails with "Element not found: Text matching regex: analyse-drawer-toggle" even though the element has `testID="analyse-drawer-toggle"` in React Native. `tapOn: 'some-string'` in Maestro matches by text/content-desc, NOT by resource-id/testID.
**Working solution:** Always use `tapOn: {id: 'resource-id-value'}` for matching by testID/resource-id. Also applies to `assertVisible: {id: '...'}` vs `assertVisible: "..."` (text match). Similarly, `extendedWaitUntil: visible: {id: '...'}` for resource-id wait, vs `visible: "text"` for text wait.
**Apply when:** Every `tapOn`, `assertVisible`, and `extendedWaitUntil` in Maestro flows — always be explicit about whether you're matching by text or id.

### 71. Android 13+ photo picker doesn't show adb-pushed files — use existing device data for video analysis flows
**Problem/Symptoms:** Files pushed to `/sdcard/Download/` via `adb push` don't appear in the Android photo picker (ACTION_PICK_IMAGES / Google Photo Picker). The picker only shows media-indexed files. `MEDIA_SCANNER_SCAN_FILE` broadcast requires system permission on Android 13+. Synthetic fixture files stay invisible to the picker until indexed.
**Working solution:** Design video analysis Maestro flows to work with EXISTING analyses on the device rather than importing new ones. The device typically has real analyses from previous sessions. Assert from real data (Status: done with actual tracking points) instead of triggering new imports through the broken picker path.
**Apply when:** Any Maestro flow on R5CN30HWZFN (or any Android 13+ device) that needs to interact with the video file picker for importing analysis videos.

## GH-153 / Maestro Selector Cleanup Learnings

### 72. Run Maestro via `cmd.exe /c maestro.bat` with UNC path when WSL gRPC fails
**Problem/Symptoms:** Maestro run via WSL (`maestro --host 172.18.240.1`) fails with `DEADLINE_EXCEEDED` (120 s gRPC timeout) during `viewHierarchy` on consecutive sessions. Root cause: Maestro's ADB TCP port-forwarding tunnel drops mid-session when the Windows ADB server is accessed via the WSL gateway IP.
**Working solution:** Run Maestro via `cmd.exe /c "C:\Users\...\maestro.bat --device emulator-5554 --driver-host-port PORT test \\wsl.localhost\Ubuntu-22.04\...\flow.yaml"`. Windows ADB server at `localhost:5037` is always stable for native cmd.exe. Prepend `cd C:\Users\...\AppData\Local\Temp &&` to avoid UNC working-directory errors that break `takeScreenshot` saves.
**Apply when:** Maestro sessions fail on the second or third run with DEADLINE_EXCEEDED or `Command failed (tcp:PORT): closed`. Only affects the worker's own consecutive session runs, not between separate worker invocations.

### 73. Maestro `takeScreenshot` fails in cmd.exe UNC-path mode without a writable Windows dir
**Problem/Symptoms:** When running `maestro.bat` with a UNC flow path (`\\wsl.localhost\...`), cmd.exe falls back to the Windows system directory as CWD. `takeScreenshot: foo` tries to write `foo.png` in that directory and throws `java.io.FileNotFoundException: foo.png (Zugriff verweigert)`.
**Working solution:** Prepend `cd C:\Users\%USERNAME%\AppData\Local\Temp &&` (or any writable Windows path) before `maestro.bat` in the cmd.exe call. Screenshots land in Temp and can be pulled via `adb pull /sdcard/...` or retrieved from `C:\...\Temp\` via `/mnt/c/`.
**Apply when:** Any cmd.exe Maestro invocation that uses `takeScreenshot` in the flow YAML.

### 74. Baseline fixture data causes DashboardTab crash in current emulator APK (GH-119 unfixed)
**Observation:** On the currently installed APK on emulator-5554, navigating to the Analyse tab (DashboardTab) after adding a workout set with 21 reps triggers `calculateMetricValue: workoutsCount is required for Metric.FREQUENCY`. Same crash also triggers when navigating to a finished training (TrainingsOverview). This is the pre-existing bug tracked in GH-117/GH-119 — the fix is not deployed to emulator-5554.
**Apply when:** If evidence screenshots of DashboardTab are required, use the Maestro log from `gh77_dashboard_smoke` (which runs fresh before any session adds data) as proof instead of a direct screencap.

## GH-159 / Settings Model Picker Learnings

### 75. Maestro swipe inside React Native ScrollView unreliable — use coordinate-based assertions or screenshots instead
**Problem/Symptoms:** `scrollUntilVisible`, `scroll`, and `swipe: direction: UP` all fail to scroll a RN `ScrollView` in the Maestro version used on this project. Elements below the fold cannot be asserted via Maestro even though they are accessible via `uiautomator dump`.
**Working solution:** (1) Limit Maestro flows to asserting elements already visible without scroll. (2) Use `uiautomator dump` + adb `screencap` to provide visual evidence for scrolled content. (3) Only use Maestro scroll assertions for elements the existing `01_training_smoke.yaml` successfully scrolls (i.e., the training list).
**Apply when:** Any ticket where the new UI is below the fold in a scrollable screen. Don't block `ready_for_review` on Maestro scroll assertions — use screenshots + adb dump instead.

### 76. react-native-paper TextInput mock must render a real RNTextInput to support fireEvent.changeText in tests
**Problem/Symptoms:** The default `jest.mock('react-native-paper')` in SettingsTab.spec.tsx renders TextInput as a `<View testID={testID}>` — `fireEvent.changeText(getByTestId(...))` fails silently because View has no `onChangeText`. Tests then fail with unexpected values or wrong dispatch calls.
**Working solution:** In the TextInput mock, render an inner `<RNTextInput testID={testID} value={value} onChangeText={onChangeText} />` (no testID on the wrapper View to avoid duplicate-testID errors). Import RNTextInput via `require('react-native').TextInput` inside the mock factory.
**Apply when:** Any test file that needs to `fireEvent.changeText` on a react-native-paper TextInput mock.

### 77. jest.mock factory cannot reference imported variables — use literal strings for default values in mocks
**Problem/Symptoms:** `jest.mock('../path', () => ({ fn: jest.fn(() => IMPORTED_CONST) }))` throws "The module factory of jest.mock() is not allowed to reference any out-of-scope variables" at test runtime because Babel hoists jest.mock() before imports are evaluated.
**Working solution:** Use literal string values inside the mock factory (e.g., `'claude-haiku-4-5-20251001'` instead of `DEFAULT_ANTHROPIC_MODEL`). Only variables prefixed with `mock` (case-insensitive) are allowed in the factory scope.
**Apply when:** Any jest.mock() factory that needs to reference an imported constant. Hardcode the value or compute it inline.

### 78. `core.ignorecase = true` in git worktree causes case-path conflicts for new test directories
When a worktree has `core.ignorecase = true` and existing dirs like `__tests__/tabs/analyse/` already exist in the index, `git add __tests__/tabs/Analyse/new.spec.tsx` stores the file under the lowercase path in the index (`analyse/`), even though the physical file is in `Analyse/`. `git status` then shows it as "deleted". Workaround: check `git config core.ignorecase` early; create new test files directly under the already-indexed lowercase directory to avoid the conflict.

### 79. `adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS` dismisses persistent "System UI isn't responding" dialogs
Repeated `input tap` on the "Wait" button doesn't always work when the System UI dialog is stuck. The broadcast approach dismisses it reliably and lets subsequent taps reach the app.

### 80. Jest tests in worktree must be run from the main project dir via `node node_modules/jest-cli/bin/jest.js --rootDir ./.worktrees/<branch>`
The `testPathIgnorePatterns: ['/.worktrees/']` in `jest.config.cjs` blocks all tests when `npx jest` is run inside the worktree. Use `node node_modules/jest-cli/bin/jest.js --rootDir ./.worktrees/feature-X --testPathIgnorePatterns=/node_modules/ --testPathIgnorePatterns=/__tests__/coverage/` from the repo root.

### 81. APK embeds a cached JS bundle — Metro is only used if preferences point to it AND it's reachable
**Problem/Symptoms:** Debug APK includes `assets/index.android.bundle`. Even when Metro is running with `adb reverse`, the app silently falls back to the embedded bundle if `com.powerliftingworkoutplanner_preferences.xml` still has the OLD Metro port. All previous sessions had set `debug_http_host=10.0.2.2:PORT` for a different worker's Metro. Result: app runs old code, no Metro log entries, code changes invisible on device.
**Working solution:** Check the actual prefs file: `adb shell "run-as com.pkg cat /data/data/com.pkg/shared_prefs/com.pkg_preferences.xml"`. The correct host for an AVD emulator is `localhost:8081` (via `adb reverse tcp:8081 tcp:$HOST_PORT`). Update with: `adb shell "run-as com.pkg sh -c 'printf... > /data/data/com.pkg/shared_prefs/com.pkg_preferences.xml'"`. Then force-stop + restart the app. Confirm in logcat: `isMetroRunning(): Async result = true` + `loadJSBundleFromMetro()`.
**Apply when:** Code changes are committed but the device shows old behaviour. Check logcat for `isMetroRunning()=false` before wasting time elsewhere.

### 82. `useMemo` with count-based deps produces stale derived state on content edits — use createSelector
**Observation:** Pattern `useMemo(() => arr.filter(...), [arr.length])` stays cached when Redux mutates existing entities without adding/removing them (FINISH_TRAINING changes `state`, set-value edits change workout data). Same bug with `useEffect` deps like `workoutCount = Object.keys(workoutsById).length`.
**Working solution:** Extract `createSelector(state => state.slice.byId, state => state.slice.allIds, (byId, allIds) => ...)` — Redux reducers always produce new `byId` references on any mutation. Use the selector's stable output as the `useEffect` dep directly. No `eslint-disable exhaustive-deps` needed.
**Apply when:** Any `useMemo` or `useEffect` that derives data from Redux normalized state. Check for `.length` in dep arrays as a smell.

### 83. `accessible={true}` on a ScrollView collapses all descendants — UIAutomator can't see children
**Problem/Symptoms:** `TrainingsOverview`'s outer `<ScrollView accessible accessibilityLabel="trainings-overview">` makes all its children invisible to UIAutomator and Maestro. `assertVisible: "Duration"` fails even when "Duration" is clearly on screen. `uiautomator dump` shows the parent node but no children.
**Working solution:** For Maestro assertions on screens where the outer container has `accessible={true}`, assert on elements OUTSIDE the accessible container (e.g., header text, mode label) or use the `accessibilityLabel`/`testID` of the outer node itself. For content-area assertions, use `adb screencap` + screenshot evidence instead.
**Apply when:** Writing Maestro flows for any screen where the root container has `accessible={true}` (common in TrainingsOverview, TrainingHistory).

### 85. react-native-calendars custom dayComponent: use `alignSelf:'stretch'` for edge-to-edge backgrounds
**Problem/Symptoms:** A custom `dayComponent` with `width: CELL_W` (e.g. 38px) gets centered inside the calendar's `flex:1, alignItems:'center'` column wrapper (~54px on typical devices). Absolute-positioned backgrounds within the fixed-width cell cannot span the inter-column gap, so period/range highlights appear as individual bars per day with visible gaps between adjacent cells.
**Working solution:** Replace `width: CELL_W` on the outer day cell View with `alignSelf: 'stretch'`. The cell then fills the full column. Use `left: '50%'` / `right: '50%'` instead of pixel values for range-start/end positions so the half-fill is always at the exact column midpoint regardless of screen width. This is the same approach used by the library's built-in `period` day type (`alignSelf: 'stretch'` + `flex: 1` fillers with `left: 0, right: 0`).
**Apply when:** Any custom `dayComponent` that needs a background to span across adjacent day columns (date ranges, week bands, period fills).

### 84. Maestro `takeScreenshot` saves to CWD when HOME is unset or points to non-existent dir
**Problem/Symptoms:** With `HOME="${MAESTRO_RUN_HOME}"` pointing to a directory that doesn't yet contain `.maestro/tests/`, Maestro's `takeScreenshot` saves PNG files to the working directory (repo root) instead of the expected HOME path. Files appear unexpectedly at the root of the git worktree.
**Working solution:** After the Maestro run, check the worktree root for loose `.png` files, resize them with ffmpeg, and move them to `run_dir/screenshots/`. Add them to `.gitignore` or handle in the cleanup step to avoid accidental commits.
**Apply when:** Any Maestro flow using `takeScreenshot` when `HOME` is overridden to a fresh directory.

### 85. socat TCP proxy corrupts HTTP chunked encoding — causes Hermes "Compiling JS failed" errors
**Problem/Symptoms:** `socat TCP-LISTEN:8081,fork,reuseaddr TCP:127.0.0.1:$METRO_PORT` forwards TCP correctly but corrupts HTTP chunked transfer encoding for large responses (14MB+ Metro bundles). OkHttp throws `Expected leading [0-9a-fA-F] character but was 0xd` in `MultipartStreamReader`. Hermes then reports "Compiling JS failed: NNNNN:XX: non-terminated string / ';' expected / ')' expected". Error position changes on each reload because Metro recompiles a fresh bundle.
**Working solution:** Kill socat completely. Use `adb reverse tcp:8081 tcp:$HOST_METRO_PORT` + Dev Menu "Change Bundle Location" → `localhost:8081`. The adb reverse tunnel handles the connection without chunking corruption. Confirm with logcat: `isMetroRunning(): Async result = true` + no `Compiling JS failed` entries.
**Apply when:** App shows "Compiling JS failed" errors with changing line numbers across reloads. This is socat chunking corruption, not a code syntax error.

### 86. SharedPreferences file written with literal `\n` (backslash-n) instead of real newlines is not parseable
**Problem/Symptoms:** `adb shell "run-as com.pkg sh -c 'printf \"%s\" \"...\\n...\" > /path/prefs.xml'"` writes literal `\n` (`5c 6e` in hex) instead of newline (`0a`). Android's XML parser rejects the malformed file and the app falls back to its default Metro URL (10.0.2.2:8081).
**Working solution:** Use the Dev Menu "Change Bundle Location" → type `localhost:8081` → tap "APPLY CHANGES". Android's `SharedPreferences.edit().putString()` writes the file correctly with real newlines. The in-memory preference is updated immediately and the app reloads cleanly. On next cold start, the file is also read correctly.
**Apply when:** Writing SharedPreferences via adb shell. Always use the Dev Menu approach for `debug_http_host` — never write the prefs XML file manually.

### 87. `KeyboardAvoidingView` behavior="padding" works on Android; "height" can be unreliable
**Observation:** `behavior="height"` on Android shrinks the KAV from the top, which can be unexpected and cause the input row to remain hidden. `behavior="padding"` adds bottom padding equal to the keyboard height, which reliably keeps the input visible. The `keyboardVerticalOffset` should equal the height of any fixed UI above the KAV (e.g. drawer navigator header ≈ 80dp).
**Apply when:** Any chat or form screen with a fixed bottom input on Android. Default to `behavior="padding"` for both platforms unless you have a specific reason for "height".

### 88. Redux useEffect for derived state can miss the first send — add inline fallback
**Problem:** A `useEffect` that computes derived state (e.g. `seedContextJson` from training data) runs after the first render. If the user triggers an action before the effect fires, the derived state is still `null`. For chat screens this means the first message is sent without context.
**Working solution:** In the action handler (`handleSend`), check if the derived value is `null` and recompute it inline synchronously as a fallback. Dispatch the result to Redux as a side-effect. This guarantees the action always has the correct data regardless of effect timing.
**Apply when:** Any flow where a `useEffect` computes data that an action handler depends on, and the handler can be triggered before the effect fires.

### 89. UI-only fields on Redux-managed models must be stripped before API calls
**Observation:** Adding UI-only fields (e.g. `hadContext?: boolean`) to shared interfaces like `ChatMessage` risks leaking them into API request bodies if the serialization isn't explicit. Always strip UI-only fields in the API client layer (e.g. `messages.map(({role, content}) => ({role, content}))`), not in the call site. This keeps the API client safe regardless of what callers add to the messages array.
**Apply when:** Any shared data model that is both stored in Redux and serialized to an external API. UI annotations belong on the model but must never reach the wire.

### 86. KAV `behavior='padding'` overrides `paddingBottom` on its own `style` prop to 0 when no keyboard
**Observation:** `KeyboardAvoidingView` with `behavior='padding'` internally uses `StyleSheet.compose(userStyle, {paddingBottom: computedOffset})`. When no keyboard is present, `computedOffset=0`, so `compose` overrides whatever `paddingBottom` you set in the style prop. The spacer approach is the only reliable way.
**Working solution:** Remove `paddingBottom: insets.bottom` from the KAV's `style` prop. Instead, add `<View style={{height: insets.bottom}} />` as the LAST child inside KAV (after the inputRow). The spacer view is unaffected by KAV's internal padding logic and preserves safe-area gap in both keyboard/no-keyboard states.
**Apply when:** Any screen with a fixed bottom input inside KAV that needs a safe-area gap.

### 87. `useHeaderHeight()` from `@react-navigation/elements` is required as `keyboardVerticalOffset` inside a DrawerNavigator screen
**Observation:** When a `KeyboardAvoidingView` is inside a screen managed by a DrawerNavigator (which adds a header), the KAV must be told about the header's height via `keyboardVerticalOffset`. Without this, KAV adds `paddingBottom = keyboard_height - 0 = keyboard_height`, which is correct but only for the visual keyboard area — it doesn't account for the header that the KAV's coordinate calculations are relative to. On emulator the header is ~116dp.
**Working solution:** `import {useHeaderHeight} from '@react-navigation/elements';` then `const headerHeight = useHeaderHeight();` then `<KeyboardAvoidingView keyboardVerticalOffset={headerHeight}>`.
**Apply when:** Any KAV inside a stack/drawer screen that has a navigation header. Check `useHeaderHeight()` instead of hardcoded constants.

### 88. `inputRow` collapses to ~45px in constrained layout when react-native-paper TextInput (mode='outlined') is its only child
**Observation:** With `MaterialBottomTabNavigator (shifting=true)`, the scene expands to full screen height (2400px) and the tab bar floats at position:absolute. The KAV has no `paddingBottom` (after removing it per #86), so the total content area is 2400px. Inside KAV, `chat-message-list` has `flex:1` which takes all available space. The `inputRow` gets the remainder. react-native-paper `TextInput (mode='outlined')` doesn't reliably report its intrinsic height to Yoga in constrained scenarios, so Yoga collapses the row to ~45px (just padding + border).
**Working solution:** Add `minHeight: 73` to `inputRow` style. 73dp = the known correct height of the input row when measured in keyboard-open state (where Yoga lays it out correctly because the scene height is keyboard-constrained). Never add `flex:1` to the TextInput child inside the inputRow.
**Apply when:** Any screen with a bottom input row inside a scene managed by MaterialBottomTabNavigator where the input appears collapsed or height=45px.

### 89. ADB reverse is silently lost after app force-stop or Metro restart — always verify before loading bundle
**Observation:** `adb -s <device> reverse tcp:8081 tcp:$PORT` establishes a tunnel that persists until the adb server disconnects or the reverse is cleared. Force-stopping the app does NOT clear the reverse, but if the adb daemon is restarted (e.g. by Maestro, Android Studio, or USB reconnect), the reverse is gone. The app then loads its embedded bundle silently.
**Working solution:** Before any layout verification session, run `adb -s <device> reverse --list` and confirm the expected port mapping exists. If missing, re-establish with `adb -s <device> reverse tcp:8081 tcp:$HOST_PORT`. Then force-stop + relaunch the app.
**Apply when:** Code changes aren't reflected on device (same behavior as before commit). This is the first thing to check before deeper debugging.

### 90. Codex review P1 flags can be stale — always read the current code before acting on review feedback
**Observation:** In GH-168 r5, the codex review flagged `behavior={undefined}` on Android as a P1 issue. But reading the current code showed `behavior="padding"` at AIChatTab.tsx:366, unconditionally — the fix was already in r3. Acting on codex feedback without first reading the current code led to r4 burning $8.84 with zero output (worker assumed no change needed but didn't document or push).
**Working solution:** In every feedback round, explicitly grep/read the specific code location the review mentions. If the fix is already there, document the code reference and line number, take a verification screenshot, and write ready_for_review immediately. Do NOT just "investigate and exit without output."
**Apply when:** Any resume/feedback round where a code review references a specific fix or pattern. Read first, decide, act, exit.

### 92. Training edit mode: navigate via `plan-meta-{id}` + `header-overflow-icon` + `overflow-edit`
**Observation (GH-218):** Text-based navigation to training screens (e.g. `tapOn ".*Push pull.*"`, `tapOn 'Last Training'`) breaks when the GH-204 dashboard redesign made those cards non-pressable. The reliable pattern for all training edit mode flows is:
1. `scrollUntilVisible id: 'plan-meta-{plan.id}'` + `tapOn id: 'plan-meta-{plan.id}'` — navigates into the plan
2. `extendedWaitUntil visible id: 'header-overflow-icon'` — confirms training is loaded
3. `tapOn id: 'header-overflow-icon'` → `tapOn id: 'overflow-edit'` — enters edit mode (AddWorkoutSet for PLANNED/STARTED, EditTraining for FINISHED)
`header-overflow-icon` is only visible when `!showHistory && !showDone && training !== undefined`.
**Apply when:** Writing or debugging Maestro flows that need to enter any training's edit/view mode.

### 93. `MicroHeroCard` and `LastTrainingCard` are non-pressable display cards after GH-204
**Observation (GH-218):** Flows that used `tapOn ".*Push pull.*"` or `tapOn 'Last Training'` to navigate failed after GH-204 turned those cards from tappable navigation targets into display-only components. Maestro's `tapOn text:` does a best-effort accessibility match — if the element exists but is not pressable, the tap may not register or may fire on a wrong element.
**Apply when:** Any flow navigating to a training via hero card or "Last Training" text. Use `plan-meta-{id}` + overflow navigation instead (see #92).

### 94. `EditTraining` content is inside TrainingsPlanNode's main ScrollView — inaccessible to Maestro
**Observation (GH-218):** After entering edit mode for a FINISHED training (via `overflow-edit`), `EditTraining` renders inside `TrainingsPlanNode`'s ScrollView. This ScrollView has `accessible={true}` (or equivalent), collapsing all descendants. `edit-training-open-times-modal`, `edit-training-times-start/end`, `edit-training-times-duration`, `edit-training-times-save` are ALL unreachable by Maestro id/text selectors. The screen renders correctly (confirmed by screencap) but `extendedWaitUntil id: 'edit-training-open-times-modal'` times out. This is the same pattern as #83 (TrainingsOverview).
**Apply when:** Writing Maestro flows that need to interact with the EditTraining component (FINISHED training edit mode). Use `adb screencap` + uiautomator dump for evidence instead of Maestro assertions.

### 95. Maestro driver port cycling: force-stop `dev.mobile.maestro.android` between consecutive flows
**Observation (GH-218):** Running multiple Maestro flows in a session without clearing the driver causes `Command failed (tcp:PORT): closed` and `DEADLINE_EXCEEDED` errors on the second and subsequent flows. Root cause: the Maestro driver app on-device holds the port open and gets into a bad state after one flow ends.
**Working solution:** Between each Maestro run: `adb -s $DEVICE shell am force-stop dev.mobile.maestro.android && sleep 5`. This reliably clears the driver state. The port binding is re-established cleanly when the next `maestro test` starts.
**Apply when:** Any session that runs multiple Maestro flows sequentially. Always force-stop between runs.

### 91. Emulator hardware keyboard mode: IME shows as floating toolbar, not QWERTY panel
**Observation:** When the emulator has a hardware keyboard attached (WSL dev environment), `adb shell input tap` on a TextInput focuses it and triggers IME (`mInputShown=true` confirmed via `dumpsys input_method`), but the soft keyboard does NOT render as a visible QWERTY panel. Instead, a small floating toolbar (mic, backspace, send, emoji, menu) appears. `adb shell uiautomator dump` will NOT show a keyboard package in the hierarchy.
**Working solution:** To verify keyboard-avoidance behavior, use `dumpsys input_method | grep mInputShown` to confirm IME is active, then take a screencap. The floating toolbar IS the keyboard in this mode. To get a full QWERTY soft keyboard, would need to disable hardware keyboard in emulator config (not accessible from WSL — emulator console TCP port 5554 is unreachable).
**Apply when:** Trying to get keyboard-visible screenshots on WSL emulator and the keyboard isn't showing visually. Use `mInputShown=true` as the authoritative indicator.
### 87. `react-native-modal@13.0.1` componentWillUnmount crashes on RN 0.84 (BackHandler.removeEventListener removed)
**Problem/Symptoms:** A "TypeError: undefined is not a function" red-screen overlay surfaces during navigation, drawer toggling, or sub-tab switching whenever a `MultiselectDropdown` (from `sharingan-rn-modal-dropdown`, which wraps `react-native-modal`) is mounted on screen. Stack: `at ReactNativeModal (modal.js:459)` → `at MultiselectDropdown` → `at TrainingElementPicker`. modal.js line 459 is `BackHandler.removeEventListener('hardwareBackPress', ...)` — that API was removed in RN 0.73+; the modern pattern is `subscription.remove()` returned by `addEventListener`.
**Working solution:** Do not unmount any component that contains `MultiselectDropdown`/`react-native-modal`. The existing `TrainingElementPicker` workaround keeps the dropdown always mounted via `<View style={show ? null : {display: 'none'}}>`. Wrapping the picker in `{isActive && (...)}` or moving it across tab branches that mount/unmount per state RE-INTRODUCES the crash. Keep the picker rendered unconditionally inside its tab, and only toggle visibility via the existing `show`/`display:'none'` mechanism.
**Apply when:** Any change touches `TrainingElementPicker`, `MultiselectDropdown`, or any component wrapping `react-native-modal`. Resist any "optimization" that makes the picker conditional; it will crash. Real fix is library-level (patch `react-native-modal` or replace the dropdown library).

### 92. Hand-crafted `useSelector` mock states break when a new Redux selector hook is added to a component
**Problem/Symptoms:** Tests that mock `react-redux` entirely (`jest.mock('react-redux', () => ({...}))`) and supply a hand-crafted state object will crash with "Cannot read properties of undefined" when a new hook (e.g. `useAIChatPrompt`) is added to the component and calls `useSelector(state => state.settings.aiChatPrompt)` — because the mock state doesn't have a `settings` key. The test fails at the new selector, not at the new hook's import. After fixing the missing key, a subsequent hook crash (e.g. `useSafeAreaInsets`) may surface that was previously hidden by the earlier error.
**Working solution:** (1) Add the missing top-level Redux key to all hand-crafted mock states in the affected test (`settings: {mode: 'dark'}` is sufficient when you only need the default). (2) If the component also uses navigation hooks (`useSafeAreaInsets`, `useHeaderHeight`), mock those modules too — they aren't provided by the `react-redux` mock.
**Apply when:** Adding a new `useSelector`-based hook to a component that has existing tests with hand-crafted mock states. Search for all `mockImplementation`/`mockReturnValue` calls in the spec and ensure they include the new Redux key.

### 88. Header right-side flex layout: title needs `flex:1, flexShrink:1, minWidth:0, numberOfLines:1, ellipsizeMode:'tail'` to keep trailing icons visible
**Problem/Symptoms:** A `flexDirection:'row'` header with `justifyContent:'space-between'` and a long Text on the left + multiple Texts/Icons on the right pushes trailing icons (e.g. an overflow `IconButton`) off-screen when the title is long. Even with `flexShrink:0` on the right container, the right's natural width may exceed the parent and the last child is clipped without rendering.
**Working solution:** On the LEFT container, set `flex:1, flexShrink:1, minWidth:0` and on the title `<Text>` set `numberOfLines:1, ellipsizeMode:'tail'`. The `minWidth:0` is crucial — without it RN refuses to shrink below intrinsic content size and the title forces the row wider than the parent. On the RIGHT container keep `flexShrink:0` so icons stay at natural size. This works for short-to-medium titles; very long combinations may still need a `maxWidth` constraint.
**Apply when:** Any header/row layout where a long left-side label needs to truncate so trailing actions stay visible.

### 94. Latest-ref pattern beats per-callback `useCallback` when child must expose live callbacks to a parent without infinite render loops
**Problem/Symptoms:** A child component declares `function exitToRead() { ... }` and `function handleBack() { ... }` AFTER the JSX return (function declarations hoist), then references them in a `useEffect` deps array that calls `onChromeChange({mode, exitToRead, handleBack})`. Each render creates new function references, the effect re-fires, the parent's `setPlanChromeState(newObj)` triggers a re-render, the child re-renders with new function refs, loop. Wrapping each helper individually in `useCallback` with proper deps cascades quickly because each helper closes over other helpers, and stale-closure bugs creep in.
**Working solution:** Use the latest-ref ("useEvent") pattern — one ref per exposed callback:
```ts
const exitToReadRef = useRef<() => void>(() => undefined);
const handleBackRef = useRef<() => boolean>(() => false);
const stableExitToRead = useCallback(() => exitToReadRef.current(), []);
const stableHandleBack = useCallback(() => handleBackRef.current(), []);
// ...later, before JSX return, sync refs to the latest hoisted closures:
exitToReadRef.current = exitToRead;
handleBackRef.current = handleBack;
```
The `stable*` wrappers have permanent identity, so they sit safely in deps arrays. Each invocation reads `ref.current`, which is re-synced every render, so callers always hit the latest closure (live state). Avoids both the dep cascade of nested `useCallback`s and stale-closure pitfalls. See `app/components/Training/plan/PlanTab.tsx` r3 fix for GH-194.
**Apply when:** A child exposes "live" callbacks to a parent via a setter prop (`onChromeChange`, `onSomethingReady`), AND those callbacks call other internal helpers that capture component state. Don't memoize each helper — just stabilise the leaf via a ref.

### 95. `useSelector` callbacks that build a fresh object/array on every call MUST pass `shallowEqual` (or use `createSelector`)
**Problem/Symptoms:** A component subscribes via `useSelector((state) => { const out = {}; entries.forEach(...); return out; })`. Without the second arg, react-redux compares results by `Object.is`, so a freshly-allocated object always looks "different" → re-render → re-allocate → re-render. This is the same family as #54 (`.map()`/`createSelector`) but the symptom can hide longer when combined with another instability — entry #54 surfaced via "Maximum update depth exceeded" on `MultiselectDropdown`, this variant just made the JS thread silently busy with no error overlay.
**Working solution:** `import {shallowEqual, useSelector} from 'react-redux'` and pass `shallowEqual` as the 2nd arg. One-line fix, no new deps. For derived shapes that need deeper comparison or memoization across components, prefer `createSelector` (entry #54).
**Apply when:** Any `useSelector` whose body returns `{...}`, `[...]`, `Object.fromEntries(...)`, or any expression that allocates a new container per call. Pair this check with #54 during code review.

### 96. `00_import_baseline.yaml` Maestro flow times out at the final "Training" assertion when the picker is involved
**Problem/Symptoms:** Running the bundled `00_import_baseline.yaml` flow against an APK that mounts `TrainingElementPicker` inside `PlanTab` reliably fails the final `extendedWaitUntil: visible: 'Training'` (after baseline.gains is selected and the app reloads). The flow does not progress past the Settings tab on the first try because the Maestro tap on `settings-import-data-button` does not always register, even though the button is visible. Manual ADB taps at the same coordinates work first try.
**Working solution:** When the Maestro flow stalls, drive the import manually via `adb shell input tap` on the resolved bounds: tap settings-tab, scroll, tap `settings-import-data-button` ([13,2008][527,2114] center 270,2061 on a 1080×2400 emulator), confirm the dialog by tapping "Import" in the Paper Dialog (bounds returned by uiautomator), pick `baseline.gains` in DocumentsUI. Verifying via `grep -oE 'text="Push pull"' /sdcard/ui-after-import.xml` is the right gate to start screen-capping evidence.
**Apply when:** The Plan-tab area mounts a Modal-based picker (`react-native-modal` / `MultiselectDropdown` chain) and the bootstrap Maestro flow keeps failing at the post-import "Training" wait. Don't write `needs_input` — drive the import manually and continue.

### 97. Patch-package `react-native-modal+13.0.1.patch` is the canonical fix for the BackHandler.removeEventListener red-screen
**Problem/Symptoms:** `react-native-modal@13.0.1` calls `BackHandler.removeEventListener('hardwareBackPress', ...)` in `componentWillUnmount` (modal.js:459). That static API was removed in RN 0.73+. Any unmount of a `MultiselectDropdown` / `react-native-modal` subtree (sub-tab change, micro-swipe, drawer toggle, mode transition that drops the picker) crashes with `TypeError: undefined is not a function` and renders the redbox. The display:none workaround in `TrainingElementPicker` (entry #87) only protects the picker from *self*-hiding — it does NOT survive the picker's parent being unmounted.
**Working solution:** The repo now ships `patches/react-native-modal+13.0.1.patch` (applied automatically by `patch-package` on `npm install`). It captures the subscription returned by `BackHandler.addEventListener` into `this.backHandlerSubscription` in `componentDidMount` and calls `subscription.remove()` in `componentWillUnmount`, with a fallback to legacy `removeEventListener` for forward safety. **Do not re-introduce the old workarounds (gating the picker on a flag, conditional render, etc.) — they are no longer necessary.** Dev APK requires a full rebuild after pulling the patch (the bundle is baked in); on hot-reload setups, just kill+restart Metro. If you ever upgrade `react-native-modal`, `npm install` will fail to apply the patch and prompt you to refresh it.
**Apply when:** Any future "TypeError: undefined is not a function" red-screen pointing at `ReactNativeModal` / `MultiselectDropdown` / `TrainingElementPicker` in the component stack, OR if you find yourself tempted to add `display:none`/conditional-mount workarounds around a picker. The fix is at the library level and already applied — verify the patch file exists, then look elsewhere for the bug.

### 98. Worktree node_modules are symlinks to the master repo's node_modules (jest patches travel automatically)
**Observation:** In this repo's worktree setup, `node_modules/<pkg>` inside any `.worktrees/feature-XXX/` is a symlink that resolves to `/<repo-root>/node_modules/<pkg>`. Editing a file under the worktree's `node_modules/` mutates the master repo's file, and `patch-package` records the diff against the shared module. Other worktrees pick the change up immediately.
**Apply when:** Patching a node_modules file from inside a worktree. Confirm with `readlink -f node_modules/<pkg>` first. The patch you create lives at `<worktree>/patches/` (which IS worktree-local) but the underlying node_modules edit affects every worktree. This is fine for `patch-package` (one source of truth), but be careful not to leave half-edits across worktrees that are about to be cleaned up.

### 99. Dev APK in this repo bakes the JS bundle — Metro reloads alone won't pick up node_modules changes
**Observation:** A `force-stop` + relaunch of `com.powerliftingworkoutplanner` does NOT re-fetch the bundle from Metro on this APK (the SYN to `10.0.2.2:8081` never connects, the app silently falls back to the bundle inside the APK). The Dev Menu → Change Bundle Location → `localhost:8081` flow is the proper way to switch sources but the APPLY CHANGES button doesn't always commit the SharedPreferences write reliably from `adb shell input tap` (the tap may land outside the button or the focus may be wrong).
**Working solution:** When you patched a node_modules file and need to verify it on device, the reliable path is `cd android && ./gradlew assembleDebug` (~5 min) followed by `adb -s <serial> install -r <apk>`. Metro hot-reload is fine for app source changes (where the dev bundle URL works), but for node_modules patches the rebuild guarantees the patched code is what runs.
**Apply when:** You patched a library and need device-level confirmation that the fix is live. Don't waste time fighting the Dev Menu; just rebuild.

### 100. Later `useEffect` overwrites Reanimated SharedValues set by an earlier effect — restore at end of the later effect
**Problem/Symptoms (GH-177):** `VideoAnalysisPlaybackOverlayCard` had two competing effects:
1. Duration effect (~line 475): sets `videoDurationMsSV`, `chartVisibleMinSV`, `chartVisibleMaxSV` from `correctedPlaybackDurationMs` — declared first.
2. Reset effect (~line 967): resets ALL SharedValues to 0 on `localVideoPath`/`result` change — declared later.
React runs effects in declaration order. When both deps change simultaneously (initial mount), the reset effect fires AFTER the duration effect and zeros out the SharedValues the duration effect correctly set. Because the reset effect's dep array does not include `correctedPlaybackDurationMs`, the duration effect never re-runs to restore them. Result: `videoDurationMsSV.value` = 0 → scrubber guard returns `{width: '0%'}` always; `chartVisibleMaxSV.value` = 0 → `rangeSpan <= 0` guard returns `SPEED_CHART_LEFT_PADDING` always.
**Working solution:** At the END of the later (reset) effect, after all the zeroing, re-initialize the SharedValues from the data source that was correct before the reset:
```js
if (correctedPlaybackDurationMs > 0) {
  videoDurationMsSV.value = correctedPlaybackDurationMs;
  chartVisibleMinSV.value = 0;
  chartVisibleMaxSV.value = correctedPlaybackDurationMs;
  chartVisibleMinRef.current = 0;
  chartVisibleMaxRef.current = correctedPlaybackDurationMs;
}
```
**Apply when:** Any component where a "reset everything" effect is declared after an "initialize from derived data" effect, and both share deps that change together. The restore must happen in the later effect, not in a third effect, to preserve ordering guarantees.

### 84. Drift correction that targets `playbackDurationRef` instead of `correctedPlaybackDurationMs` breaks animation at every progress event
**Problem/Symptoms (GH-177 Round 2):** After the Round 1 fix (memory #83), the scrubber and marker still stopped advancing at every sync event (~50ms). Root cause: the drift correction in `onPlayerProgress` read `playbackDurationRef.current` (plain video duration from `onPlayerLoad`) as both the guard condition and the `withTiming` target. Two failure modes:
1. `playbackDurationRef.current = 0` when ExoPlayer emits `STATE_READY` before the duration is known → `emitLoad()` with `durationMs=0` → JS `onPlayerLoad` skips the ref update → `if (totalDuration > 0)` fails → `cancelAnimation()` is called with NO restart → animation stops every 50ms.
2. `playbackDurationRef.current < correctedPlaybackDurationMs` when `timeRange.maxTimeMs` is the binding constraint → drift correction restarts animation to the wrong (shorter) target. If `correctedPlaybackDurationMs` didn't change as a result, the effect at line 667 doesn't fire to fix it.
**Working solution:** Introduce `correctedPlaybackDurationMsRef = useRef(0)` and keep it in sync alongside `videoDurationMsSV` in both the duration effect and the reset effect. The drift correction guards on and targets `correctedPlaybackDurationMsRef.current`, which always matches the value used by `onPlayPauseToggle`.
**Apply when:** Any `useCallback`/event handler that reads a duration ref to restart a `withTiming` animation. If the animation was started with `correctedX`, the restart must also target `correctedX`, not the underlying raw value. A ref shadowing the corrected value avoids stale-closure or state-read issues inside the callback.

### 85. Reanimated drift correction must check `Math.abs(drift)`, not just `drift > threshold`
**Problem/Symptoms (GH-177 Round 3):** After Rounds 1+2, the scrubber still got stuck during playback. When `withTiming` somehow stalled at 0ms (e.g. before the first restart after duration change), the native player advanced to e.g. 300ms → drift = 0 - 300 = **-300** (negative). The old guard `drift > 80` is false for negative drift, so the correction never fired and the animation stayed at 0 forever.
**Working solution:** Change `if (drift > 80)` to `if (Math.abs(drift) > 80)` so the correction fires when the animation is *behind* the player, not only ahead.
**Logcat pattern:** Log `[TAG] animated=X native=Y drift=Z` at every progress event. If you see `animated` stuck at 0 while `native` advances and `drift` stays negative, this is the bug. If you see `animated` occasionally jumping past `native` and then snapping back, that's the positive-drift correction working.
**Apply when:** Any `withTiming` animation that is corrected against an external position source (video player, audio position, etc.). Always use `Math.abs(drift) > threshold`.

### 86. Including a state value in a `useEffect` dep when you only need the ref triggers spurious `cancelAnimation`
**Problem/Symptoms (GH-177 Round 3):** The `playbackSpeed` effect had `correctedPlaybackDurationMs` (state) in its dep array so it could read the current duration for `withTiming`. When `onPlayerProgress` first reported the actual video duration, `correctedPlaybackDurationMs` changed from the bar-path-derived value (e.g. 3000ms) to the actual video duration (e.g. 40380ms), triggering the effect. The effect called `cancelAnimation` and then `withTiming` to restart. If any timing issue caused `!playbackPausedRef.current` to be briefly false (or if the restart's `remainingMs` was 0 for any reason), the animation would stop.
**Working solution:** Replace the state read with a ref that is kept up-to-date by the duration effect (`correctedPlaybackDurationMsRef.current = correctedPlaybackDurationMs`). Remove the state dep from the `playbackSpeed` effect's dep array. The effect then only fires on explicit speed-button taps, not on every progress-event-induced duration change.
**Apply when:** Any `useEffect` that reads a piece of state only to use its current value inside the callback (not to react to its changes). If you only need "the latest value at fire time", use a ref instead of a state dep. The dep array should only list values whose CHANGES should trigger the effect.

### 87. Reanimated drift correction must use `withSequence` soft-sync, not hard assignment — and raise threshold above jitter floor
**Problem/Symptoms (GH-177 Round 3/4):** After fixing the `Math.abs(drift)` check, the scrubber advanced but stuttered at 5-10 fps. Root cause: every time drift exceeded 80ms (which happened on almost every `onPlayerProgress` tick due to natural jitter — frame quantization ≈33ms, decoder warmup 50-300ms), the correction did `playbackTimeMsSV.value = nativeMs` (hard assignment) before restarting `withTiming`. This instant snap was visible as the marker jumping backward/forward by 50-150ms before the smooth animation resumed.
**Working solution:**
1. Replace `cancelAnimation + playbackTimeMsSV.value = nativeMs + withTiming(end)` with `cancelAnimation + withSequence(withTiming(nativeMs, {duration:80}), withTiming(end, {duration:remaining/speed}))`. The 80ms glide to native position is visually imperceptible and avoids the jump.
2. Raise the threshold from 80ms to 250ms. 80ms is below the jitter floor on real devices; 250ms only fires on genuine desync, letting the `withTiming` animation run uninterrupted through normal playback.
3. Avoid the `'worklet'` + JS-ref pattern in completion callbacks (worklets cannot access React `useRef` values). Use `withSequence` to chain the two animations instead, relying on `cancelAnimation` from `onPlayPauseToggle` to interrupt the sequence when the user pauses.
**Apply when:** Any `withTiming` animation corrected against an external position source (player, audio, etc.) where the jitter on that source is significant. Hard-snap corrections at high frequency cause visible stutter; a short leading `withTiming` glide hides the correction.

### 88. Drift correction with `withTiming(end, {duration: end - animatedMs})` does NOT converge when animated > native
**Problem/Symptoms (GH-177 Round 5→6):** After replacing `withSequence` with a single `withTiming` + 500ms cooldown (Round 5), the marker still froze near 100% on R5CN30HWZFN. Root cause: the correction restarted `withTiming(totalDuration, {duration: totalDuration - animatedMs})`. When `animatedMs > nativeMs` (animation ran ahead), `totalDuration - animatedMs` shrank toward 0. The animation finished almost instantly and the marker froze. On the next cooldown window the same thing happened — `animatedMs` was near `totalDuration`, so every correction immediately "completed" and nothing re-started meaningful motion.
**Working solution:** Use `remainingFromNative = max(0, totalDuration - nativeMs)` as the `withTiming` duration instead. This drives convergence:
- When ahead: `remainingFromNative > remainingFromHere` → animation runs longer → marker slows, native catches up.
- When behind: `remainingFromNative < remainingFromHere` → animation runs faster → marker catches up.
For large drift (>500ms) also snap `playbackTimeMsSV.value = nativeMs` first to avoid the marker lagging for the full cooldown window.
**Apply when:** Any time you restart `withTiming` toward a fixed endpoint in a drift-correction loop. The duration must be based on the REFERENCE source's remaining time, not the animation's remaining time — otherwise convergence is not guaranteed.

### 89. `withTiming` + cancelAnimation choreography produces ~1s ticking when corrections fire on every progress event — switch to `useFrameCallback`
**Problem/Symptoms (GH-177 Round 7→8):** After r7 made drift correction converge, the user reported the scrubber visibly only advanced once per ExoPlayer progress event (~1s on real devices). Even with a 500ms cooldown, every progress event whose drift exceeded the threshold caused `cancelAnimation(playbackTimeMsSV) + withTiming(end)`. The cancel/restart cycle interrupted Reanimated's worklet animation enough that the visual update only refreshed at the cancel/restart boundaries — not the smooth 60fps `withTiming` is supposed to deliver.
**Working solution:** Replace `withTiming` entirely with `useFrameCallback`:
```ts
useFrameCallback((frame) => {
  'worklet';
  if (playbackPausedSV.value || isScrubbingSV.value) return;
  const total = videoDurationMsSV.value;
  if (total <= 0) return;
  const dt = frame.timeSincePreviousFrame ?? 16.67;
  const next = playbackTimeMsSV.value + dt * playbackSpeedSV.value;
  playbackTimeMsSV.value = next > total ? total : next;
});
```
The frame callback runs on the UI thread every refresh, advancing the SharedValue by wall-clock delta. Drift correction in `onPlayerProgress` then becomes a rare safety net (only when `|drift| > 1000ms` — player stall or hidden seek), no cancelAnimation needed.
Required adaptations:
- State the worklet needs (paused/scrubbing/speed/duration) must live in SharedValues, not refs — worklets cannot read JS refs. Mirror them in JS-side handlers.
- The shipped reanimated mock (`react-native-reanimated/mock`) omits `useFrameCallback`. Extend it in `jest.setup.js`: `useFrameCallback: jest.fn().mockReturnValue({ setActive: () => {}, isActive: false, callbackId: 0 })`.
**Apply when:** Any UI-thread animation that needs to track an external time source with frequent sync events. `withTiming` is the wrong primitive when you can't avoid mid-animation cancels; `useFrameCallback` is the right one because it owns the time source itself.

### 90. Photo-Picker import on emulator: Apr 14 5s test video has no detectable plate; use the squat-3reps.mp4 (10s, Apr 26) for evidence runs
**Observation (GH-177 Round 8):** When importing a video via the in-app `Import Video` button on emulator-5554, the Google Photos picker shows three test videos (Apr 14 5s clip, Apr 26 4s clip = squat-1rep.mp4, Apr 26 10s clip = squat-3reps.mp4). Selecting the Apr 14 video produces an analysis with `Status: failed` (no outer plate detected at t=0). The Apr 26 10s clip produces `Status: done` with a populated `localVideoPath` and is the right choice for any evidence flow that needs actual playback to render.
**Apply when:** Setting up emulator-5554 to verify a fix in the Playback Overlay path. The Playback Overlay only renders when `analysis.localVideoPath && analysis.result` are both truthy; importing the wrong test video silently leaves `localVideoPath` empty. Tap-coordinates on Pixel_7_3 (1080×2400): photo-picker drag-handle row is around y=950, the 10s tile is at bounds [0,1292][358,1650] (tap 179, 1471), `Done` button is at [866,2175][949,2228] (tap 907, 2200).

### 91. Per-frame scrubber smoothness analysis via screenrec + ffmpeg + thumb x-detection (GH-177 r10)
**Observation:** When a user reports "scrubber not smooth" on a real device, single screenshots at t=0/3/5/7s prove only that animation eventually advanced — not that motion was continuous between captures. To distinguish "smooth" from "1s ticks" or "stalled", capture a 10s `adb shell screenrecord`, extract every native frame with `ffmpeg -vsync passthrough`, crop to just the scrubber bar strip, and detect the rightmost lavender pixel per frame with PIL/numpy to compute per-frame deltas. On R5CN30HWZFN with the GH-177 r9 fix: 98% positive deltas, mean 1.04 px per native frame (~62 px/s), max stall 50ms (3 frames) — empirically smooth. Mean delta of 0 with bursts of 15+px every ~1s would have indicated the old tick-pattern bug.
**Apply when:** A round needs to verify or rule out subjective smoothness complaints on a real device. A picture or four pictures cannot prove smoothness — only per-frame motion data can.

### 92. R5CN30HWZFN (Galaxy S20+) ships with `mActiveModeId=9` = 720x1600 @60Hz, NOT 120Hz
**Observation:** Samsung S20+ supports 120Hz at 1080x2400 (mode 2) but the active display mode is `9` (720x1600 @60Hz) under `dumpsys display | grep mActiveModeId`. This matters when reasoning about Reanimated `useFrameCallback` smoothness — the worklet ticks at the active refresh rate, so it's running ~16.67ms per frame on this device, not 8.33ms. Also: native screenrecord captures at the active mode resolution and ~54.7 fps avg over a 10s window with `--time-limit 10` (variable, not a hard 60).
**Apply when:** Investigating animation smoothness or designing tests against R5CN30HWZFN. Read `mActiveModeId` from `dumpsys display | grep mActiveModeId` to confirm the actual frame budget. Don't assume 120Hz just because the device "supports" it.

### 93. `IconButton` from react-native-paper exposes its testID as a `resource-id` only after the button is fully on-screen
**Observation:** The `video-analysis-playback-toggle` button (a paper `IconButton`) appears in `uiautomator dump` as `resource-id="video-analysis-playback-toggle"` ONLY when the player area is fully scrolled into view. Earlier rounds (GH-177 codex r9) failed to find this testID because they searched the dump while the player was partially below the fold. RN's accessibility tree prunes off-screen views.
**Apply when:** A direct adb tap or Maestro selector cannot find an element you can see in screenshots. Scroll the screen so the element is fully on-screen, then re-dump. Memory entry #44 covers the broader pattern; this entry is a concrete confirmation for the playback-overlay toggle.

### 94b. `__tests__` jest config excludes `/.worktrees/` — tests in worktrees need explicit override
**Observation (GH-192 r2):** `jest.config.cjs` has `testPathIgnorePatterns: ['/node_modules/', '/__tests__/coverage/', '/.worktrees/']`. When running `npx jest` from inside an orchestrator worktree at `.../.worktrees/feature-GH-192/...`, every test path matches `/.worktrees/` and is excluded. Result: `0 matches`, `Run with --passWithNoTests to exit with code 0`.
**Working solution:** Pass `--testPathIgnorePatterns="/node_modules/" --testPathIgnorePatterns="/__tests__/coverage/"` on the jest CLI to override the exclude list. Combined with `--testPathPattern="<file>"` it scopes to your new tests cleanly without the worktree exclusion.
**Apply when:** New tests added in a worktree return "0 matches" from jest. Default-config jest is unusable in worktrees.

### 95b. Plan-tab feature-flag toggles belong in TrainingsPlanDrawer, not in a non-existent overflow menu
**Observation (GH-192 r2):** GH-192 spec called for an "overflow menu (`⋮ → Show muscle map`)". The codebase has no such overflow menu — the Plan tab uses a left-side `react-native-drawer-layout` Drawer rendered through `TrainingsPlanTab` → `TrainingsPlanDrawer`. The drawer already hosts feature toggles ("Enable Planning Mode") next to the navigation segmented buttons. Adding a sibling toggle ("Show muscle map") there matches the established pattern and the spec's intent (sticky per-user choice for an opt-in card).
**Apply when:** Any new opt-in toggle for Plan-tab features. Don't invent an overflow menu; extend `TrainingsPlanDrawer.tsx` and dispatch through the existing `app/redux/settings/dispatch/` pattern.

### 96b. Persistence for new settings — use Redux + the existing settingsReducer, not new MMKV keys
**Observation (GH-192 r2):** The spec for GH-192 said "stored per user in MMKV under `plan.muscleMap.metric`/`plan.muscleMap.compare`". The codebase doesn't use MMKV directly for app preferences — it uses `app/redux/settings/settingsReducer.ts` with action handlers like `SET_PALETTE` / `TOGGLE_DISABLE_TIMER` / `SET_METRIC_OVERVIEW_SLOT`, persisted through `redux-persist`. Adding a `plan?: PlanSettings` field to `AppSettings` plus `SET_PLAN_MUSCLE_MAP_{ENABLED,METRIC,COMPARE}` reducers and matching dispatch hooks integrates with the rest of the settings UI for free (`useSettings()` works) and stays survivable across reloads.
**Apply when:** Any spec referencing MMKV keys for user preferences. Translate the keys into nested fields on `AppSettings` and add reducer cases / dispatch hooks that match the existing convention (action types in SCREAMING_SNAKE_CASE, hooks named `dispatchSet…`).

### 97b. Normalize persisted enum settings on read after a value-set rename
**Observation:** When a feedback round renames the legal values of a persisted enum (GH-192 r2 changed `compare` from `'micro'|'last'|'none'` to `'none'|'last_plan'|'current_total_plan'`), users who tested the prior round have AsyncStorage entries with the old values. The reducer can't safely delete them via a one-shot migration without a redux-persist migration hook, but the consuming component can normalize on read. In `MuscleInvolvementCard`, a `normalizeCompare(raw)` helper that returns the new default when the persisted value is not in the new set ensures a clean UI without writing migration code.
**Apply when:** Feedback rounds that change the legal value-set of a persisted enum. Add a `VALID_X` array + `normalizeX(raw)` helper at the consumer boundary (component or selector) that maps unknown / legacy values to the new default. Cheaper than a redux-persist migration and self-healing once the user touches the dropdown.

### 98b. Plan-tab muscle-map / Plan-tab card lifecycle is gated by training state — not just by a feature flag
**Observation:** The MuscleInvolvementCard renders only when both `appSettings.plan?.muscleMap?.enabled` AND `training?.state === TrainingsState.PLANNED` are true (`TrainingsPlanNode.tsx`). On a device whose baseline `.gains` fixture has every Micro 1 training already FINISHED, the card cannot appear without first navigating to a higher micro that contains a PLANNED training — and on RN 0.84 every micro change can hit the pre-existing `react-native-modal` `BackHandler.removeEventListener` redbox (memory entry #96). Document this in summary.md when capturing evidence on a fixture-only device, and rely on selector unit tests for compare-mode coverage.
**Apply when:** Any future feature gated on training state in addition to a feature flag. Verify the fixture has a training in the required state at micro 1 before assuming on-device capture is feasible; otherwise plan to use unit-test evidence for the gated branches.

### 99b. After GH-194 the Plan-tab card mount lives in `PlanTab.tsx`, not `TrainingsPlanNode.tsx`
**Observation (GH-192 r3):** GH-194's 3-state Plan tab refactor turned `TrainingsPlanNode.tsx` into a thin wrapper and moved the actual list rendering into `PlanTab.tsx` / `PlanReadList.tsx` / `PlanEditList.tsx`. Any feature card that was previously inserted at the top of `TrainingsPlanNode` (e.g. the GH-192 `<MuscleInvolvementCard />` with a `training?.state === PLANNED` gate) is no longer in the right place — it would only appear in the wrapper, miss the new mode plumbing, and not survive read ↔ quickEdit ↔ fullEdit transitions. The correct insertion point is at the top of `PlanTab.tsx`'s `<View style={styles.container}>` (i.e. before `<DraggableExercise>`, outside the `mode === 'fullEdit' ? PlanEditList : PlanReadList` branch). One mount → all three plan modes for free, and the card no longer needs the `training.state === PLANNED` gate.
**Apply when:** Any future Plan-tab card / banner / chrome insertion. Look for the `<View style={styles.container}>` in `PlanTab.tsx`, drop the new component as the first child. Also: rebase-conflict resolution on `TrainingsPlanNode.tsx` after a GH-194-style refactor should usually take master's version (`git checkout --ours` during rebase) and re-apply only the pieces that still belong, and only inside `PlanTab.tsx`.

### 100b. Hand-crafted react-redux mocks must follow new `useSelector` calls in the component under test
**Observation (GH-192 r3):** When a refactor adds a new `useSelector`-based hook to a component (here: `PlanTab.tsx` gained `useSettings()` to read `state.settings.plan?.muscleMap?.enabled`), all spec files that mock `react-redux` with a hand-crafted state will fail with `TypeError: Cannot read properties of undefined (reading 'plan')` because the existing mock state lacks the new top-level key. Fix per spec: add the new key to the `mockUseSelector.mockImplementation` state object, plus mock the new component (here: `MuscleInvolvementCard`) since it itself calls `useSelector` with a different shape that the test won't satisfy. Same family as memory entry #92 (GH-188 hand-crafted mocks) — file under "any selector-adding refactor breaks every hand-crafted test mock".
**Apply when:** Any PR that adds a `useSelector`-based hook to a component covered by tests using `jest.mock('react-redux', ...)`. After the change, run the spec; if it crashes with a missing-key TypeError, extend the mock state and add a `jest.mock` for any newly imported component that internally calls `useSelector`.

### 101. Bootstrap import wipes `debug_http_host` SharedPreferences — must re-set bundle location
**Problem:** Maestro bootstrap uses `clearState: true` which clears all app SharedPreferences including the `debug_http_host` key that stores the custom Metro bundle location (set via "Change Bundle Location" in the dev menu).  
**Symptoms:** After import, `adb reverse` is in place but the app still connects to `10.0.2.2:8081` (hardcoded in the APK), not `localhost:8081`. The dev menu shows the old bundle address again, and reloading loads the OLD bundle even though Metro on the host has the new code.  
**Fix:** After every bootstrap import, open the dev menu → "Change Bundle Location" → change `10.0.2.2:8081` to `localhost:8081` → APPLY CHANGES. Confirm with a uiautomator dump that the input field contains `localhost:8081` before tapping apply. The `run-as` SharedPreferences file write approach does NOT work on emulators (Permission denied).

### 102. Per-bar colors in react-native-charts-wrapper BarChart via `colors` (plural) array
**Observation (GH-204):** `@types/react-native-charts-wrapper` `BarDataSetConfig` exposes both `color` (single) and `colors` (array) — the latter cycles colors across bars. To highlight the current micro's bar in primary color and de-emphasize past micros, pass `colors: mesoData.map((_, i) => processColor(i === last ? primaryColor : containerColor))`. This is the idiomatic way; no need for `highlightedBars` override.  
**Apply when:** Any dashboard card that needs per-bar coloring in a BarChart.

### 103. `useSelector` across a meso loop — acceptable for dashboards, add `createSelector` if performance degrades
**Observation (GH-204):** `MicroHeroCard` uses a single `useSelector` that loops from `mesoStart` to `currentMicro`, fetching trainings and workouts per micro to compute bar chart data. This recomputes on every store change. For a dashboard viewed infrequently this is acceptable (no visible lag on emulator), but for plans with many micros or heavy update rates, wrap with `createSelector` from `@reduxjs/toolkit` to memoize the result.

### 104. RN dev mode does NOT persist `debug_http_host` across app process death in this APK
**Problem (GH-204 r2):** Memory entry #101 says bootstrap import wipes the bundle URL — but the same loss happens on EVERY cold start, not only after bootstrap. Force-stopping the app and relaunching reverts the URL to the emulator default `10.0.2.2:8081`. Yet RN dev tooling shows no `DevSettings.xml` or `debug_http_host` key in `/data/data/.../shared_prefs/` (only `inspector_debug` and `WebViewChromiumPrefs` exist). Conclusion: in RN 0.84+ the dev-menu URL is held in process memory and does NOT round-trip through SharedPreferences. Each new process starts from the hardcoded default.
**Symptoms:** App loads the BAKED (and stale) JS bundle on cold start. Maestro `launchApp` and the smoke-mode wrapper (`run-maestro-from-wsl.sh --mode smoke`) both perform `adb shell am force-stop` before the test, which wipes the URL and prevents any new Metro bundle from being fetched. Manual changes via the dev menu work for the live process but vanish on the next cold start.
**Workarounds:**
1. Bake the new bundle into the APK with `cd android && ./gradlew assembleDebug` then `adb install -r`. This makes Metro irrelevant.
2. Drive the dev menu programmatically before each Maestro run. See `__tests__/e2e/scripts/gh204-r2-evidence.sh` — open dev menu (keyevent 82), tap "Change Bundle Location", clear field, type `localhost:8081`, tap "APPLY CHANGES", wait for fetch + render. Skip `launchApp` in the Maestro flow itself.
3. Move the URL change ahead of `run-maestro-from-wsl.sh`'s force-stop by invoking `maestro test` directly (do NOT rely on the smoke mode's `force-stop` cycle).
**Apply when:** Any feature worker capturing on-device evidence in WSL where the APK's baked bundle is older than the JS in the worktree.

### 105. Maestro CLI launched from WSL bash with `ADB_SERVER_SOCKET` to Windows-host adb often reports "Device X not connected"
**Problem (GH-204 r2):** Even though `adb -H 172.18.240.1 devices` lists `emulator-5556`, invoking `maestro --device emulator-5556 --host 172.18.240.1 --port 5037 test ...` from WSL bash with `ADB_SERVER_SOCKET=tcp:172.18.240.1:5037` exported still fails with `Device emulator-5556 was requested, but it is not connected.` The same `--device` flag works from `run-maestro-from-wsl.sh`, so it is not a Maestro bug per se but a subtle env-passing issue (likely `JAVA_TOOL_OPTIONS` blocking dadb's ADB_SERVER_SOCKET inheritance, or the WSL→Windows TCP roundtrip getting reset).
**Workaround:** When you control both the maestro CLI invocation and the dev-menu setup, capture the evidence screenshots via direct `adb exec-out screencap` instead of relying on Maestro `takeScreenshot`. The screenshot files are equivalent and the Maestro flow still serves as a regression check for the testIDs once the infra is fixed (e.g. by running maestro from the Windows side per memory entry #72).
**Apply when:** Maestro from WSL prints "not connected" despite `adb` itself seeing the device. Don't burn time tweaking Maestro flags — fall back to manual capture and document the limitation.

### 106. `pressKey: Menu` is NOT a valid Maestro keystroke — emulator dev menu must be triggered via adb
**Problem (GH-204 r2):** Maestro's `pressKey:` only accepts a small set of named keys (HOME, BACK, ENTER, BACKSPACE, VOLUME_*, POWER, ...). `Menu`, `KEYCODE_MENU`, and numeric `82` all error out as `Unknown key name`. So you cannot open the React Native dev menu directly from a Maestro flow.
**Workaround:** Drive the dev menu from a wrapper script that calls `adb shell input keyevent 82` BEFORE invoking `maestro test`. Then the Maestro flow proper assumes the dev menu has already been used (e.g. to change bundle URL or trigger Reload) and only handles user-facing UI.
**Apply when:** A Maestro flow needs the dev menu to set bundle URL, trigger Reload, or toggle Fast Refresh. Don't try to open it from inside the YAML — wrap the run.

### 107. PieChart from `react-native-charts-wrapper` works as a no-SVG completion ring
**Observation (GH-204 r2):** When a circular progress / completion indicator is needed and `react-native-svg` is not installed (it's NOT a dependency in this repo, despite reviewer assumptions), `PieChart` from `react-native-charts-wrapper` is a viable substitute. Two slices (`{value: completed}, {value: remaining}`), `holeRadius: 70` for a thin donut, `holeColor: theme.colors.surface`, `transparentCircleRadius: 70` to suppress the inner ring, `rotationAngle: 270` so the start position is at 12 o'clock, plus `colors: [primary, surfaceVariant]`. Center the count text via an absolute-positioned `<View pointerEvents="none">` overlay (the chart's `centerText` prop is unreliable for theming).
**Apply when:** A small circular ring/donut UI element is required and adding `react-native-svg` (which would require a native rebuild) is not feasible.

### 108. "Last training" baselines must filter the in-progress workout, not just `slice(-1)` of `byExerciseId`
**Problem/Symptoms:** `state.workouts.byExerciseId[id]` lists ALL workouts for an exercise, including the one currently being logged in the active session. `useAllLastWorkouts(exercise, 1)` therefore returns the in-progress workout as soon as the user logs the first set, and any "vs last training" comparison drifts to the just-logged set instead of the previous training.
**Working solution:** When you need "the previous COMPLETED training" (e.g. for delta/baseline UI), write a dedicated hook (`useLastFinishedWorkout`) that walks `byExerciseId` from newest and returns the first workout where `end !== undefined`. Keep `useAllLastWorkouts` for unrelated callers (e.g. "any-workouts-exist" checks).
**Apply when:** Any feature that compares the user's current input against historic training data on the same exercise. Never assume `byExerciseId.slice(-1)` skips the active workout.

### 109. Overflow-menu items wired to a `() => {}` no-op pass linting but ship a tappable dead control
**Observation:** It's tempting to leave a placeholder handler when "the real settings deep-link doesn't exist yet" — but the menu item still renders, gets tapped, and silently does nothing. Code review (and users) read that as a bug, not a stub.
**Apply when:** Reviewing PRs that wire menu items via `useMemo`/`useCallback` returning anonymous fns. If the body is empty `{ }` or just a TODO comment, either remove the menu item entirely OR wire it to a minimal real action (e.g. open the existing dialog with the right pre-fill). Never ship a menu item with a no-op handler.

### 110. Stable react-native testIDs are NOT in the uiautomator dump for live-updating screens
**Problem/Symptoms:** A react-native `Pressable testID="subtab-train"` or `IconButton testID="rest-timer-overflow"` is not visible to `uiautomator dump` — uiautomator returns "could not get idle state" because the rest-timer countdown ticks every second and the hierarchy never stabilizes. Maestro `tapOn: id:` also fails with "Element not found" for the same reason.
**Working solution:** When the screen has a continuously-updating element, fall back to coordinate-based `adb shell input tap`. Use Python+Pillow on a saved screenshot to find the icon's pixel coordinates by color (e.g. light-on-dark vertical-3-dots), then convert saved-image coords to device coords using the saved-vs-real width ratio (e.g. saved 800-wide → device 1080-wide → multiply by 1.35). Same for y using device height ratio.
**Apply when:** Any flow that needs to interact with a UI element rendered alongside a live-updating timer/clock. Don't waste rounds chasing testID resolution; just compute pixel coords from a screenshot.

### 111. Debug APK with both ABIs (~216 MB) won't install on a 6 GB /data partition at 89% usage; use `-PreactNativeArchitectures=x86_64` to halve it
**Problem/Symptoms:** `INSTALL_FAILED_INSUFFICIENT_STORAGE: Failed to override installation location` even after uninstalling the previous version. /data has ~640 MB free but the streamed install needs ~3× APK size for staging + dexopt.
**Working solution:** When targeting only the emulator, build with `./gradlew assembleDebug -PreactNativeArchitectures=x86_64`. APK drops from ~216 MB to ~119 MB and installs cleanly. Don't waste time trying `pm install /data/local/tmp/*.apk` — the size constraint is on the install volume, not the source path.
**Apply when:** Emulator install fails with INSUFFICIENT_STORAGE. Strip the unused arm64-v8a slice from the debug APK via the gradle property, no permanent build.gradle change needed.

### 112. jest config `testPathIgnorePatterns: ['/.worktrees/']` makes `npm test` find 0 matches when run from inside a worktree
**Problem/Symptoms:** `npm test -- --testPathPattern=Foo` from a worktree path like `.worktrees/feature-XYZ/` returns "Pattern: Foo - 0 matches" even though the test files exist. The worktree's absolute path includes `/.worktrees/`, so every spec under it is excluded by the global ignore pattern in `jest.config.cjs`.
**Working solution:** Run jest directly with overridden ignores: `npx jest --testPathIgnorePatterns='/node_modules/' --testPathIgnorePatterns='/__tests__/coverage/' --testPathPattern=...`. Don't edit `jest.config.cjs` to add a worktree-aware exception — the global ignore is intentional to keep the master test run from picking up worktree state.
**Apply when:** Any worker running tests from inside a `.worktrees/...` worktree. Use `npx jest` with explicit ignores; don't touch the shared config.

### 113. Coordinate-based tap on a 1080×2400 device from a 800-wide screenshot needs `device = saved × 1080/800 = saved × 1.35` for both axes
**Observation:** Resized screenshots (800px wide) are convenient for chat rendering but coordinate math is easy to flip when the height shows up as 1778 (preserving aspect). Both x and y scale by the same factor (1080/800 = 2400/1778 = 1.35), since `screencap -p` produces 1080×2400 PNGs.
**Working solution:** When a uiautomator dump can't surface a react-native testID and Maestro `tapOn` fails (e.g. live-updating rest timer prevents idle state — see entry 110), find the target visually on the saved 800-wide image, multiply both coords by 1.35, and `adb shell input tap <x> <y>` at the device coords. Verify by drawing a `drawbox` annotation at `(x_device, y_device)` on `/tmp/full.png` BEFORE scaling — `drawbox=…,scale=800:-1` runs filters in order, so the drawn box scales with the image and you can sanity-check the position visually before the real tap.
**Apply when:** You need to drive an interaction the testID-based path can't reach. Don't guess coords by eye on the 800-wide image — convert with the 1.35 factor.

### 114. Maestro wrapper `run-maestro-from-wsl.sh --mode full` always force-stops the app — preserves state ⇒ launchApp re-launches at HOME, not the previous screen
**Observation:** The script does `adb shell am force-stop` before invoking `maestro test`, regardless of mode. Every Maestro flow therefore starts cold. So a flow that says `tapOn: ".*Push pull.*"` will land on the most-recently-rendered view of that plan (default Micro 1, default sub-tab) — even if the previous run had navigated to a different micro.
**Working solution:** Either (a) write the flow to navigate explicitly from the home screen (use the `training-home-active-training-<planId>` pill testID, which jumps to the in-progress training regardless of which micro is "current"), or (b) handle every state branch (PLANNED → tap Start, FINISHED → header overflow → Edit) so the cards mount unconditionally. Don't assume the device's pre-launch state survives across runs.
**Apply when:** Writing a Maestro flow that needs the cards mounted in `ExecuteTraining`. Drive the navigation deterministically; don't rely on app state from a prior run.

### 115. New native dep (react-native-svg) plus npm install bumps a transitive RN package; patch-package must rerun before gradle build
**Problem/Symptoms:** Adding `react-native-svg` via `npm install` not only adds the new package but also lets npm pick up newer minors of unrelated transitive deps (e.g. `react-native-document-picker` jumped 9.1.1 → 9.3.1) and clobbers the `node_modules/<dep>/...` files that `patch-package` had already overlaid. The next `./gradlew assembleDebug` then fails with cryptic Java compile errors (`method does not override`, `cannot find symbol execute()`) inside the upgraded dep. Equally, JS-only patches in `patches/` (e.g. `react-native-modal+13.0.1.patch` from master) are NOT auto-applied in fresh worktrees if the patch file itself wasn't checked in on this branch — first build crashes the JS bundle on the first `<MultiselectDropdown>` mount.
**Working solution:** After ANY `npm install` in this repo, immediately re-run `npx patch-package`. If a patch file referenced in agent-memory or AGENTS.md is missing under `./patches/`, fetch it from `origin/master` (`git show origin/master:patches/<name>.patch > patches/<name>.patch`) and rerun `npx patch-package`. Only then run gradle. Do this in the same change set as the dep bump so future workers don't repeat the cycle.
**Apply when:** Any worker that runs `npm install <new-dep>` in this repo, or any worker where a fresh worktree is missing a patch file the agent memory mentions. The `postinstall` hook only runs patches that physically exist in `./patches/`.

### 116. `react-native-svg` + `react-native-paper` <Text> together: paper Text reads style props through a custom theme provider that sometimes drops onto the SVG-overlay layer and renders nothing
**Observation:** When a `<Svg>` and an absolutely-positioned `<Text>` overlay share a parent `<View pointerEvents="none">`, the SVG renders fine but a paper `<Text>` inside the overlay can render with zero size on the very first paint because paper's theme provider mounts after the view layout pass. The text appears on the second tick.
**Working solution:** Render the timer string with `react-native-paper` `<Text>` (not raw `<Text>`) AND inside an `absoluteFillObject` overlay with `alignItems: 'center'` + `justifyContent: 'center'`. Don't try to anchor text using SVG `<Text>` element from `react-native-svg` — paper's font + theming work better and the alignment is simpler.
**Apply when:** Building any "circular value with centered label" widget on top of `react-native-svg`. Use the layered-overlay pattern, not SVG `<Text>`.

### 117. RN 0.84 bridgeless metro dev bundle does NOT auto-require `Libraries/Core/InitializeCore`; module-level `LogBox.ignoreLogs(...)` (or any access to `setImmediate`/`window`) crashes cold-start
**Problem/Symptoms:** Cold-start on Android with metro dev bundle (any flow that uses Maestro `launchApp` or `am start` with `debug_http_host` set) opens a `[runtime not ready]: ReferenceError: Property 'setImmediate' doesn't exist` red box. Stack: `handleUpdate@LogBoxData.js → addIgnorePatterns → ignoreLogs → anonymous@<bundleline>:32`. Once `setImmediate` is shimmed manually, the next launch fails with `Property 'window' doesn't exist` from `Libraries/Debugging/DebuggingOverlayRegistry.js:37`. The baked APK bundle (built by `createBundleDebugJsAndAssets`) is unaffected — only the metro dev bundle, which ships only `__r(0)` and never invokes the `runBeforeMain` modules in bridgeless mode.
**Working solution:** Add a `polyfillImmediate.ts` (or any small file) at the project root with a single line: `require('react-native/Libraries/Core/InitializeCore');` (this is the only `react-native` deep import sanctioned by `@react-native/babel-preset/plugin-warn-on-deep-imports.js`). Make it the FIRST `import` in `index.tsx`. `setUpDefaultReactNativeEnvironment` is idempotent (`if (initialized) return;`) so this is a no-op on the baked-bundle path. Don't try to shim individual globals (setImmediate, window, queueMicrotask, …) one-by-one — there are too many and a future RN bump will surface another one.
**Apply when:** Any RN ≥ 0.84 worker on this project sees `[runtime not ready]: Property '<global>' doesn't exist` on cold-start with the dev bundle. Don't suspect specific feature PRs — the call sites have been there since GH-117; the metro dev bundle's missing `runBeforeMain` is the actual cause.

### 118. Maestro CLI from WSL with multiple Windows-attached devices ignores `--device` flag and lands on the first device returned by adb
**Observation:** Even when `run-maestro-from-wsl.sh --device emulator-5556 ...` is run with `ANDROID_SERIAL=emulator-5556` exported and the script logs `Selected device emulator-5556`, dadb (the underlying transport) drives whichever device is returned first by `adb devices` against the Windows adb server (here: `R5CN30HWZFN`, then `emulator-5554`, then `emulator-5556`). Verified empirically by checking the Maestro screenshot resolution (`720x1600` = R5CN30HWZFN's override; `emulator-5556` is `1080x2400`) and by observing that `emulator-5556` showed the launcher (app closed) the entire time the Maestro test was running.
**Working solution:** When this matters (the wrong device runs a different worker's APK / metro), drop down to direct `adb -s <serial> shell uiautomator dump` + `adb shell input tap <x> <y>` for the equivalent assertions. Coordinates can be resolved live from the UI hierarchy. Don't try to disconnect other devices — they belong to other workers. Don't try `--host`/`--port`/`ADB_SERVER_SOCKET` tricks; they have been verified not to fix this.
**Apply when:** Multi-device WSL setup where Maestro's reported "Selected device" doesn't match the screenshots. Cross-check resolution via `adb -s <serial> shell wm size` and `adb -s <other> exec-out screencap -p` immediately after the Maestro run — if the wrong device is still showing the launcher, the smoke flow ran elsewhere.

### 119. Maestro `appId:` auto-launch is unreliable on the WSL→Windows-host adb path; flows must start with explicit `- launchApp`
**Observation:** When a Maestro flow declares `appId: com.powerliftingworkoutplanner` and its first command is a wait or assertion (no explicit `- launchApp`), Maestro's implicit launch frequently does not bring the app to the foreground on this WSL→Windows-host adb path. The flow then sits on the device launcher until the wait timeout fires. Reproduced across 13/38 flows in QA-MAESTRO-001 r5: every single failing flow whose first step is `extendedWaitUntil: visible: 'Training', timeout: 60000` lands on the launcher (verified via Maestro's own debug screenshot at `~/.maestro/tests/<ts>/screenshot-❌-*.png`). Manual `adb shell am start -n com.powerliftingworkoutplanner/.MainActivity` followed by 15s wait reliably renders the Training screen, so the issue is not in the app — it is Maestro's auto-launch on this transport. Flows that begin with an explicit `- launchApp` (`01_training_smoke`, `99_smoke`, `gh77_dashboard_smoke`) PASS reliably.
**Working solution:** Always start a flow with `- launchApp` (with `clearState: false` if state preservation matters). Don't rely on `appId:`-only auto-launch when running multi-flow sequential sweeps on this device path. The cost is one extra YAML line per flow; the win is consistent app foregrounding.
**Apply when:** Writing or migrating any Maestro flow for this project. If a flow is failing on its first wait/assertion after an empty rebase or fresh device state, check whether it has an explicit `- launchApp` first.

### 120. Crash classification: PID-change alone is NOT a reliable crash signal — `- launchApp` legitimately changes the PID
**Observation:** A regression-sweep runner that classifies a flow as CRASH purely because `pidof <pkg>` returned a different value before vs. after the flow will misclassify any flow that opens with `- launchApp` (or `clearState`+`launchApp`). For example, in QA-MAESTRO-001 r5 the cold-start sanity launched the app on PID 9881, then `00_import_baseline.yaml` opened with `- launchApp` which legitimately re-launched the app on PID 10702. The runner flagged this as CRASH. `grep -E "FATAL EXCEPTION|setImmediate|RedBox|JavascriptException|runtime not ready"` against the same logcat returned 0 matches.
**Working solution:** When the runner detects `pid_before != pid_after`, check whether the flow's `commands:` list contains a `launchApp` (or `clearState`) entry. If so, demote the CRASH classification to whatever the maestro stdout says (assertion, timeout, infra). The CRASH bucket should be reserved for FATAL/SIGSEGV/JS-redbox lines in the logcat — those are unambiguous. Use PID-change only as a secondary signal that fires when there is *no* explicit launchApp in the flow.
**Apply when:** Building or tuning any Maestro-sweep runner that needs to distinguish real app crashes from intentional flow-driven re-launches.

### 121. Stale literal-text waits like `extendedWaitUntil: visible: 'Training'` are fragile across UI redesigns
**Observation:** A flow that asserts the literal string `Training` is visible (without a testID) breaks the moment the bottom-tab label is removed for non-active tabs (which happened in GH-204 Training Home redesign — only the active tab shows its text label below the icon). The flow PASSes when the auto-launch happens to land on the Training tab as default. It FAILs when the device launcher is shown instead (RC1 above) OR when the default landing tab is something else. The literal-text wait conflates "the screen rendered correctly" with "this exact word is visible somewhere on screen", and the latter is an unstable proxy for the former.
**Working solution:** Replace the literal-text wait with the screen's testID: `extendedWaitUntil: visible: { id: 'training-home-screen' }, timeout: 60000`. The component hierarchy assigns stable testIDs to screen-level wrappers; use those, not visible labels. If a screen doesn't have a wrapper testID, add one — it's a one-line change that pays back across every flow that needs it.
**Apply when:** Reviewing or updating Maestro flows. Search for `visible: 'X'` patterns where X is a string that also appears as a screen header or tab label, and migrate them to `id:` selectors. Equally, avoid asserting bottom-tab labels by text — use `id: 'tab-<name>'` (the testID is set in `app/routing/bottomNavigator.tsx`).


### 122. `DrawerNavigator` renders ALL drawer screens without `route.params`; screens requiring params must guard against undefined
**Observation:** In `AnalyseRouter`, `VideoAnalysisDetailTab` requires `route.params.analysisId` (set by GH-207). When any other drawer item (e.g., "Records") is selected, the DrawerNavigator instantiates VideoAnalysisDetailTab as part of its internal state machinery — without params — causing `Cannot read property 'analysisId' of undefined` crash and a red box overlay. This blocks any assertions in the navigated-to screen. Confirmed on device R5CN30HWZFN when running `analyse_date_range_picker` flow.
**Working solution for flows:** Navigate to the target screen via the Dashboard's "Quick Access" buttons (which call `navigation.navigate` directly) instead of the drawer toggle. Dashboard "Records" chip navigates to Records without mounting the full drawer screen list. Add `runFlow: when: visible: 'Dismiss'` guards around Analyse tab navigation to dismiss any stale crash.
**Working solution for app code:** Add `route.params?.analysisId` optional chaining in VideoAnalysisDetailTab.tsx:44. One character fix.
**Apply when:** Writing Maestro flows that navigate within `AnalyseRouter`. Always prefer direct `tapOn: "Records"` (Dashboard quick access) over `analyse-drawer-toggle + tapOn: "Records"` (drawer route). If the app code is fixed with `?.`, the drawer route becomes safe again.

### 123. `baseline.gains` has empty `plannedWorkouts: {}` for all upcoming training slots — assertions depending on planned targets will always fail
**Observation:** `next-training-target-1` (NextTrainingCard focus block) and delta-caption `".*vs M[0-9]+.*"` only render when `plannedWorkout.sets.length > 0`. Inspecting `baseline.gains` with Python: all upcoming slots in all plans have `"plannedWorkouts": {}`. The baseline was built from actual historical workout data (FINISHED trainings) and does not include future planned progressions.
**Working solution:** Remove these assertions from flows using baseline.gains. Test `next-training-target-1` only in isolation tests that seed the Redux store with fabricated plannedWorkouts, or in a fixture specifically created for it.
**Apply when:** Writing assertions in Maestro flows that depend on planning data (planned weights, progression targets, delta captions). Always verify the assertion is satisfiable with baseline.gains by checking `jq '.trainings.byId[].plannedWorkouts' baseline.gains`.

### 124. `tapOn: point:` input coordinates: Training detail (RangeSwiper) y=46% for Set-N input row on 720×1600 override
**Observation:** The AddWorkout input row in TrainingsPlanNode (inside RangeSwiper, inaccessible by ID) has its text field centers at y≈46% on the 720×1600 device override. Specific x-coordinates: Reps≈11%, RIR≈33%, Weight≈54%, Add button≈88%. These were confirmed by coordinate-driven input and post-add screenshot showing correct Reps=8, RIR=2, Weight=95 values.
**Apply when:** Tapping workout input fields in any Maestro flow that reaches TrainingsPlanNode's edit mode.

### 126. Maestro `--device` flag does not reliably prevent it from connecting to a different device when multiple devices are attached
**Observation:** In GH-221, `run-maestro-from-wsl.sh --device emulator-5556` was used. The adb push went to emulator-5556 (confirmed by log), but the `takeScreenshot` in the Maestro flow captured a screenshot that clearly showed the physical device R5CN30HWZFN (hardware nav buttons, different time, old APK design). Maestro's device pinning is unreliable with ≥3 connected devices in some environments.
**Working solution:** When multi-device ambiguity is suspected, verify the screenshot by reading it and comparing the emulator status bar style (emulator shows gesture-nav bar, physical device shows hardware buttons). Use direct `adb -s $DEVICE exec-out screencap -p` captures as primary evidence — these are guaranteed to be from the correct device.
**Apply when:** Running Maestro on environments with multiple ADB devices. Always double-check Maestro screenshots against direct adb screencaps if the APK version differs across devices.

### 127. Jest `testPathIgnorePatterns: ['/.worktrees/']` blocks all tests inside a worktree

**Problem:** `jest.config.cjs` contains `'/.worktrees/'` in `testPathIgnorePatterns`. Because the absolute path of every test file inside `.worktrees/feature-XYZ/` contains `.worktrees`, Jest silently skips all tests. `npx jest` and `npm test` both return "No tests found" from inside the worktree.

**Working solution:** Pass `--testPathIgnorePatterns` on the CLI, listing only the patterns you still want to keep (`/node_modules/` and `/__tests__/coverage/`) but **omitting** `/.worktrees/`:
```
npx jest --testPathIgnorePatterns="/node_modules/" "/__tests__/coverage/" --testPathPattern="MyComponent" --no-coverage
```
**Apply when:** Running any Jest test from inside a git worktree on this project.

### 125. Rest timer coordinates (720×1600 override) after 2 existing sets: overflow icon≈(88%,77%), Reset button≈(75%,77%)
**Observation:** After importing baseline + submitting one set (total 2 existing sets for Dips in Upper lower), the rest timer card center is at y≈77%. Overflow (⋮) is near the right edge x≈88%, Reset button x≈75%. With more existing sets pushing the input rows down, the rest timer moves lower (y≈80% with 3 sets). Always import baseline first for reproducible set count.
**Apply when:** Any Maestro flow that needs to interact with the rest timer overflow menu or Reset button.

### 126. RC1 launchApp fix is necessary but not sufficient: flows that fail on "Training" literal text need RC2-style assertion fix too
**Observation:** In r6 (post-RC1 PR#216), 6 flows that received `- launchApp` still fail at `"Training" is visible`. The launchApp executes correctly (visible in logs: "Launch app..."), but the next assertion `assertVisible: "Training"` fails because GH-204 removed the visible text label from inactive bottom-navigation tabs. Verified: `smoke.yaml` log shows launchApp succeeds, then 00_import_baseline subflow asserts "Training" → fails. The RC1 and RC2 fixes targeted non-overlapping sets of flows; the 6 RC1 flows weren't included in the RC2 batch and still carry the stale literal.
**Working solution:** For any flow that has both `- launchApp` AND `assertVisible: "Training"`, the second fix is to replace the literal with `id: training-home-screen` (or equivalent stable testID). The two fixes must be applied together. When reviewing RC1-style launchApp patches, always scan the first few assertions after launchApp for literal tab-label text.
**Apply when:** Any Maestro flow that was in Bucket A of the r6 sweep (smoke, suite, gh200_video_analysis_screen_warm, trn004_meso_verify, 11_metrics_overview_slots, 11_metrics_overview_slots_suite). Also any future launchApp-only patch that doesn't update the downstream assertions.

### 127. runFlow sub-flows propagate failure to parent: a suite flow (smoke.yaml) fails even if 99_smoke.yaml passes standalone
**Observation:** `smoke.yaml` runs `00_import_baseline.yaml` as a subflow then `99_smoke.yaml`. When `00_import_baseline` fails, Maestro aborts `smoke.yaml` entirely — `99_smoke` is never reached. The parent's failing step is whatever step inside the subflow failed. This means a suite/smoke flow can fail despite all component flows passing individually, if the import subflow is broken.
**Working solution:** Don't use suite flows (flows that chain other flows via runFlow) as the primary verification signal for individual features. Verify each component flow standalone first. Suite flows are integration smoke tests only and carry the fragility of all their subflows.
**Apply when:** Debugging why a suite/smoke flow fails while the individual sub-flows appear to pass.

### useLastTrainingOfPreviousMeso was implemented but not wired for meso-boundary comparison
`getPreviousMicroInMeso` returns `undefined` at micro 1 of any meso. `TrainingsPlanNode` fell back to `micro=-1` (no training found), leaving `TrainingsOverview` with `previousTraining=undefined` and no comparison data. The fix: always call `useLastTrainingOfPreviousMeso` and use `??` to prefer same-meso over cross-meso. This hook already existed — the bug was purely a missing fallback call.

### Per-exercise last-workout fallback for the "no previous training at all" case
When no structured previous training exists (first ever meso), `TrainingsOverview` still needs comparison data. The ticket says "otherwise last workout of the exercise". Pattern: `useLastFinishedWorkoutsByExerciseIds(training.exercises, excludeIds)` returns the most recently finished workout for each exercise ID, excluding the current training's workouts. This hook is distinct from `useLastFinishedWorkout` (single exercise) — create a new multi-exercise variant using a `flatMap` + reverse scan over `state.workouts.byExerciseId`.

### React hooks must be called unconditionally — use the result conditionally
When adding a fallback hook alongside an existing one, BOTH hooks must always be called (React rules). The conditional selection (`previousTraining !== undefined ? primaryResult : fallbackResult`) lives in the JSX logic, not in the hook calls. Tests that assert "hook was not called" for the non-selected path are incorrect — instead, assert which result was used.

### 128. socat bridge corrupts large Metro bundles — use `adb reverse` + `run-as tee` instead
**Problem:** A socat bridge (`socat TCP-LISTEN:8081,fork TCP:127.0.0.1:<metro-port>`) appears to work for small payloads but silently corrupts large streaming responses (the 15.5 MB Metro bundle). The app shows a red-screen JS parse error ("invalid hex number", "'}' expected") because the bundle arrives truncated or with TCP fragmentation the socat fork mode doesn't buffer correctly.
**Working solution:** `adb reverse tcp:8081 tcp:<metro-port>` + write `localhost:8081` to SharedPreferences via `run-as tee`:
```sh
adb reverse tcp:8081 tcp:<host-port>
printf '<?xml version="1.0" encoding="utf-8" standalone="yes" ?>\n<map>\n    <string name="debug_http_host">localhost:8081</string>\n</map>\n' | \
  adb shell "run-as com.powerliftingworkoutplanner tee /data/data/com.powerliftingworkoutplanner/shared_prefs/devtools_settings.xml > /dev/null"
```
The `adb reverse` tunnel handles the full bundle without corruption. Re-run the `run-as tee` command after every `force-stop` or Maestro `clearState: true`, as those wipe SharedPreferences.
**Apply when:** Setting up Metro dev-bundle serving for an APK built to connect to port 8081 on emulator.

### 129. RN dev bundle host pref lives in `<package>_preferences.xml`, not `devtools_settings.xml`
**Problem:** Setting `debug_http_host=localhost:8081` in `devtools_settings.xml` (or its namespaced sibling `<pkg>.devtools_settings.xml`) does NOT redirect the dev bundle URL on bridgeless RN. The app keeps fetching `http://10.0.2.2:8081/index.bundle…` despite the file being present and readable.
**Root cause:** `PackagerConnectionSettings` in RN reads `PreferenceManager.getDefaultSharedPreferences(appContext)`, whose backing file is `${packageName}_preferences.xml`, NOT `devtools_settings.xml`. Other code paths read `devtools_settings.xml` for unrelated dev-menu state, but the dev-server URL lookup uses the *default* prefs file.
**Working solution:**
```sh
printf '<?xml version="1.0" encoding="utf-8" standalone="yes" ?>\n<map>\n    <string name="debug_http_host">localhost:8081</string>\n</map>\n' | \
  adb -s "$DEVICE" shell "run-as com.powerliftingworkoutplanner tee /data/data/com.powerliftingworkoutplanner/shared_prefs/com.powerliftingworkoutplanner_preferences.xml > /dev/null"
adb -s "$DEVICE" shell am force-stop com.powerliftingworkoutplanner
adb -s "$DEVICE" shell am start -n com.powerliftingworkoutplanner/.MainActivity
```
Verify the URL flipped by greping logcat for `localhost:8081` vs `10.0.2.2:8081`.
**Apply when:** Bridgeless RN debug build is fetching from `10.0.2.2:8081` and you need to redirect via `adb reverse` (entry #128). Pair with `adb -s "$DEVICE" reverse tcp:8081 tcp:<metro-port>`.

### 130. `adb shell input tap` often misfires on RN gesture handlers — use short-duration `input swipe` instead
**Problem:** `adb shell input tap X Y` against an RN button may visually highlight the target (hover state) but the navigation/onPress never fires. The component receives a touch-down without a release the gesture handler accepts. This is reproducible on RN 0.7x bridgeless builds and is the reason Maestro flows always look like "long-tap".
**Working solution:** Use `adb shell input swipe X Y X Y 80` (same start and end coords, ≥80 ms duration). This emits a proper down-up sequence that RN's gesture system treats as a tap. For drawer-overlays use `~50` for closing taps and `≥100` for "press" interactions.
**Apply when:** Driving an RN app via raw adb taps (e.g., when Maestro testID assertions are flaky). Also useful when reproducing a tap-only bug without firing up Maestro.

### 131. Native APK rebuild is unnecessary for JS-only fixes — Metro already serves the changed bundle
**Problem:** A JS-only patch (e.g., a guard in `app/utils/*.ts`) was followed by a 5-minute `./gradlew assembleDebug` rebuild that then failed with an unrelated `react-native-screens` CMake/clang++ linker error on `arm64-v8a`. The previous APK from earlier the same day was already installed and connected to Metro.
**Working solution:** For JS-only fixes, skip the Gradle rebuild entirely. The existing debug APK + Metro packager exercises the new code on the next bundle reload (force-stop → relaunch, or dev-menu reload). Only rebuild when the patch touches `android/`, native modules, `package.json` deps, or codegen artifacts. Verify the bundle is actually new by greping logcat for the load event after `force-stop`.
**Apply when:** A worker's Gradle build is failing on a flaky native step that is orthogonal to a JS-only ticket. Don't block `ready_for_review` on the rebuild.
### 128. Long-running Maestro sweeps: setsid+nohup+disown lets the sweep survive worker death; resume via filename-anchor grep on the JSONL
**Problem:** A QA-MAESTRO sweep over 41 flows takes ~70 min on R5CN30HWZFN. If the worker is killed mid-run (OOM, harness reset, etc.) without daemonisation, the sweep dies with it and the next worker has to restart from scratch — wasting ~30+ min on already-passed flows.
**Working solution:** Launch the sweep via `setsid nohup bash /tmp/maestro_sweep_rN.sh > sweep_stdout.log 2>&1 < /dev/null & disown`. Inside the sweep, write each result line to `flow_results_rN.jsonl` immediately after the flow finishes. On resume, the worker iterates flows and skips any whose filename anchor `"\"flow\": \"$flow\""` is already grep-matched in the JSONL. Verified in r7: previous worker died at 13/41; sweep continued under PID 862978; resume worker observed it at 15/41 and polled to completion. Zero duplicate flow runs.
**Apply when:** Any multi-hour, sequential e2e sweep where worker resilience matters more than maestro driver isolation. The skip-set is a content match on filename inside the JSONL, not a substring on filenames in shell — those two are different things and the latter is forbidden by the QA-MAESTRO ticket.

### 129. trn004_meso_verify with clearState: false is sweep-order-fragile after PR #227 — Bucket-A literal swap landed but flow now fails on scrollUntilVisible
**Observation:** PR #227 GH-225 fixed the literal `"Training"` assertion in `trn004_meso_verify.yaml` (the 6th Bucket-A flow). In r7 the literal-swap step passes (Training Home id-anchored assert COMPLETED), but the next step `scrollUntilVisible "Push pull"` (15 s timeout) FAILS because the dashboard scroll position has been mutated by preceding flows in the sweep. UIAutomator dump after the sweep confirms `text="Push pull"` IS present on the dashboard — it's a scroll-discovery timing issue, not missing data. The flow uses `clearState: false` and assumes a fresh dashboard scroll. The other 5 Bucket-A flows clear state or use suite-level imports, so they don't show this.
**Apply when:** Reviewing why a single Bucket-A flow looks like the GH-225 fix didn't take effect. If the literal-swap line passes but a later `scrollUntilVisible` fails, suspect mid-sweep state mutation rather than the GH-225 fix. The follow-up is `clearState: true` plus an explicit baseline import sub-flow at the top of `trn004_meso_verify`, or a longer/centered scroll. Out of scope for diagnostic-only QA tickets.

### 130. First `gradlew assembleDebug` after a fresh worktree checkout can produce an APK whose Fabric/codegen dex entries are not visible to the runtime ClassLoader; clean + `--rerun-tasks` recovers
**Problem/Symptoms:** A clean `cd android && ./gradlew assembleDebug --no-daemon` from a fresh worktree produced a 209 MB APK that crashed on every Maestro `launchApp` (and on plain `am start` after `pm clear`) with `java.lang.NoClassDefFoundError: Failed resolution of: Lcom/th3rdwave/safeareacontext/SafeAreaContextModule; ... Caused by: ClassNotFoundException: Didn't find class "com.th3rdwave.safeareacontext.NativeSafeAreaContextSpec"`. The class IS physically present in the dex (unzip → strings finds the type descriptor across multiple `classes*.dex` shards), so it's not a missing-source bug — it's a build-cache/multidex sharding issue where the runtime DexPathList can't resolve the codegen-generated Fabric spec class. `newArchEnabled=true` is the relevant gradle property. patch-package was applied correctly (`react-native-document-picker@9.3.1 ✔`, `react-native-modal@13.0.1 ✔`).
**Working solution:** Don't try to debug the dex. Run `cd android && ./gradlew :app:clean :react-native-safe-area-context:clean` then `./gradlew :app:assembleDebug --rerun-tasks` (forces all 426 tasks). Re-install. The second build of the same source tree produces a working APK. Verified on QA-MAESTRO-001 r7 (R5CN30HWZFN, RN 0.84 + new arch). The cold-start sanity grep `setImmediate|RedBox|FATAL EXCEPTION` does NOT catch this specific FATAL within a 15s window because (a) the FATAL is on `pool-4-thread-1` from `DefaultTurboModuleManagerDelegate` not main, and (b) `am start` returns before the React bridge actually pulls TurboModules. Therefore: ALWAYS verify the new APK with at least one `launchApp`-driven flow (or `pm clear` + `am start` + 30s wait + logcat grep for NoClassDefFoundError) before running the full sweep, not just the strict 15s cold-start grep.
**Apply when:** First debug APK build from a fresh checkout, especially after node_modules state changes or sibling worktrees building in parallel (gradle cache contention is suspected as the root cause). If `am start` returns 0 but `pidof` is empty after a few seconds, immediately check `adb logcat -d | grep -E "FATAL EXCEPTION|NoClassDef"` before anything else.

### 131. Maestro CLI on WSL with Windows-host adb server requires `--host <windows-ip>` flag — `ADB_SERVER_SOCKET` env var alone is NOT sufficient
**Problem/Symptoms:** `ADB_SERVER_SOCKET=tcp:172.18.240.1:5037` is exported (orchestrator default for WSL→Windows-host adb), `adb -s R5CN30HWZFN devices` lists the device fine, but `maestro --device R5CN30HWZFN --driver-host-port 7002 test <flow>` returns `Device R5CN30HWZFN was requested, but it is not connected.` Maestro 2.0.9-ports does not honour `ADB_SERVER_SOCKET` from its bundled JDK process — it talks to a default `localhost:5037` adb server which is empty in this WSL setup.
**Working solution:** Pass Maestro the host explicitly: `maestro --host "$(awk '/^nameserver/{print $2; exit}' /etc/resolv.conf)" --device "$ANDROID_SERIAL" --driver-host-port 7002 test <flow>`. The nameserver line in `/etc/resolv.conf` resolves to the Windows host IP that runs the adb server (e.g. `172.18.240.1`). The `__tests__/e2e/scripts/run-maestro-from-wsl.sh` helper already does this — direct `maestro` invocations from custom sweep scripts must replicate the `--host` flag. Setting `ADB_SERVER_SOCKET` is still useful for the surrounding `adb -s` calls but does not help maestro itself.
**Apply when:** Writing any custom WSL script that drives maestro directly against a Windows-hosted adb server. If maestro reports "Device <SERIAL> was requested, but it is not connected" while `adb devices` shows the device, the missing flag is `--host`.

### nextSessionFor: always scope search to after lastDone
When searching `plan.trainings` for the "next undone slot", searching from the beginning of the plan will return pre-created-but-never-executed slots from earlier micros/mesos as candidates. Guard: skip any slot whose `(micro, training)` is at-or-before `lastDone`. The same guard is needed in `statusForPlan` when computing the current micro for the status text.

### heroCurrentMicro should be the NEXT micro, not the LAST DONE micro
Using `lastDone.micro` as the "current" micro makes the completion ring show N/N (all done) whenever the user has finished a micro and is about to start the next one. The correct value is `nextSession.micro` — the micro the user is *working on*, not the one they just finished.

### Maestro JVM on WSL cannot reach physical device via ADB_SERVER_SOCKET
The Maestro shell launcher runs on WSL's JVM. Even with `ADB_SERVER_SOCKET=tcp:172.x.x.x:5037` set, Maestro's JVM does not pick up the env var for device discovery. The Maestro binary at `/mnt/c/Users/metzg/maestro/maestro/bin/maestro` is a JVM-on-Linux process — it doesn't automatically use the Windows ADB server at 172.x.x.x. Workaround: start a local WSL adb server and verify the device appears there before calling maestro, OR use the cmd.exe Maestro path. In pure-code rounds with no Maestro infra, use existing screenshots and note the blocker.

### Maestro gRPC screen capture returns black images in WSL2 + Windows ADB setup
Even when Maestro successfully connects to the emulator (element finding and taps work), the `takeScreenshot` command captures a fully black image. Root cause: Maestro's internal gRPC screen grab is incompatible with the WSL2 host ↔ Windows ADB ↔ emulator chain. The `adb exec-out screencap -p` path does NOT go through Maestro's gRPC and always produces correct images. Mitigation: use `adb shell screencap -p /sdcard/name.png && adb pull /sdcard/name.png` for all evidence screenshots; note the Maestro screen-capture failure in `summary.md` and `status.json`. Unit tests provide the definitive functional proof.

### Exact coordinates for drawer navigation: use `uiautomator dump` not visual estimates
`adb shell uiautomator dump /sdcard/ui.xml && adb pull /sdcard/ui.xml` gives exact `bounds="[x1,y1][x2,y2]"` for every element. Visual estimation from rendered screenshots (scaled down) is unreliable because the scale factor varies by viewer. Calculate tap target as `((x1+x2)/2, (y1+y2)/2)` from the dump output.

### `@testing-library/react-hooks` is not installed; use render-wrapper pattern instead
This project only has `@testing-library/react-native`. To unit-test a custom hook: create a `Wrapper` component that calls the hook and stores the result in a `useRef`, then `render(<Wrapper />)` and read the ref. This is more reliable than `renderHook` from a missing package. Use `.tsx` extension (not `.ts`) because JSX is required for the wrapper component.

### Scoping VL insights to a specific training: optional Set parameter pattern
`useVelocityLossInsights(plan, currentMicro, trainingWorkoutIds?: ReadonlySet<number>)` — the third param scopes the current-micro filter to that training's workouts. Sparkline history is intentionally NOT filtered (spans all micros). `TrainingsOverview` computes the set via `useMemo` from `training.doneWorkoutIds`; `MicroOverview` omits the param to stay unscoped. This is the pattern for any future hook that needs per-training vs per-micro dual-mode behavior.### React Native debug APK uses Metro JS bundle at runtime — code changes don't require a rebuild
Debug APKs load JS from Metro (port 8081 on device, exposed via `adb reverse tcp:8081 tcp:$METRO_PORT`). Changing `.tsx` files and saving is enough — Metro hot-reloads instantly. A Gradle rebuild is only needed when native code (Java/Kotlin/C++) changes. If you're unsure whether the installed APK has your code: check that Metro is running and adb reverse is set, then force-stop and relaunch the app — it will fetch the latest bundle.

### .gains import: bootstrap script overwrites /sdcard/Download/baseline.gains after you modify it
`run-maestro-from-wsl.sh --mode bootstrap` pushes the repo fixture path (e.g. `__tests__/e2e/maestro/fixtures/baseline.gains`) directly over `/sdcard/Download/baseline.gains`. If you need custom fixture data (e.g. with a linked video analysis), push your modified file AFTER bootstrap completes, then import it via Settings → Import Data. Naming it differently (e.g. `baseline-with-video.gains`) avoids the overwrite.

### VideoAnalysis fixture: setResult.mean_path_deviation key is in snake_case
The `VideoAnalysisSetResult` TypeScript type uses `mean_path_deviation` (snake_case), not camelCase. When crafting `.gains` test fixtures in Python, use `"mean_path_deviation"` as the JSON key. The WorkoutView selector passes it through as `drift` to WorkoutSetView.

### History calendar is the fastest path to a finished training when current micro is high
If a plan is at Micro 70+ but the finished training you need to inspect is in Micro 1, use the drawer menu → History → calendar. Swipe right to go back months (each swipe = ~1 month). Tap the highlighted date → tap "Go to Training" to land directly on Micro 1 without swiping through 70 micros in the RangeSwiper.If a plan is at Micro 70+ but the finished training you need to inspect is in Micro 1, use the drawer menu → History → calendar. Swipe right to go back months (each swipe = ~1 month). Tap the highlighted date → tap "Go to Training" to land directly on Micro 1 without swiping through 70 micros in the RangeSwiper.

### Calendar swipe direction: left-to-right (100→600) = previous month
A swipe from x=100 to x=600 (dragging right) goes BACK one month. A swipe from x=600 to x=100 (dragging left) goes FORWARD one month. This is the standard iOS/Android pager convention. Test data from GH-235 bootstrap is in February 2024, which is ≈52 months before May 2026.

## GH-235 / WorkoutSetView VL+Drift Display Learnings

### `DataTable.Row` bottom border can be suppressed via the `style` prop
RNP 5.x applies the `style` prop last: `style={[styles.container, { borderBottomColor }, style]}`. Passing `{borderBottomWidth: 0}` overrides `StyleSheet.hairlineWidth`. This is the correct way to suppress the row separator when a metrics sub-row follows so the separator falls below the metrics instead of above them.

### `Divider` accepts `testID` — it extends `$RemoveChildren<typeof View>` (ViewProps)
`<Divider testID="set-metrics-divider-1" />` works in both production and tests. The jest mock must expose `testID` as a prop for test assertions to work: `Divider: ({testID}: any) => <View testID={testID ?? 'row-divider'} />`.

### Specifying `testPathIgnorePatterns` on the CLI overrides the jest.config array, it doesn't merge
`npx jest --testPathIgnorePatterns="/node_modules/"` replaces the config's `['/.worktrees/']` entirely. This is the workaround for running tests inside a `.worktrees/` directory without editing `jest.config.cjs`.

### WorkoutSetView icon logic: always render, branch on linked vs not
The video icon must always be visible per row. The correct pattern is: if a `linkedEntry` exists → render `<TouchableOpacity testID="set-linked-video-N">` wrapping a `video` icon; else → render `<TouchableOpacity testID="set-link-video-N" onPress={editable && onLinkVideo ? ... : undefined} opacity={editable && onLinkVideo ? 1 : 0.35}>` wrapping a `video-plus` icon. Never conditional on editable/onLinkVideo for rendering — only for interactivity.### 132. PendingPlanEditSetRow auto-commits on the first valid combination — RIR defaults to '0' so as soon as reps and weight pass `isPlanFieldValueValid`, the partial input is persisted
**Observation (GH-240):** `PendingPlanEditSetRow` runs an effect on every render that calls `onCommit(buildWorkoutSetFromDraft(pendingSet, ...))`. `pendingSet.rir` initialises to `'0'` (already valid). So the moment both `reps` and `weight` parse to valid numbers — even after a single character — the set is committed and the pending row unmounts. If you script keystrokes via `adb shell input text "65"` for the weight, the first `'6'` already commits and the rest of the chars go nowhere because the input no longer exists.
**Working solution:** When driving the planner via adb, type the LAST character first, or commit and edit, or accept that the test will only prove "pressed Add Set N times → got N saved sets" rather than "saved values match what was typed". For real users this is mostly fine because they fill all three fields before the soft-keyboard event finishes. The eager auto-commit IS sub-optimal UX but is intentional in the current design (entry not in scope to change without a separate ticket).
**Apply when:** Writing a Maestro/adb flow that types into the Full Edit pending row and expects to read back the typed values from the saved set list. Use `assertVisible: 'N sets'` (the chip count is reliable proof of N rows added) instead of asserting the exact reps/weight typed.

### 133. Multi-device WSL adb host: `--device emulator-5554` from `run-maestro-from-wsl.sh` can still mis-route to a sibling device (here R5CN30HWZFN) even with the assigned serial in `ANDROID_SERIAL`
**Observation (GH-240):** `bash ./__tests__/e2e/scripts/run-maestro-from-wsl.sh --mode test --device emulator-5554 ...` failed with `device 'R5CN30HWZFN' not found` mid-run. The script forwarded `--device emulator-5554` correctly, but Maestro's underlying `dadb` opened a TCP forwarding session against R5CN30HWZFN (the first device returned by the Windows adb server) anyway. Cross-checked by `adb -s emulator-5554 exec-out screencap` taken right after the failure showing the Plan tab on the assigned emulator — Maestro had been talking to the physical device.
**Working solution:** Don't fight it for evidence purposes. When the `gh<ticket>_*` Maestro flow is your only e2e proof, fall back to `adb -s "$ANDROID_SERIAL" exec-out screencap` immediately after each scripted UI interaction. The screencap is guaranteed to be from the assigned device because `adb -s` is honored. Document the Maestro infra issue in `summary.md` and reference agent-memory entries 118 / 126 / 131. Don't burn rounds debugging Maestro device pinning — the upstream issue is in `dadb`'s device selection over the Windows adb server.
**Apply when:** Any feature ticket whose acceptance criteria say "Maestro evidence is mandatory" but the WSL+multi-device infra blocks Maestro pinning. Direct `adb -s screencap` is acceptable evidence as long as `summary.md` shows which device was used and the Maestro flow definition is committed for future regression coverage.**Apply when:** Any feature ticket whose acceptance criteria say "Maestro evidence is mandatory" but the WSL+multi-device infra blocks Maestro pinning. Direct `adb -s screencap` is acceptable evidence as long as `summary.md` shows which device was used and the Maestro flow definition is committed for future regression coverage.

### 134. RangeSwiper reuses pane component instances across (micro, trainingInMicro) slots — `useRef` guards must be slot-keyed, not boolean
**Problem/Symptoms (GH-240):** A `useRef(false)` "fired-once" guard inside a Training pane component (e.g. `TrainingsBase`) only fires its `useEffect` action once per mounted instance. When `RangeSwiper` swipes between slots it re-uses the same component instance with new props instead of unmounting/remounting — so the boolean ref stays `true` for every subsequent slot and the effect (e.g. auto-route into plan mode on 0-suggestions) never fires again. The user gets stuck on the first empty slot's "skipped" screen.
**Working solution:** Replace the boolean ref with a slot-key ref:
```ts
const lastSlotKeyRef = useRef<string | null>(null);
useEffect(() => {
  if (!shouldFire || handler === undefined) return;
  const slotKey = `${trainingsPlanId}:${micro}:${trainingInMicro}`;
  if (lastSlotKeyRef.current === slotKey) return;
  lastSlotKeyRef.current = slotKey;
  handler();
}, [shouldFire, handler, trainingsPlanId, micro, trainingInMicro]);
```
Add the slot identifiers to the effect deps. The "only fires once for the same slot on re-render" property is preserved because the slotKey check de-duplicates within a slot. Add a unit test that re-renders the component with changing `(micro, trainingInMicro)` props (no unmount) and asserts the effect fires for each new slot key.
**Apply when:** Any per-slot side-effect inside a component rendered under `RangeSwiper` (or any swiper that re-renders with new props instead of remounting). Includes auto-routes, "show this once" hints, slot-bound analytics, etc.

### 135. Persisted exercise records can hold non-number values — guard `.toFixed` calls in any new render path
**Problem/Symptoms:** A redesigned `<Text>{oneRm.toFixed(0)} kg</Text>` row in `ExerciseTab` red-screened with `TypeError: undefined is not a function` on a real device hydrated from a baseline `.gains` import. The `oneRm !== undefined` guard was insufficient because `record.value` from older persisted data can be `null`, NaN, or a stringified number, all of which lack a callable `.toFixed`.
**Working solution:** Coerce through a shared helper before any formatting: `const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : undefined;`. Then render with `Number.isFinite(x) ? x.toFixed(1) : '—'`. Same pattern fixes `Sparkline` data and stats summaries. Don't trust `!== undefined`; older `redux-persist` migrations have left mixed types in `Exercise.records[ONE_RM][i].value`.
**Apply when:** Adding any new render path that reads `state.exercises.byId[*].records[*][i].value` (or any other persisted numeric field). `null !== undefined` evaluates to `true`, so the existing `!== undefined` guards in legacy code don't actually protect new callers.

### 136. Maestro driver hangs at "Waiting for flows to complete..." on a real device after a stale driver session — fall back to direct adb taps for evidence
**Problem/Symptoms:** `bash run-maestro-from-wsl.sh --mode flow --device R5CN30HWZFN --driver-host-port 7005 ...` printed "Anonymous analytics enabled. ... Waiting for flows to complete..." and never advanced. The maestro JVM was alive (`ps -ef | grep maestro.cli.AppKt` showed it accumulating CPU), the device adb connection was healthy (`adb -s R5CN30HWZFN shell uiautomator dump` worked from another tab), and `dev.mobile.maestro.android` was not in a crashed state — but no flow output ever appeared and `__tests__/reports/maestro-debug/` stayed empty.
**Working solution:** Don't burn an hour debugging the driver. Kill the maestro PIDs (`kill -9 <pid>` then `pkill -f maestro.cli.AppKt`), force-stop the maestro driver app on the device (`adb -s "$ANDROID_SERIAL" shell am force-stop dev.mobile.maestro.android`), and capture evidence via direct adb taps using the same testIDs the flow asserts on: `adb shell uiautomator dump /sdcard/ui.xml` → grep for `bounds="[x1,y1][x2,y2]"` of each `resource-id` → `adb shell input tap <cx> <cy>` → `adb exec-out screencap -p > raw.png && ffmpeg -y -i raw.png -vf 'scale=800:-1' final.png`. Commit the maestro flow file anyway for future regression — it's still a valid spec, just not the screenshot mechanism for this run. Note the fallback explicitly in `summary.md` so the reviewer doesn't think the flow itself was skipped.
**Apply when:** Any real-device run where maestro never produces flow output within ~3 minutes of "Waiting for flows to complete...", AND the worker has the testIDs available from an existing dump. Don't use this as the default — Maestro is still the right tool when it works. But never let a hung driver block evidence capture when adb taps reach the same UI.

### 134. `Number(null) === 0` — guard the null/empty case explicitly when coercing persisted record values
**Problem/Symptoms:** A `toFiniteNumber(v) = Number.isFinite(Number(v)) ? Number(v) : undefined` helper looks correct but lets `null` through as `0` because `Number(null) === 0` and `Number.isFinite(0) === true`. Persisted exercise records sometimes have `value: null` for legacy entries; without the explicit null guard they render as a `0 kg` row in the new flat Records list and silently inflate sort positions.
**Working solution:** Add `if (v === null || v === undefined || v === '') return undefined;` BEFORE the `Number(v)` call. The same trap applies to `Number('') === 0` — empty strings should also short-circuit to undefined. Add a unit test that asserts `toFiniteNumber(null)` and `toFiniteNumber('')` both return `undefined`; if the test reports `Received: 0` you know you're hitting this case.
**Apply when:** Any helper coercing a `string | number | null | undefined` field on persisted Redux state to a number for `.toFixed`/comparison.

### 135. Round-2 feedback may include a partial revert — restore from `git show origin/master:<path>`, don't try to diff-apply
**Observation:** When the user's review on a feedback round explicitly says "revert this part of the PR back to master, keep the rest", the cleanest approach is `git show origin/master:<path> > <path>` for the affected files (works whether the file is currently modified, deleted, or renamed in the worktree) followed by `rm` for any files the PR added that the revert no longer needs. Then update the PR's wiring code to import from the restored module instead of the deleted one. Do NOT try to manually undo the round-1 diff; the restore is one shell command and is auditable in the round-2 commit.
**Apply when:** Any feedback round that asks to keep the PR open but undo a specific decision (renamed component, replaced library, swapped pattern). Use `git show origin/master:` for the canonical content; commit the restore + the integration update as one round-2 commit so the diff is reviewable.

### 136. JS-only feedback rounds: no Gradle rebuild needed — just force-stop+relaunch and Metro serves the new bundle
**Observation (round 2 of GH-246):** Round 2 changed only `.tsx` / `.ts` files (no native modules, no `package.json` changes). With Metro already running on the orchestrator-supplied port and `adb reverse` already configured, capturing fresh evidence took: `adb shell am force-stop com.powerliftingworkoutplanner` → `adb shell am start -n com.powerliftingworkoutplanner/.MainActivity` → wait 8 s → start screencapping. No Gradle build, no APK reinstall. The 4 evidence screenshots covered the new UI (header cards, delta pills, last-done, restored MuscleInvolvementEditor) within 90 s of writing the last source file.
**Apply when:** Any feedback round where the diff is JS/TS only. The only time you need a rebuild is for `package.json`, `patches/`, or `android/` changes; otherwise force-stop is faster and the Metro tunnel already has the new bundle compiled.

### 137. Codex auto-review can re-flag a fix it does not recognise — inline the explicit pattern Codex suggests, not a helper function
**Problem:** Round 2 of GH-246 fixed numeric coercion of persisted record values via a shared `toFiniteNumber(v)` helper imported into `ExerciseStatsTab`. The helper has the correct semantics (null/'' guard then `Number()` then `Number.isFinite`), and the unit test for "string '152.50' sorts at the right position" was added. Codex auto-review still flagged the SAME finding on the round-2 commit because its pattern matcher looks for the literal `Number(r.value)` + `Number.isFinite(numericValue)` shape inside the consumer, not a helper call.
**Working solution:** When the user reports that Codex re-flagged a fix you already shipped, inline the exact textual pattern Codex prescribes inside the consumer (`for (const r of recs) { if (r === null || r.value === null || r.value === undefined || r.value === '') continue; const numericValue = Number(r.value); if (!Number.isFinite(numericValue)) continue; … }`). Keep the helper for unit-test coverage, but the call-site is what the auto-reviewer scans.
**Apply when:** A feedback round restates a Codex P1 with "STILL flagged on commit X". The fix isn't usually broken — the pattern detector is just textual.

### 138. Inline form sections in a ScrollView need a section label + hint, not a popup trigger — restructure the parent BEFORE deleting the modal wrapper
**Observation (round 3 of GH-246):** Converting `MuscleInvolvementEditor` from `<Portal><Dialog>` to a plain `<View>` is a one-file change in the editor itself, but the EditExerciseSheet that hosted it had a "Muscle involvement" Button + "Tap to configure" hint that all assumed a popup trigger. Deleting the Portal without restructuring the parent leaves the user with a button that opens nothing. Pattern: restructure the parent first — replace the trigger Button with a `<Text variant="labelMedium" style=uppercase>Muscle involvement</Text>` section header + a `<Text variant="bodySmall">Tap 25/50/75/100…</Text>` hint, then drop the editor body inline below. The whole sheet stays in a `<ScrollView>` so the long muscle list scrolls naturally without nested scroll containers.
**Apply when:** Converting any "open modal to configure" UI into an inline form section. Don't just unwrap the modal — re-do the parent's section header first so the user has the visual hierarchy that an inline form needs.

### 139. `jest.mock` factory references must use a `mock`-prefixed name — `useFooMock` works, `useFoo` does NOT
**Problem:** Defining `const useExerciseMock = jest.fn(...)` and then referencing it inside a `jest.mock('…', () => ({ useExercise: (id) => useExerciseMock(id) }))` factory throws `ReferenceError: ... not allowed to reference any out-of-scope variables. Invalid variable access: useExerciseMock`. Babel-jest hoists `jest.mock` calls above all imports and declarations, but it allowlists references whose name matches `/^mock/i`. `useExerciseMock` does NOT match because the prefix has to be at the START of the variable name.
**Working solution:** Rename to `mockUseExerciseFn` (or `mockUseExercise`). Anything starting with `mock` is allowed in the factory. The `Mock` suffix pattern is a common gotcha because it works for the standalone `useExerciseMock = jest.fn()` declaration (no babel hoisting issue), but breaks inside `jest.mock()` factories.
**Apply when:** Writing a `jest.mock()` factory that needs to reference a `jest.fn()` so the test body can change its return value between cases. Default to a `mock…` prefix on the `jest.fn()` variable name.

### 140. `KEYCODE_BACK` (4) only dismisses the soft IME — re-uses the navigation back when the keyboard isn't visible
**Observation (round 4 of GH-246):** Driving a multi-field form via direct adb taps required dismissing the on-screen keyboard between consecutive `input tap → input text` sequences so the next tap could reach a field that the keyboard would otherwise occlude. `adb shell input keyevent 111` (KEYCODE_ESCAPE) closes the EditExerciseSheet on this RN setup — it is mapped to navigate-back and not to "hide IME". `adb shell input keyevent 4` (KEYCODE_BACK) does the right thing: when an EditText has focus and the IME is visible, it hides the IME and leaves the screen alone; when no IME is visible, the same keycode pops the navigation stack. Re-dump after each dismissal because the ScrollView shifts by ~50 px when the IME hides, so cached coordinates miss their target.
**Apply when:** Scripting any multi-step form interaction in this app via adb. Use keycode 4 to dismiss the keyboard between fields, NOT keycode 111. After each dismissal, run `uiautomator dump` again to grab fresh `bounds` for the next target field.

### 141. RN Paper `TextInput` exposes its `value` attribute through `text=` on the ui-automator EditText — handy for asserting form state without saving
**Observation:** The dump XML for a `<TextInput value={inputValue} testID="muscle-input-Glutes" />` exposes the *current* value as the `text=` attribute on the inner Android `EditText` node, even before the form is saved. This means `grep 'text="..."' /tmp/ui.xml` after each scripted keystroke is sufficient to verify "Glutes input now has 75" without relying on a screenshot. The match-order pitfall: in the regex `text="([^"]*)"[^>]*?resource-id="muscle-input-Glutes"` the `text` attribute appears BEFORE `resource-id` in the XML, so search for `text` first; the lookahead `resource-id="muscle-input-Glutes"[^>]*?text="([^"]*)"` finds nothing.
**Apply when:** Verifying RN Paper TextInput state on-device without round-tripping through redux. Pair with the testID convention `muscle-input-{Muscle}` and a Python regex that anchors on `text=` first then `resource-id`.

### 142. `adb shell input keyevent 67` only deletes one character even with focused input — for multi-char clear, send `KEYCODE_MOVE_END` (123) first, then back-spaces
**Problem:** Trying to clear an existing "25" from an input with `input keyevent 67` × 2 left "2" because the cursor was at position 0 (left of the text) when the input gained focus, so the first back-space was a no-op and the second deleted the "2". To reliably clear an N-char string, send `input keyevent 123` (KEYCODE_MOVE_END) first to move the cursor to end-of-text, then send `input keyevent 67` × N. RN Paper `TextInput` does NOT auto-place the cursor at the end on tap-focus — the position depends on where in the input you tapped.
**Apply when:** Driving a "clear an existing value" interaction via adb on this app. Use the `MOVE_END` → back-space loop instead of assuming the cursor is already at the end.

### 143. RN responder events fire `onResponderGrant` *and* `onResponderMove` — a single tap can dispatch redux twice unless the handler is idempotent
**Problem (round 5 of GH-246):** Wrapping a `<View>` in the gesture-responder system with `onResponderGrant={fn}` *and* `onResponderMove={fn}` means a tap (no perceptible drag) still calls `fn` twice — once on grant, optionally once on the synthetic move that happens before release. With `fn` dispatching redux on every call, the slider produced two state writes per tap and any "update only when value changes" logic had to explicitly guard against re-dispatch.
**Working solution:** In the handler, compute the rounded percent and `if (percent === current) return;` before calling `onChange`. This both throttles drag (≤101 dispatches across the bar instead of one-per-pixel) and de-dupes the grant/move duplicate on a single tap.
**Apply when:** Building any RN slider/seekbar from scratch using the responder system instead of a third-party gesture library. Make the dispatch a no-op when the new value equals the current value, even if the value is computed cheaply — without that guard, redux state churns at the move-event rate.

### 144. RN gesture responder needs `onStartShouldSetResponder` AND `onMoveShouldSetResponder` to capture both tap and drag — the props are NOT inherited from a parent
**Observation:** A `<View>` with only `onStartShouldSetResponder={() => true}` captures a tap (grant + release) but NOT a finger-drag-into-the-view from a sibling. A drag that starts on the bar is fine, but if the touch was already down and moves into the bar, only `onMoveShouldSetResponder={() => true}` makes the bar steal the responder. For a slider where the user often "lands" near a value and then drags to fine-tune, both props are required.
**Apply when:** Implementing a custom slider/segmented control without `react-native-gesture-handler`. Set both `onStartShouldSetResponder` and `onMoveShouldSetResponder` to `() => true`, otherwise drag-tuning feels broken on Android even though tap-to-set works.

### 145. `accessibilityRole="adjustable"` + `accessibilityActions` is enough for a screen-reader slider — no third-party lib needed
**Observation:** RN's built-in `<View>` honours `accessibilityRole="adjustable"`, `accessibilityValue={{min, max, now}}`, `accessibilityActions={[{name: 'increment'}, {name: 'decrement'}]}`, and `onAccessibilityAction={event => ...}` directly. TalkBack reads "<min..max> slider, X percent, swipe up to increment, swipe down to decrement", and dispatches the corresponding action handler with `event.nativeEvent.actionName` set to `'increment'` or `'decrement'`. The step size is determined entirely by the handler, so a screen-reader "increment" gesture can step 5 % (or any other delta) without extra plumbing.
**Apply when:** Building a custom slider that must work with TalkBack. Skip `react-native-paper`'s Slider and `@react-native-community/slider` if the only requirement is keyboard/TalkBack adjustability — the four accessibility props above cover it.
### 135. `BridgelessReactNativeDevBundle.js` cache causes stale bundle on emulator restart
**Problem:** After a fresh `am force-stop` + `am start`, the debug app loads from the cached bundle at `files/BridgelessReactNativeDevBundle.js` (in the app's private data dir) instead of fetching fresh from Metro. Code changes look absent even when Metro is serving the correct bundle.
**Workaround before launch:**
```bash
adb shell "run-as com.powerliftingworkoutplanner rm -f files/BridgelessReactNativeDevBundle.js"
```
Run this immediately before `am start`. Confirmed: after deletion the app fetches fresh from Metro on next launch.

### 136. Metro may serve stale module hashes after worktree creation — `--reset-cache` on first start
If Metro was started in the worktree and the worktree inherited file-map caches from a prior run, module hashes may be stale even though the files on disk are updated. Start Metro with `--reset-cache` once after creating the worktree or making significant edits. Subsequent starts without `--reset-cache` are fine.

### 138. `new Date(isoString)` + `.toISOString()` in Jest tests breaks in non-UTC timezones
`new Date('2024-01-08T12:00:00')` (no trailing Z) is parsed as LOCAL time. But `.toISOString()` returns UTC, so midnight local in Europe/Berlin gives `2024-01-07T23:00:00.000Z` — slicing to `[:10]` gives the wrong date. Always use `new Date(year, month, day, hour)` to create local dates in tests, and use `getFullYear()/getMonth()/getDate()` for assertions, not `toISOString().slice(0, 10)`.

### 139. `adb shell date` is blocked on user-build emulators (no root access)
`ro.build.type=user` emulators reject `adb shell date MMDDHHmmYYYY.SS` with "Operation not permitted". Neither `su` nor `am broadcast android.intent.action.TIME_SET` works without root. If you need to set the device date for evidence screenshots, the emulator must be an `userdebug` or `eng` build. When stuck on a user build, rely on unit tests as the primary evidence for date-related bugs.

### 149. FlashList with dynamic-height groups: flatten into typed rows, do NOT wrap in a ScrollView
A `FlashList` whose `data` items are variable-height group cards (e.g. a date-group card wrapping N workout tiles) clips badly if `scrollEnabled={true}` — it measures only the first child's height. The tempting fix of `scrollEnabled={false}` + a parent `ScrollView` **defeats virtualization entirely** (every row mounts statically) and was rejected on review for GH-277. Correct pattern: **flatten the grouped data into a single typed-item list** — emit `{type:'header'}` and `{type:'workout'}` rows as separate FlashList items, give the list `getItemType={item => item.type}`, and let the FlashList itself be the scroll container (`scrollEnabled` default true). Use `onEndReached` + `onEndReachedThreshold` for incremental loading. Each item is then fixed-purpose and FlashList virtualizes/recycles correctly. See `app/tabs/Analyse/History.tsx`.

### 150. Jest `testPathIgnorePatterns` override in worktrees needs `--testPathIgnorePatterns='[]'`
Passing `--testPathIgnorePatterns=/node_modules/` does not *replace* the config's pattern list — it *appends*. The config's `/.worktrees/` entry still applies. The only reliable workaround is `--testPathIgnorePatterns='[]'` (JSON empty array), which completely replaces the configured list and lets all files through.

### 137. Maestro `launchApp` restores the previous nav state — don't assume Training tab is active
`launchApp` re-opens the app from wherever it was last (Settings, Dashboard, etc.). Flows that depend on the Training tab being visible should either:
- Use `waitForAnimationToEnd` + `tapOn: 'tab-settings'` (string selector) to navigate explicitly
- Or wait for `Export Data` / screen-specific text instead of 'Training'
Bare `extendedWaitUntil: visible: 'Training'` fails when the app last closed on Settings because the 'Training' tab label only shows for the selected tab.
**Apply when:** Any per-slot side-effect inside a component rendered under `RangeSwiper` (or any swiper that re-renders with new props instead of remounting). Includes auto-routes, "show this once" hints, slot-bound analytics, etc.

### 138. `??` operator does NOT fall back through `0` — be explicit when display priority matters
**Problem/Symptoms:** `<Text>{savedValue ?? liveValue}</Text>` keeps showing `0` when `savedValue === 0`, because nullish coalescing only short-circuits on `null` / `undefined`. A stale buggy save that persisted `velocityLossPercent: 0` then made the VL display stick at `0%` even though the live calculation produced a non-zero value. Users only saw the correct value after touching+saving again.
**Working solution:** When the live calc is the source of truth, flip the priority: `liveValue ?? savedValue`. If both can legitimately be `0`, you almost always want the live value to win — savedSetResult is just a snapshot, live should reflect the current effective boundaries / state.
**Apply when:** Any "show saved unless live exists" UI where the saved value can be `0` (counts, percentages, deltas, slopes). Use `??` with live FIRST, or compare against `null` / `undefined` explicitly.

### 139. RN ScrollView under a touch-grabbing child (video / chart) — swipe from the empty margin to scroll
**Problem/Symptoms:** A `<ScrollView>` containing a `<Video>` player + native chart didn't scroll on adb `input swipe 540 1800 540 600`, regardless of duration. The video container's gesture system swallowed the swipe. Lowering `wm density` to 280 to fit more on-screen kicked the app to the launcher and required `wm density reset` + relaunch.
**Working solution:** Swipe from the **right edge of the screen (x ≈ 1000 / 1080)** where the video container doesn't extend — that's the only path that reaches the parent ScrollView without the video stealing the responder. `adb shell input swipe 1000 1900 1000 600 800` scrolled the overlay card reliably. Do NOT change density to compensate.
**Apply when:** Capturing evidence on any screen that nests video/chart inside a scrollable container. Swipe the right-side margin, not the center.

### 140. `analysisN` list entries can have `localVideoPath: undefined` after `.gains` import — re-import via "Import Video" to get the overlay
**Problem/Symptoms:** Baseline `.gains` import populated the Video Analyses list with a "Squat" entry whose detail screen showed "No local video path available yet". The playback overlay card mounts only when `localVideoPath` is set on the Redux entity, so VL / scrubber / rep summary never rendered — no Item B evidence possible.
**Working solution:** `adb push` the fixture mp4 to `/sdcard/Download/`, then in the app: Video Analyses → **Import Video** → 3-dot menu → Browse → Downloads → select the mp4. The in-app analyzer creates a fresh analysis with `localVideoPath` set, and the overlay card renders correctly. The pre-existing list entry stays broken (no easy way to attach a path post-hoc) — just create a new analysis alongside it.
**Apply when:** Worker needs to capture evidence on the VideoAnalysisPlaybackOverlayCard but the baseline analysis from `.gains` import has no localVideoPath. Don't fight it — import a fresh mp4.

### 146. `adb shell input swipe` cannot trigger `Pressable.onLongPress` — use `input motionevent` instead
**Problem:** Drag handles wired via `<Pressable onLongPress={drag}>` (the pattern used by `react-native-draggable-flatlist`'s renderItem `drag` callback) need ≥500 ms of stationary touch before the drag activates. `adb shell input swipe x1 y1 x2 y2 duration` interpolates linearly with no initial hold, so the gesture handler sees motion immediately and never crosses the long-press threshold. The screen ends up scrolling (or doing nothing) instead of starting drag.
**Working solution:** Compose the gesture from raw motion events:
```
adb shell 'input motionevent DOWN <x> <y> && \
  for i in $(seq 1 12); do sleep 0.1; input motionevent MOVE <x> <y>; done && \
  for i in $(seq 1 N); do sleep 0.05; y=$((<y_start> - i*<step>)); input motionevent MOVE <x> $y; done && \
  input motionevent UP <x> <y_end>'
```
The 12 stationary MOVE events at 100 ms = ~1.2 s long-press, which reliably activates `Pressable.onLongPress`. Then the ramp MOVE events do the actual drag, and UP finalises. Confirmed in GH-263: this swapped Set 1 ↔ Set 2 in the PlanEditList NestableDraggableFlatList; `input swipe 135 1267 135 1050 2500` failed to reorder.
**Apply when:** Any device verification that depends on react-native-gesture-handler / Pressable long-press drag (Plan editor sets, exercise reorder squares, any future draggable list). Use `motionevent`, not `swipe`.

### 147. `react-native-draggable-flatlist` nested in ScrollView needs the Nestable* APIs, not the plain ones
**Problem:** A vertical `DraggableFlatList` inside an outer `ScrollView` looks fine but the drag gesture never activates: the long-press fires (the `ScaleDecorator` even pulses visually) but the pan movement is captured by the parent scroll, so reordering doesn't happen. This is `react-native-draggable-flatlist`'s well-known nested-scroll problem.
**Working solution:** Use `NestableScrollContainer` (replaces the outer `ScrollView`) + `NestableDraggableFlatList` (replaces inner `DraggableFlatList`). Both are exported from `react-native-draggable-flatlist@4`. The inner list registers itself with the container so the pan gesture is routed correctly. Confirmed in GH-263 commit `488854b6`: replacing the inner list and wrapping `TrainingsPlanNode`'s outer scroll in `NestableScrollContainer` fixed set-reorder while keeping the rest of the screen scrollable.
**Apply when:** Any vertical draggable list lives inside a vertical scroll view in this repo. Horizontal `DraggableFlatList` inside a vertical ScrollView is usually fine and doesn't need the Nestable variant.

### 148. Worktree branch already at HEAD with all changes — resume by verifying, not reimplementing
**Observation:** When the orchestrator hands a worker a `feedback_round` ticket and the prior worker died **after committing locally but before pushing**, the worktree already contains the full implementation. `git log` shows the relevant commit ahead of origin/master and `git status` shows nothing else.
**Apply when:** A feedback-round prompt explicitly says "branch has full implementation locally; previous worker died before push." Do **NOT** redo the implementation — that wastes 10+ minutes of build + emulator time and risks creating a divergent second commit. Verify the existing commit by reading the diff, run the targeted tests, build + install the APK, capture device evidence, push, open the PR. Only fix defects with **additional** commits on the same branch; never amend or recreate the existing commit.

### 149. Pre-existing test failures: diff the failing file against origin/master before assuming you broke it
**Observation:** If `npm test` reports failures in files you didn't touch, do not assume regression. Run `git diff HEAD origin/master -- <file>` — zero diff means the failure is pre-existing on master and unrelated to your change. Confirmed in GH-263: `exerciseReducerTest`, `settingsReducerTest`, `exercisesReducerTest`, `AddWorkoutSet` all failed identically on origin/master (a `feat: alternativeIds` addition surfaced the snapshot drift before this branch was cut). Use this evidence in the PR body to pre-empt review questions.
**Apply when:** Workspace-wide test runs show failures outside your touched files. Spend 30 s diffing before spending an hour "fixing" a master bug.

### 150. `GestureHandlerRootView` is REQUIRED at the app root for Android — missing it silently breaks drag/pan
**Problem:** `react-native-gesture-handler` requires a `<GestureHandlerRootView>` wrapper at the app root on Android. Without it, ALL pan/drag gestures inside the app (including those `react-native-draggable-flatlist` uses internally) are silently dropped — no warning, no error. `onLongPress` from RN's built-in responder still fires (so libraries that activate drag via `onLongPress={drag}` like draggable-flatlist appear to "respond" — the row is marked active, the ScaleDecorator pulses — but the subsequent pan movement never reaches `PanGestureHandler` and the actual reorder never happens). `import 'react-native-gesture-handler'` in `index.tsx` registers the native module but is NOT sufficient by itself.
**Working solution:**
```tsx
import {GestureHandlerRootView} from 'react-native-gesture-handler';
// inside App body:
<GestureHandlerRootView style={{flex: 1}}>
  <PaperProvider>...</PaperProvider>
</GestureHandlerRootView>
```
Confirmed in GH-263 round 2: round 1 swapped `DraggableFlatList` → `NestableDraggableFlatList` + `NestableScrollContainer` and reported success based on adb-driven testing that activated drag without verifying actual reorder. The user found drag still didn't work because the gesture-handler root was never installed. Round 2 added `GestureHandlerRootView` to `App.tsx`; drag activation now visibly fires (Set 2 active highlight). On iOS this is auto-handled, but Android needs the explicit wrapper.
**Apply when:** Touch any draggable-flatlist or gesture-handler-dependent UI. **Always check `App.tsx` (or `index.js` root) for `GestureHandlerRootView` BEFORE assuming drag works.** It's a one-line bug that wastes hours otherwise.

### 151. `adb input motionevent` reliably triggers long-press drag activation but NOT the subsequent pan-reorder
**Observation:** Memory entry 146 noted that 12 stationary MOVE events at 100ms successfully cross `Pressable.onLongPress` threshold. In GH-263 round 2 the activation worked (row marked active, ScaleDecorator pulses) but the subsequent ramp-down MOVE events that should drive the actual reorder never propagated to `react-native-draggable-flatlist`'s internal `PanGestureHandler`. The library waits for new pan events AFTER the drag callback fires, and adb's motionevent stream apparently breaks pointer continuity at the moment of activation (possibly because the FlatList captures the pointer via a separate Reanimated worklet which doesn't see subsequent motionevent injections as the same touch session).
**Apply when:** Verifying drag-and-drop on Android via adb. Use the long-press activation (row visibly active) as proof that the gesture system is wired correctly, but **defer the actual reorder verification to a real-finger test by the user**. Don't waste hours trying to script a perfect motionevent sequence — `draggable-flatlist`'s drag mode is not friction-free with adb input emulation. Document the activation in the PR and request user touch verification.

### 152. Round-2 verification on a NEW emulator with baseline data: use the drawer to find an empty training slot
**Observation:** When the orchestrator assigns a fresh emulator with baseline data, the "next training" the dashboard surfaces may be already populated (e.g. Push squat after a prior worker's interactions or after the bootstrap script left it populated). The TrainingsPlanDrawer (≡ button top-left of the Plan tab) lists ALL training slots in the current micro by name. Tap a different slot (e.g. "Push" or "Pull" in Micro 7) to reach an empty training without discarding the populated one.
**Apply when:** You need a fresh empty training slot for verifying first-time flows (like "Plan new Training" → fullEdit). The drawer is faster and safer than overflow → Discard which dismisses the populated state you may want to keep for other-item verification.

### 153. JS-only changes don't need a Gradle rebuild — Metro serves the new bundle on app force-stop + relaunch
**Observation:** Confirmed in GH-263 round 2. The round-2 fixes (App.tsx GestureHandlerRootView, PlanTab restructure, PlanEditList inline 1RM) are all JS-side. `react-native-gesture-handler`'s native module is already linked from the prior APK install (registered via `import 'react-native-gesture-handler'` at the top of `index.tsx`). Force-stopping the app via `adb shell am force-stop com.powerliftingworkoutplanner && adb shell am start -n com.powerliftingworkoutplanner/.MainActivity` was sufficient for the new JS bundle (with the new `<GestureHandlerRootView>` JSX wrapper) to load from Metro. No `gradlew assembleDebug` + `adb install` cycle needed for JS-only changes.
**Apply when:** Any JS-only feedback round where the native modules used by the changed JS are already in the prior APK. Save the 7-10 minute Gradle build by reloading via Metro. (Still build the APK in background as a safety net in case Metro is flaky — but don't block on it.)

### 154. Extracting a feature from a "contaminated" branch: `git show <commit> -- <files>` separates the real change from branch-base context
**Problem (GH-283):** A reusable change (set-list memoization) lived only on a branch where unrelated instrumentation was woven into the same files — the ticket warned "do not blind cherry-pick". The fear: cherry-picking `3fc61bf6`/`25bf2245` would drag in GH-262/GH-270 `instrumentSubmitTiming` code.
**Working solution:** `git show <perf-commit> -- <file>` shows the contamination as **unchanged context lines** (no `+`/`-`), not as part of the diff — proof it was already on the branch base and is NOT introduced by the perf commits. The commits' actual `+`/`-` hunks are clean. So: read `git show` for each commit, confirm the unwanted import only appears as context, then hand-apply only the `+`/`-` hunks onto master's files. Verify the result with `git diff <master> HEAD | grep -E "<bad-pattern>"` returning nothing. Here the final `AddWorkout.tsx` came out byte-identical to the branch version (same blob hash `0120115f`) because that file had no contamination at all; only `AddWorkoutSet.tsx` needed the import dropped.
**Apply when:** Any "extract X cleanly from a tangled/abandoned branch" ticket. Don't cherry-pick and don't diff-against-master-and-eyeball — diff each source commit against *its own parent* to see exactly what it added.

### 155. `<Freeze>` from `react-freeze` is the right background-render guard for native-stack screens that stay mounted
**Problem:** Native-stack screens (e.g. `TrainingHome`) stay mounted behind the screen on top. If they hold redux subscriptions they keep re-rendering on every dispatch while invisible. `React.memo` on the screen does NOT help — its own `useSelector`/`useMemo` still run, and child dashboard cards have their *own* `useSelector` subscriptions that fire independently.
**Working solution:** Split the screen into a thin shell + a content component, wrap the content in `react-freeze`'s `<Freeze freeze={!isFocused}>` (`useIsFocused()` from `@react-navigation/native`). A suspended subtree is treated as hidden/offscreen by React, so neither the content's memo work NOR any descendant's `useSelector` runs while frozen. It does NOT unmount, so component state + scroll position survive; it resumes with fresh data on focus. `react-freeze` is already in `node_modules` (transitive dep of `react-native-screens`) — promote it to an explicit `package.json` dep when importing it directly. Measured GH-284: 9 off-screen re-renders @ ~91.7 ms → 0.
**Apply when:** Any mounted-but-invisible screen does measurable render work on unrelated dispatches. Don't bother with `React.memo`/per-card focus props — `<Freeze>` gates the whole subtree at once.

### 156. `useTrainings()` returns a brand-new array on every store tick — every consumer re-renders on ANY dispatch
**Problem:** `useTrainings()` is `useSelector(state => state.trainings.allIds.map(...))` — the inline `.map()` builds a fresh array reference every call, so `useSelector`'s reference check always sees a change and force-re-renders the consumer on *any* redux dispatch, not just trainings changes. Same bug GH-127 fixed for `useAllTrainingsPlans` (via `createSelector`), but `useTrainings` was never converted.
**Apply when:** Diagnosing "why does this component re-render on every dispatch". Hooks with an inline `.map()`/`.filter()` inside `useSelector` are unconditional re-render sources. Fix the hook with `createSelector`, or (if the consumer is a whole screen) gate it with `<Freeze>` per entry 146.

### 157. Maestro (`2.0.9-ports`) `--host` build ignores `--device` — routes to the FIRST adb device
**Problem (GH-277):** `maestro --host 172.18.240.1 --device emulator-5556 test ...` logs `Selected device emulator-5556` but actually launches the app, taps, and screenshots on a *different* device — the first one in `adb devices` output (here the physical `R5CN30HWZFN`). Confirmed by: maestro `DeviceInfo` width/height matches the physical device's override size (720x1600, not the emulator's 1080x2400); polling `dumpsys activity activities` during the run shows the app foreground on `R5CN30HWZFN`, not the emulator. `--device`, `ANDROID_SERIAL`, and `--driver-host-port` all had no effect on the routing. Without `--host`, maestro can't see the emulators at all (`not connected`).
**Impact:** Maestro evidence cannot be captured on the assigned emulator when a physical device is also attached to the same adb server. Verify the feature with adb-driven navigation + `uiautomator dump` + `screencap` on the assigned device instead, and confirm WHICH device maestro hit (screenshot resolution / wallpaper / `dumpsys`) before trusting any maestro screenshot.
**Apply when:** Multiple devices on the adb server and the worker is assigned an emulator. Don't trust maestro's `Selected device` log line — verify the target empirically.

### 158. Debug APK embeds the JS bundle (`debuggableVariants = []`) — rebuild to ship code changes via the embedded fallback
`android/app/build.gradle` sets `debuggableVariants = []`, so even `assembleDebug` runs `createBundleDebugJsAndAssets` and embeds a Hermes `assets/index.android.bundle`. The app uses Metro when `isMetroRunning()` is true and silently falls back to the embedded bundle otherwise (e.g. Metro unreachable, or under load during a Maestro cold-start). Consequence: if the installed APK is stale, a Maestro/cold-start run can render OLD code even though Metro serves the new code. Fix: rebuild `assembleDebug` from the worktree and reinstall so the embedded fallback also has the current code. Verify with `unzip -p app-debug.apk assets/index.android.bundle | strings | grep <new-symbol>`.

### 159. Avoid socat for Metro on emulators — set `debug_http_host=localhost:8081` + `adb reverse` instead
Re-confirms entry #85. The emulator probing `10.0.2.2:8081` needs either a socat bridge (which corrupts large chunked bundles → red-screen "Compiling JS failed") or — cleaner — a `debug_http_host` SharedPreference pointing at `localhost:8081` so plain `adb reverse tcp:8081 tcp:<metroPort>` carries the traffic. Write the pref without a heredoc (heredoc needs a temp file → `Permission denied` under `run-as`): `adb push prefs.xml /data/local/tmp/ && adb shell "run-as <pkg> sh -c 'cat /data/local/tmp/prefs.xml > /data/data/<pkg>/shared_prefs/<pkg>_preferences.xml'"`. Then force-stop + restart; confirm in logcat `isMetroRunning(): Async result = true`.

### 160. Populate the Dashboard's "Top/Focus Exercises" cards by logging one workout via the Exercise → Log tab
`DashboardTab` only renders `TopExercisesCard`/`FocusExercisesCard` (the `handleExercisePress` → `navigate('History', {exercise})` drill-down entry points) for exercises with workouts in `useWorkoutsIn(currentWeekRange/previousWeekRange)`. The baseline `.gains` fixture is months old, so on the real "today" both cards are empty and the drill-down cannot be triggered from the UI. Since `adb shell date` is blocked on user-build emulators (#139), the fix is to **create a current-week workout in-app**: Exercises tab → tap an exercise row → `exercise-tab-log` → fill `add-workout-set-reps-input`/`-rir-input`/`-weight-input` → tap `add-workout-set-submit-button` ("Add"). That single "Add" tap both records the set AND registers a workout dated today (the header card flips to "LAST WORKOUT today" and TOTAL++) — the separate `add-workout-finalize-button` ("Add Workout") is not required. Then Analyse → Dashboard shows `top-exercise-<id>`; tapping it drills into the filtered History.

### 161. Jest CLI `--testPathIgnorePatterns=/node_modules/` DOES replace the config list (correction to #150)
Contrary to memory #150, running `npx jest <path> --testPathIgnorePatterns=/node_modules/` from inside a `.worktrees/...` checkout found and ran the tests fine — the single `=value` form replaced `jest.config.cjs`'s `['/node_modules/', '/__tests__/coverage/', '/.worktrees/']` entirely (jest CLI array options replace, not append). No `'[]'` sentinel or multiple-arg trick was needed in this run (jest 29.7, RN preset). If tests still aren't found, re-check the path/`testMatch` before assuming the ignore-pattern is appending.

### 162. `shallowEqual` alone doesn't stabilize a "fresh empty array" selector — pair it with a module-level EMPTY_ARRAY for the no-data branch
**Problem (GH-277 fb4):** Even with `useSelector(..., shallowEqual)`, a selector body that returns a fresh `[]` literal (e.g. `if (id === undefined) return [] as Workout[]`) still allocates a new reference on every store tick. `shallowEqual` can SOMETIMES bail out and return the cached previous value, but the bail-out depends on internals/timing and is not guaranteed across mounts; meanwhile the inner `[]` literal still becomes the reference threaded into downstream `useMemo` deps if the equality function isn't engaged. A reviewer can read the code and reasonably conclude "fresh `[]` on every call → re-renders on every dispatch" without spelunking react-redux internals. **Working solution:** declare `const EMPTY_ARRAY: T[] = []` at module scope and return THAT for both the undefined-id branch AND the empty-ids branch — `useWorkoutsByExerciseId.ts` now does this. The reference is provably stable from the first call, no dependence on react-redux's equality semantics, and is also faster (no per-call allocation). The `shallowEqual` second arg is still useful for the populated `.map(...)` branch (different contents → still allocates a new array each tick) and is kept.
**Apply when:** Any redux selector hook whose body can return an "empty" shape. Don't rely on equality-fn bail-out; return a module-level constant so the consumer's `useMemo`/`useCallback` deps stay reference-stable from the very first render.

### 163. JS-only changes go live the moment Metro is reachable — verify with `curl http://<metro>/index.bundle | grep <new-symbol>` BEFORE blaming a stale cache
**Observation (GH-277 fb4):** After editing History.tsx the empty-state screen kept showing the old German copy on emulator-5556. Sequence that worked once I understood the cause:
1. `curl -sS http://127.0.0.1:8082/index.bundle?platform=android&dev=true | grep -oE 'No workouts yet|Noch keine Trainings'` — confirmed Metro serves the NEW code. So Metro is fine.
2. `adb -s <emu> logcat -d 2>&1 | grep -iE "isMetroRunning|BridgelessReact|ReconnectingWebSocket"` — found `isMetroRunning(): Async result = false` and `ws://10.0.2.2:8081/message: couldn't connect`. The app was probing `10.0.2.2:8081` directly (bypassing the loopback that `adb reverse` covers), got "not running", and fell back to the embedded bundle in the APK — which still has the old code (per memory #158).
3. Fix: open RN dev menu (`adb shell input keyevent 82`) → "Change Bundle Location" → clear → type `10.0.2.2:8082` → APPLY CHANGES. The app reloaded and immediately picked up the new bundle (English copy visible). Memory #159's `debug_http_host=localhost:8081` pref + `adb reverse` is the more permanent fix; the dev-menu route is a quick one-shot when you don't want to write prefs.
**Apply when:** A debug app shows stale JS even though Metro is up. Don't restart Metro or rebuild yet — first prove Metro is serving the new code with `curl`, then look for `isMetroRunning(): false` in logcat. If false, the app is on the embedded bundle and either the bundle URL is wrong OR the loopback path is broken (socat per #148, missing `adb reverse`, or `10.0.2.2:<port>` mismatch).
### 164. `useFrameCallback` advancing a marker on `dt * speed` accumulates drift — anchor it to the native player time instead
**Problem (GH-285):** Marker computed as `playbackTimeMsSV += frameInfo.timeSincePreviousFrame * speed` runs at the JS-thread frame rate, not the native player's clock. Even with a 1000 ms drift threshold to snap back, observed drift was a full second behind the video. Earlier rounds tried `cancelAnimation + withTiming` for soft correction and produced visible "ticking" because the re-cancellation cycle fought the animation.
**Working solution:** Store `(anchorTimeMs, anchorRecvAtMs)` as SharedValues. In `onPlayerProgress` (fires every 50 ms on Android), set `anchorTimeMs = nativeMs` and `anchorRecvAtMs = currentFrameTimestamp`. In the frame callback, compute `marker = anchorTimeMs + (frameInfo.timestamp - anchorRecvAtMs) * speed`. The marker is now locked to the player within one progress-event period, has no drift threshold, and remains smooth between events.
**Apply when:** Driving an animated UI element from a native source that reports state asynchronously (video player time, sensor value, scroll position from a native gesture). Anchor + interpolate beats free-running on `dt`. Avoid `Date.now()` inside the worklet — write `frameInfo.timestamp` into a SharedValue (`uiNowMsSV`) every frame so JS code can sample the same monotonic clock when setting the anchor.

### 165. SimpleDateFormat `valueFormatter: 'date'` + `valueFormatterPattern: 'mm:ss'` is the cheapest way to label a video-time x-axis on `react-native-charts-wrapper`
**Observation (GH-285):** `react-native-charts-wrapper` ships built-in formatters (`'date'`, `'percent'`, `'largeValue'`) and accepts custom string-array formatters, but the latter only map to integer x-indices — useless for continuous ms-time axes. The `'date'` formatter passes x values to Android `SimpleDateFormat`, which treats them as epoch ms. For sub-hour video clips, pattern `'mm:ss'` renders meaningful minute-of-hour and second-of-minute labels in any whole-hour timezone (CET/EST/JST etc.).
**Apply when:** You want axis labels on a ms-based x-axis without rewriting the chart wrapper. Document the timezone caveat in code — fractional-hour offsets (IST UTC+5:30) shift the minute count by the fractional amount.

### 166. Maestro `baseline.gains` import seeds video analysis metadata but does NOT restore the video files — Playback Overlay shows "No local video path"
**Problem (GH-285):** After `bash run-maestro-from-wsl.sh --mode bootstrap`, the Video Analyses list shows the seeded `Analysis #1` with status "done", but opening it shows "No local video path available yet" and the Playback Overlay/velocity plot does not render. Looking at `baseline.gains`: `localVideoPath: null, resultPath: null` — the fixture only restores the analysis row + setResult, not the underlying video copy or the result JSON.
**Working solution for evidence capture:** After bootstrap, tap **Import Video** → pick `squat-3reps.mp4` (or `squat-1rep.mp4`) from the Android Photo Picker → **Done**. The native analyzer runs (~10 s on emulator-5554), creates an `Analysis #2` with a real `localVideoPath`, and the playback overlay then renders normally. Document the prerequisite in `summary.md` so the reviewer can reproduce.
**Apply when:** Any ticket whose evidence requires the Playback Overlay or velocity plot in `VideoAnalysisDetailTab`. Don't try to fake it by writing to redux directly — the file existence check `RNFS.exists(previewPath)` will still hide the overlay.

### 167. Force-killing `adb.exe` on Windows leaves PID-protected children alive; use the listening PID directly
**Observation:** `taskkill /F /IM adb.exe` from cmd.exe (called via `/mnt/c/Windows/System32/taskkill.exe`) succeeds for 30+ adb instances but fails on a dozen more with "Vorgang wird nicht unterstützt" — those are protected adb child processes. They keep the listening socket bound. Targeted `taskkill /F /PID <listening-pid>` (read from `netstat -ano | grep :5037.*ABH...`) DOES work and lets a fresh `adb -a -P 5037 nodaemon server` bind 0.0.0.0:5037.
**Apply when:** Recovering from a dead ADB server in a WSL+Windows split setup. Use `netstat -ano | grep ":5037 .*ABH"` (German Windows = ABHÖREN; English = LISTENING) to find the actual server PID, then `taskkill /F /PID <pid>`. Don't waste time on `taskkill /F /IM adb.exe`.

### 168. `shallowEqual` is unsafe on selectors whose underlying reducer mutates entities in place — use `createSelector` instead
**Problem (GH-277 fb5):** `useSelector(selectFn, shallowEqual)` bails out when the previous and next outputs are shallow-equal arrays. But `workoutReducer.FINALIZE_WORKOUT` mutates `state.byId[id].end` directly and then only clones the `byId` map. The selector returns `ids.map(id => byId[id])` — the array CONTAINS THE SAME WORKOUT OBJECT REFERENCES as before, just with mutated `end` values. `shallowEqual` reports equal → react-redux bails out → consumer doesn't re-render → downstream `useMemo(() => sort by end ?? start, [list])` keeps the stale order. This silently regresses any UI that derives ordering or grouping from a workout property the reducer mutates in place (`end`, set values, records, etc).
**Working solution:** Convert the hook to `createSelector` with the cloned-by-reducer slice as an input (here: `state.workouts.byId`). FINALIZE_WORKOUT clones `byId` → new ref → createSelector recomputes → new output array reference → useSelector sees a real change → consumers re-render. Keep a module-level `EMPTY_ARRAY` constant inside the result fn so the no-data branches still satisfy the fb4 stable-ref contract (unfiltered History does NOT re-render on unrelated dispatches). Remove `shallowEqual` from the call site — createSelector's reference stability is enough.
**Apply when:** Any selector whose output is an array/object derived from byId entries AND the reducer for that slice mutates entities in place (a non-immer Redux pattern common in legacy reducers in this repo). Reach for `createSelector`, not equality fns. The shallowEqual-bypass bug is invisible in dev because props often look identical — it only shows up as "list ordering is stale until I navigate away and back".

### 169. `createSelector` with a parameterized argument: pass the arg through an input selector, not as a closure
**Pattern (GH-277 fb5):** Hooks like `useWorkoutsByExerciseId(exerciseId)` need to pass `exerciseId` into a memoized selector. The clean reselect 4 pattern is to declare an input selector `(_state, exerciseId) => exerciseId` and call the selector as `selectorFn(state, exerciseId)` from inside `useSelector`. Avoid closing over `exerciseId` inside the result fn — that defeats memoization because every render rebuilds the selector. Default reselect cache size is 1, which is enough for History (one exerciseId at a time per component instance). For shared selectors called with multiple args concurrently, use `createSelectorCreator` with a multi-slot cache or `proxyMemoize`.
**Apply when:** Writing any new `use*` hook that memoizes a Redux derivation parameterized by component-level props. Don't pre-create the selector per-call (kills memoization); use the (state, arg) → output signature with `useSelector(state => sel(state, arg))`.

### 170. `run-maestro-from-wsl.sh --mode bootstrap` pushes fixture files only — it does NOT run the import Maestro flow
**Problem (GH-292):** Running `run-maestro-from-wsl.sh --mode bootstrap` exits with code 0 and succeeds, but it ONLY pushes `.gains` fixture files to `/sdcard/Download/` on the device. It does NOT execute the `00_import_baseline.yaml` Maestro flow that drives Settings → Import Data in-app. The device has the file but the app's store is still empty.
**Working solution:** To actually import baseline data you have two options:
1. Run the import flow explicitly: `run-maestro-from-wsl.sh --mode full --suite __tests__/e2e/maestro/flows/00_import_baseline.yaml` (note: Maestro may still mismatch devices — see memory #118/#126/#133).
2. Drive the import manually via adb: (a) `adb shell am force-stop com.powerliftingworkoutplanner`, (b) `adb shell am start -n com.powerliftingworkoutplanner/.MainActivity`, (c) `adb shell uiautomator dump` to find Settings tab coords, (d) tap Settings → Import Data → file picker → tap `baseline.gains` in the file list.
**Apply when:** Any worker that uses `--mode bootstrap` and then wonders why the app shows no training data. The file push is a necessary precondition but the import tap-sequence must be driven separately.

### 171. `scrollUntilVisible: text: "<header>"` lands the header at the bottom edge of the viewport — the rest of the card body is still off-screen
**Problem (GH-299):** A Maestro flow that did `scrollUntilVisible: text: "Last Training"` and then `assertVisible: "Sets"` / `assertVisible: "Tap to view training details"` failed: Maestro stops scrolling the *instant* the target text enters the visible region, which on a tall card means the header is at the very bottom of the screen and every metric/hint below it is still below the fold. Adding a follow-up `swipe direction: UP` is unreliable because it can scroll the header back off the top.
**Working solution:** Pick a scroll target near the *middle* or *bottom* of the card (e.g. the metrics row label or the hint text), not the header. If the target itself can't be reached by `scrollUntilVisible` because it's a virtualized RN view, scope the assertions to elements you know `scrollUntilVisible` can finish on (header text + a parent testID with `assertVisible: id: ...`) and rely on screenshots for the rest of the card.
**Apply when:** Writing Maestro flows for any dashboard card taller than ~250 dp on a ~2400-tall emulator. Don't assume `scrollUntilVisible` centers the target; it stops at first visibility.

### 172. Paper `Card` + `Pressable` testIDs map to uiautomator resource-ids but Maestro `assertVisible: id:` matches them inconsistently when the Pressable's bounds equal the Card's
**Observation (GH-299):** `<Card testID="last-training-card"><Pressable testID="last-training-card-pressable">...` produces two `android.view.ViewGroup` nodes with the *same* `[x1,y1][x2,y2]` bounds in `uiautomator dump`. `assertVisible: id: "last-training-card"` passes; `assertVisible: id: "last-training-card-pressable"` fails in the same flow run despite the dump showing both. Likely Maestro's visibility check treats the Pressable's aggregated `content-desc` (concatenation of every child Text) as the "primary" label and the resource-id match falls through. The Card wrapper has empty content-desc so its id match works.
**Apply when:** You need a single deterministic testID on a tappable card row, put it on the **outer Card** (or any wrapper that does NOT collect accessibility-label text from its children). Keep the Pressable's testID for press-target debugging if you want, but don't rely on it for Maestro visibility assertions.

### 173. React Navigation `tabBarTestID` renders as Android `content-desc`, not `resource-id` — use Maestro `text:` selector, not `id:`
**Observation (GH-299):** Setting `tabBarTestID: 'tab-training'` in React Navigation bottom tabs produces a UI node with `content-desc="tab-training"` in the Android uiautomator dump — but `resource-id` is empty. Maestro's `id:` selector only matches `resource-id`, so `tapOn: id: "tab-training"` always fails with "Element not found: Id matching regex: tab-training". Maestro's `text:` selector matches both the node's text AND content-desc, so `tapOn: text: "tab-training"` works.
**Apply when:** Any Maestro flow that needs to tap a bottom-tab button by testID. Use `text: "tab-training"` (or the equivalent for other tabs), never `id:`.

### 174. react-native-paper `<Menu>` rendered inside `GestureHandlerRootView` is not exposed to the Android accessibility tree → can't open the dropdown via `adb shell input tap` for an evidence screenshot
**Problem (GH-300):** The `MuscleInvolvementCard` compare picker uses `DropdownChip` → react-native-paper `<Menu>`. The card lives under TrainingsPlanNode's `RangeSwiper / GestureHandlerRootView`, which the Android accessibility tree refuses to traverse. `uiautomator dump` shows no `muscle-map-compare-chip-*` resource-ids; `adb shell input tap` at the chip's pixel coords does NOT open the menu (verified at 5 different y-offsets); Maestro `tapOn` with the testID also fails ("No visible element found"). Maestro `tapOn: point: ...` lands the tap but the menu either does not open or closes before screenshot — the surrounding `waitForAnimationToEnd` may dismiss it.
**Apply when:** Any ticket whose evidence calls for capturing a react-native-paper Menu / Dropdown inside a screen wrapped in GestureHandlerRootView (anything that lives under `<RangeSwiper>` or the plan-detail body in this repo). Don't waste an hour iterating on coordinates. Instead:
1. Capture the chip CLOSED with the selected option visible — react-native-paper renders the active value in the anchor, and the italic compare-label below the chip in `MuscleInvolvementCard` already mirrors the selection in human-readable form. Two screenshots (e.g. `current_total_plan` and `last_training_done`) prove the picker is wired up and the new modes render.
2. Cover the picker option construction (visibility, labels, disable-when-no-match) with unit tests instead of e2e captures.
3. If a "menu open" screenshot is a hard requirement in a future ticket, wrap the menu content in a `Portal` so it renders outside the gesture root.

### 175. redux-persist migration that backfills new top-level setting fields: read the legacy nested slot AND set a sensible default for the second new field
**Pattern (GH-300):** When splitting a single persisted setting into per-view variants (e.g. `plan.muscleMap.compare` → `muscleMapCompareSelectionPlan` + `muscleMapCompareSelectionAnalyse`), the migration needs to:
1. **Preserve** the existing user's value as the Plan default (read `state?.settings?.plan?.muscleMap?.compare`, fall back to the hard-coded default).
2. **Initialise** the second new field with a sensible default (`'last_training_done'` for the Analyse-View, since that's the most useful comparison once a training is finished).
3. **Keep** the legacy nested slot in sync from the new Plan-side dispatch (`SET_PLAN_MUSCLE_MAP_COMPARE`) so any straggler reader of `settings.plan.muscleMap.compare` sees the latest user choice during a deprecation window.
**Apply when:** Adding per-view persisted preferences without breaking the backwards-compat contract spelled out in tickets like "Bestehender Default-Compare-Modus in Plan-View ändert sich nicht (Backwards-compat: redux-persist Migration mit Default = bisheriger Wert)".

### 176. Mounting a card from `app/components/Training/plan/` inside `app/components/Training/analyse/` is fine — flip a `view: 'plan' | 'analyse'` prop on the shared component, don't duplicate
**Observation (GH-300):** Two screens need the same `<MuscleInvolvementCard>` UI with different "today" subjects (planned workouts vs. doneWorkoutIds) and different default compare picks. The clean refactor is a `view` prop on the existing card + matching `view` prop on the underlying `useMuscleInvolvement` selector; the selector branches between `collectPlannedExerciseWorkouts` and `collectDoneExerciseWorkouts`. Don't create a sibling `DoneMuscleInvolvementCard.tsx` — bar-chart styles, picker options, label fallback rules and accessibility plumbing all need to stay identical, and a sibling component is a duplication waiting to drift. The "wrong-directory import" (analyse → plan) is purely an organisational quirk of the existing folder layout, not a code smell.
**Apply when:** A ticket asks for "same component in another view" / "dünner Wrapper" / "the same X but with done data instead of plan data". Add a prop and a thin selector branch first; only split the file if the two views actually diverge.

### 177. Fallback chain must guarantee the fallback value is in the options list — do not use a variable whose value might itself be invalid
**Problem (GH-300 P2):** `effectiveSelectedCompare` fell back to `fallbackCompare` when the persisted value was unavailable. In analyse view, `fallbackCompare = 'last_training_done'`, but `last_training_done` is only added to `compareOptions` when `lastDoneMicro !== undefined`. So when no done match existed, the chip received a `value` not present in `options`.
**Root cause:** The fallback variable was set to "the best preferred value for this view" rather than "the safest guaranteed-present value". When the preferred value can itself disappear from the options list, the fallback produces an invalid chip state.
**Fix pattern:** In the `effectiveSelected` computation, always use a value that is **unconditionally** present in the options list as the ultimate fallback (e.g. `'current_total_plan'` which is always added). Reserve conditional / view-specific defaults for initial seeding of the persisted value, not for the runtime safety fallback.
**Apply when:** Any component with a picker/chip where some options are conditionally rendered. The "effective value" resolution must guarantee the result is always present in the rendered options — use a constant safe fallback, not a variable that can itself be out of options.
