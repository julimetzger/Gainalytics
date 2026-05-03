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

### 91. Emulator hardware keyboard mode: IME shows as floating toolbar, not QWERTY panel
**Observation:** When the emulator has a hardware keyboard attached (WSL dev environment), `adb shell input tap` on a TextInput focuses it and triggers IME (`mInputShown=true` confirmed via `dumpsys input_method`), but the soft keyboard does NOT render as a visible QWERTY panel. Instead, a small floating toolbar (mic, backspace, send, emoji, menu) appears. `adb shell uiautomator dump` will NOT show a keyboard package in the hierarchy.
**Working solution:** To verify keyboard-avoidance behavior, use `dumpsys input_method | grep mInputShown` to confirm IME is active, then take a screencap. The floating toolbar IS the keyboard in this mode. To get a full QWERTY soft keyboard, would need to disable hardware keyboard in emulator config (not accessible from WSL — emulator console TCP port 5554 is unreachable).
**Apply when:** Trying to get keyboard-visible screenshots on WSL emulator and the keyboard isn't showing visually. Use `mInputShown=true` as the authoritative indicator.
### 87. `react-native-modal@13.0.1` componentWillUnmount crashes on RN 0.84 (BackHandler.removeEventListener removed)
**Problem/Symptoms:** A "TypeError: undefined is not a function" red-screen overlay surfaces during navigation, drawer toggling, or sub-tab switching whenever a `MultiselectDropdown` (from `sharingan-rn-modal-dropdown`, which wraps `react-native-modal`) is mounted on screen. Stack: `at ReactNativeModal (modal.js:459)` → `at MultiselectDropdown` → `at TrainingElementPicker`. modal.js line 459 is `BackHandler.removeEventListener('hardwareBackPress', ...)` — that API was removed in RN 0.73+; the modern pattern is `subscription.remove()` returned by `addEventListener`.
**Working solution:** Do not unmount any component that contains `MultiselectDropdown`/`react-native-modal`. The existing `TrainingElementPicker` workaround keeps the dropdown always mounted via `<View style={show ? null : {display: 'none'}}>`. Wrapping the picker in `{isActive && (...)}` or moving it across tab branches that mount/unmount per state RE-INTRODUCES the crash. Keep the picker rendered unconditionally inside its tab, and only toggle visibility via the existing `show`/`display:'none'` mechanism.
**Apply when:** Any change touches `TrainingElementPicker`, `MultiselectDropdown`, or any component wrapping `react-native-modal`. Resist any "optimization" that makes the picker conditional; it will crash. Real fix is library-level (patch `react-native-modal` or replace the dropdown library).

### 88. Header right-side flex layout: title needs `flex:1, flexShrink:1, minWidth:0, numberOfLines:1, ellipsizeMode:'tail'` to keep trailing icons visible
**Problem/Symptoms:** A `flexDirection:'row'` header with `justifyContent:'space-between'` and a long Text on the left + multiple Texts/Icons on the right pushes trailing icons (e.g. an overflow `IconButton`) off-screen when the title is long. Even with `flexShrink:0` on the right container, the right's natural width may exceed the parent and the last child is clipped without rendering.
**Working solution:** On the LEFT container, set `flex:1, flexShrink:1, minWidth:0` and on the title `<Text>` set `numberOfLines:1, ellipsizeMode:'tail'`. The `minWidth:0` is crucial — without it RN refuses to shrink below intrinsic content size and the title forces the row wider than the parent. On the RIGHT container keep `flexShrink:0` so icons stay at natural size. This works for short-to-medium titles; very long combinations may still need a `maxWidth` constraint.
**Apply when:** Any header/row layout where a long left-side label needs to truncate so trailing actions stay visible.

### 92. "Last training" baselines must filter the in-progress workout, not just `slice(-1)` of `byExerciseId`
**Problem/Symptoms:** `state.workouts.byExerciseId[id]` lists ALL workouts for an exercise, including the one currently being logged in the active session. `useAllLastWorkouts(exercise, 1)` therefore returns the in-progress workout as soon as the user logs the first set, and any "vs last training" comparison drifts to the just-logged set instead of the previous training.
**Working solution:** When you need "the previous COMPLETED training" (e.g. for delta/baseline UI), write a dedicated hook (`useLastFinishedWorkout`) that walks `byExerciseId` from newest and returns the first workout where `end !== undefined`. Keep `useAllLastWorkouts` for unrelated callers (e.g. "any-workouts-exist" checks).
**Apply when:** Any feature that compares the user's current input against historic training data on the same exercise. Never assume `byExerciseId.slice(-1)` skips the active workout.

