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

### `npm ci` strictly enforces peer dependencies; `npm install` is lenient
After an RN upgrade, always validate with a fresh `npm ci` from scratch, not just `npm test` against a symlinked `node_modules`. Workers that skip this step leave the next developer (or CI) with peer-dep conflicts that were invisible in the agent's reused node_modules.

## React Native Patterns

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

### Evidence paths in `status.json` must be bare relative paths
No inline annotations, no absolute paths, no "(updated in round 3)" suffixes. The validator checks that each path exists — annotations break it.

### Commit all code changes, run tests, then touch the device
Once you're in the device-interaction phase, one crashed Maestro run can wipe enough state that you never get back to a clean "write code" moment. Land every code change you plan to make, run `npm test`, then switch modes to device verification.

### On real devices, check for a red-box before blaming a Maestro flow
A Maestro flow failing on the first assertion is often an app bootstrap crash (redbox), not a flow bug. `adb shell uiautomator dump` + grep for the stack trace is the fastest triage.

### Grep for dev/debug UI elements in both tab screens and modals
"Import Emulator Squat Video" and similar dev-only buttons have historically lived in multiple places (main tab + selection modal). When removing them, `grep -r "<dev button text>" app/` before assuming one file is enough.