### 93. Overflow-menu items wired to a `() => {}` no-op pass linting but ship a tappable dead control
**Observation:** It's tempting to leave a placeholder handler when "the real settings deep-link doesn't exist yet" — but the menu item still renders, gets tapped, and silently does nothing. Code review (and users) read that as a bug, not a stub.
**Apply when:** Reviewing PRs that wire menu items via `useMemo`/`useCallback` returning anonymous fns. If the body is empty `{ }` or just a TODO comment, either remove the menu item entirely OR wire it to a minimal real action (e.g. open the existing dialog with the right pre-fill). Never ship a menu item with a no-op handler.

### 94. Stable react-native testIDs are NOT in the uiautomator dump for live-updating screens
**Problem/Symptoms:** A react-native `Pressable testID="subtab-train"` or `IconButton testID="rest-timer-overflow"` is not visible to `uiautomator dump` — uiautomator returns "could not get idle state" because the rest-timer countdown ticks every second and the hierarchy never stabilizes. Maestro `tapOn: id:` also fails with "Element not found" for the same reason.
**Working solution:** When the screen has a continuously-updating element, fall back to coordinate-based `adb shell input tap`. Use Python+Pillow on a saved screenshot to find the icon's pixel coordinates by color (e.g. light-on-dark vertical-3-dots), then convert saved-image coords to device coords using the saved-vs-real width ratio (e.g. saved 800-wide → device 1080-wide → multiply by 1.35). Same for y using device height ratio.
**Apply when:** Any flow that needs to interact with a UI element rendered alongside a live-updating timer/clock. Don't waste rounds chasing testID resolution; just compute pixel coords from a screenshot.

### 95. Debug APK with both ABIs (~216 MB) won't install on a 6 GB /data partition at 89% usage; use `-PreactNativeArchitectures=x86_64` to halve it
**Problem/Symptoms:** `INSTALL_FAILED_INSUFFICIENT_STORAGE: Failed to override installation location` even after uninstalling the previous version. /data has ~640 MB free but the streamed install needs ~3× APK size for staging + dexopt.
**Working solution:** When targeting only the emulator, build with `./gradlew assembleDebug -PreactNativeArchitectures=x86_64`. APK drops from ~216 MB to ~119 MB and installs cleanly. Don't waste time trying `pm install /data/local/tmp/*.apk` — the size constraint is on the install volume, not the source path.
**Apply when:** Emulator install fails with INSUFFICIENT_STORAGE. Strip the unused arm64-v8a slice from the debug APK via the gradle property, no permanent build.gradle change needed.

### 96. jest config `testPathIgnorePatterns: ['/.worktrees/']` makes `npm test` find 0 matches when run from inside a worktree
**Problem/Symptoms:** `npm test -- --testPathPattern=Foo` from a worktree path like `.worktrees/feature-XYZ/` returns "Pattern: Foo - 0 matches" even though the test files exist. The worktree's absolute path includes `/.worktrees/`, so every spec under it is excluded by the global ignore pattern in `jest.config.cjs`.
**Working solution:** Run jest directly with overridden ignores: `npx jest --testPathIgnorePatterns='/node_modules/' --testPathIgnorePatterns='/__tests__/coverage/' --testPathPattern=...`. Don't edit `jest.config.cjs` to add a worktree-aware exception — the global ignore is intentional to keep the master test run from picking up worktree state.
**Apply when:** Any worker running tests from inside a `.worktrees/...` worktree. Use `npx jest` with explicit ignores; don't touch the shared config.

### 97. Coordinate-based tap on a 1080×2400 device from a 800-wide screenshot needs `device = saved × 1080/800 = saved × 1.35` for both axes
**Observation:** Resized screenshots (800px wide) are convenient for chat rendering but coordinate math is easy to flip when the height shows up as 1778 (preserving aspect). Both x and y scale by the same factor (1080/800 = 2400/1778 = 1.35), since `screencap -p` produces 1080×2400 PNGs.
**Working solution:** When a uiautomator dump can't surface a react-native testID and Maestro `tapOn` fails (e.g. live-updating rest timer prevents idle state — see entry 94), find the target visually on the saved 800-wide image, multiply both coords by 1.35, and `adb shell input tap <x> <y>` at the device coords. Verify by drawing a `drawbox` annotation at `(x_device, y_device)` on `/tmp/full.png` BEFORE scaling — `drawbox=…,scale=800:-1` runs filters in order, so the drawn box scales with the image and you can sanity-check the position visually before the real tap.
**Apply when:** You need to drive an interaction the testID-based path can't reach. Don't guess coords by eye on the 800-wide image — convert with the 1.35 factor.

### 98. Maestro wrapper `run-maestro-from-wsl.sh --mode full` always force-stops the app — preserves state ⇒ launchApp re-launches at HOME, not the previous screen
**Observation:** The script does `adb shell am force-stop` before invoking `maestro test`, regardless of mode. Every Maestro flow therefore starts cold. So a flow that says `tapOn: ".*Push pull.*"` will land on the most-recently-rendered view of that plan (default Micro 1, default sub-tab) — even if the previous run had navigated to a different micro.
**Working solution:** Either (a) write the flow to navigate explicitly from the home screen (use the `training-home-active-training-<planId>` pill testID, which jumps to the in-progress training regardless of which micro is "current"), or (b) handle every state branch (PLANNED → tap Start, FINISHED → header overflow → Edit) so the cards mount unconditionally. Don't assume the device's pre-launch state survives across runs.
**Apply when:** Writing a Maestro flow that needs the cards mounted in `ExecuteTraining`. Drive the navigation deterministically; don't rely on app state from a prior run.


### 99. New native dep (react-native-svg) plus npm install bumps a transitive RN package; patch-package must rerun before gradle build
**Problem/Symptoms:** Adding `react-native-svg` via `npm install` not only adds the new package but also lets npm pick up newer minors of unrelated transitive deps (e.g. `react-native-document-picker` jumped 9.1.1 → 9.3.1) and clobbers the `node_modules/<dep>/...` files that `patch-package` had already overlaid. The next `./gradlew assembleDebug` then fails with cryptic Java compile errors (`method does not override`, `cannot find symbol execute()`) inside the upgraded dep. Equally, JS-only patches in `patches/` (e.g. `react-native-modal+13.0.1.patch` from master) are NOT auto-applied in fresh worktrees if the patch file itself wasn't checked in on this branch — first build crashes the JS bundle on the first `<MultiselectDropdown>` mount.
**Working solution:** After ANY `npm install` in this repo, immediately re-run `npx patch-package`. If a patch file referenced in agent-memory or AGENTS.md is missing under `./patches/`, fetch it from `origin/master` (`git show origin/master:patches/<name>.patch > patches/<name>.patch`) and rerun `npx patch-package`. Only then run gradle. Do this in the same change set as the dep bump so future workers don't repeat the cycle.
**Apply when:** Any worker that runs `npm install <new-dep>` in this repo, or any worker where a fresh worktree is missing a patch file the agent memory mentions. The `postinstall` hook only runs patches that physically exist in `./patches/`.

### 100. `react-native-svg` + `react-native-paper` <Text> together: paper Text reads style props through a custom theme provider that sometimes drops onto the SVG-overlay layer and renders nothing
**Observation:** When a `<Svg>` and an absolutely-positioned `<Text>` overlay share a parent `<View pointerEvents="none">`, the SVG renders fine but a paper `<Text>` inside the overlay can render with zero size on the very first paint because paper's theme provider mounts after the view layout pass. The text appears on the second tick.
**Working solution:** Render the timer string with `react-native-paper` `<Text>` (not raw `<Text>`) AND inside an `absoluteFillObject` overlay with `alignItems: 'center'` + `justifyContent: 'center'`. Don't try to anchor text using SVG `<Text>` element from `react-native-svg` — paper's font + theming work better and the alignment is simpler.
**Apply when:** Building any "circular value with centered label" widget on top of `react-native-svg`. Use the layered-overlay pattern, not SVG `<Text>`.
