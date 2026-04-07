# Agent Memory

**CRITICAL: Device serial warning**
This file mentions specific device serials as context. **NEVER copy device serials from this file into your commands.** Always use your assigned `$ANDROID_SERIAL` from the orchestrator prompt.

## Infrastructure

### 1. Metro must run on the host, not inside the worker
Workers reuse the host Metro port via `E2E_METRO_PORT`. Use `adb reverse` so the device sees port 8081 while each worktree uses its own host Metro port. Never start a new packager inside the worker.

### 2. Parallel Maestro needs unique driver host ports
Use one unique `--driver-host-port` per concurrent worker. The orchestrator assigns this via `E2E_MAESTRO_DRIVER_PORT`.

### 3. JAVA_TOOL_OPTIONS leaks into Gradle builds
Maestro sets `JAVA_TOOL_OPTIONS=-Duser.home=...`. Always `unset JAVA_TOOL_OPTIONS` before running Gradle builds.

### 4. Maestro driver needs 5-15s cooldown between sessions
Running two Maestro flows back-to-back on the same driver port causes TcpForwarder timeouts. Wait at least 5s. After a crashed session, force-stop both the app and `dev.mobile.maestro.android`, then wait 15s.

### 5. Maestro DEADLINE_EXCEEDED on continuously-updating UI
When video is playing, Maestro's `waitForAppToSettle` never completes (UI hierarchy changes every frame). Use Maestro only for navigation to stable screens. For Play tap and playback screenshots, use pure ADB: `adb shell input tap <x> <y>` + `adb exec-out screencap -p`.

### 6. Bundle load after force-stop takes ~30s
Replace `assertVisible: "Training"` with `extendedWaitUntil: visible: "Training", timeout: 60000` after cold app launch.

### 7. Physical device imports real PXL camera video (30+ min processing)
On physical devices, "Import Emulator Squat Video" imports a real camera video, not the short test video. Keep an existing "done" analysis on the device; avoid clearing state.

## Maestro Best Practices

### 8. Assertions must verify actual values, not just visibility
Use `assertVisible: text: "expected value"`, not just `id:`. For dynamic values, use `evalScript` + `assertTrue`.

### 9. Off-screen Views need text anchors for scrollUntilVisible
React Native Views with `testID` are NOT in the accessibility tree when off-screen. Use `text:` anchors (e.g. Card.Title) instead of `id:` selectors.

### 10. react-native-paper Button: match by label text, not testID
`testID` on `<Button>` does not map to resource-id. Use `tapOn: "Play"` instead of `tapOn: id: "my-button"`.

### 11. assertVisible does not support regex
Maestro treats `text:` as literal. For time displays like `"Playback: 00:00 / 00:47"`, assert only the fixed prefix: `text: "Playback: 00:00"`.

### 12. clearState:true + CPU-intensive analysis = gRPC timeout
Use `clearState: false` for overlay/playback flows that reuse an existing analysis.

## React Native Patterns

### 13. Never spread class instances in React state
`{...prev, startDate: d}` creates a plain object, breaking `instanceof`. Always use the constructor: `new NullableRange(d, prev.endDate)`.

### 14. Reanimated SharedValues: stable in prod, unstable in mock
The mock creates a new object per render. Wrap with `useRef`: `const sv = useRef(useSharedValue(0)).current`. Never include SharedValues in `useCallback`/`useEffect` deps.

### 15. viewPortOffsets expects physical pixels, not dp
`react-native-charts-wrapper` `setViewPortOffsets()` needs `Math.round(VALUE_DP * PixelRatio.get())`. Keep JS overlay constants in dp.

## Operational Guidance

- Reuse host Metro; never re-debug host-vs-worker Metro setup.
- Check `run_dir` for existing artifacts before repeating work in a resumed round.
- Evidence paths in `status.json` must be bare relative paths, no inline annotations.
- On real devices, check for redbox before blaming the Maestro flow.
- Avoid generic `scroll` commands over `react-native-charts-wrapper` charts — they fire `onSelect`.

### 16. Maestro --host targets physical device, not emulator
**Problem:** `maestro --host 172.18.240.1 --device emulator-5554` sent test traffic to the physical Samsung phone (R5CN30HWZFN) instead of the emulator, even with explicit `--device emulator-5554`.
**Symptoms:** Debug screenshots showed Samsung home screen. Steps FAILED on launch.
**Working solution:** Run without `--host`: `maestro --udid emulator-5554 test flow.yaml`. The local WSL ADB server already sees the emulator via `ADB_SERVER_SOCKET`.

### 17. clearState:true causes slow app startup (~15-20s navigation delay)
**Problem:** After `launchApp: clearState: true`, the JS bundle reloads from Metro. Navigation from TrainingHome to TrainingsPlanTab can take 15-25s before the target screen renders.
**Symptoms:** Assertions on elements in TrainingsPlanTab timed out even with 8s timeout; screenshot showed home screen but the app later navigated.
**Working solution:** Use `extendedWaitUntil` anchored on a testID unique to the destination screen (e.g., `icon-menu`), with `timeout: 30000`.

### 18. Leading whitespace in JSX breaks Maestro exact text matching
**Problem:** `<Text> {name}</Text>` renders `" TRN004 Test Plan"` (with leading space). Maestro's `assertVisible: text: "TRN004 Test Plan"` never matches because it does exact matching.
**Symptoms:** Assertion fails even though the element is visually present in the screenshot.
**Working solution:** Remove the leading space: `<Text>{name}</Text>`. Or match with regex `".*TRN004 Test Plan"`.

### 19. Nested Pressable + Chip: use text: "Meso 1" not chip testID for navigation tap
**Problem:** Meso chips have dynamic testIDs (`meso-card-{planId}-{mesoId}` with timestamp IDs), making Maestro ID-based tap impossible after clearState.
**Working solution:** Use `tapOn: text: "Meso 1"` — Maestro correctly targets the Chip even inside a nested ScrollView/Pressable. Wait for navigation anchor (e.g., `icon-menu` testID) before asserting destination screen state.

### 20. Maestro text: cannot substring-match within a single combined React Native Text node
**Problem:** `assertVisible: text: "Meso 1"` fails when the text node contains "TRN004 Test Plan › Meso 1" (combined plan and meso name). Maestro's textRegex does NOT do substring matching — it requires an exact or full-regex match against the element's text attribute.
**Symptoms:** Flow fails on "Assert that 'Meso 1' is visible" even though the screenshot clearly shows the text on screen.
**Working solution:** Add `testID` to the RN `Text` component, then assert with `id: "my-testid"` plus `text: ".*Meso 1.*"` (explicit `.*` prefix/suffix for substring). Or render the meso name as a separate `Text` node with its own testID so Maestro can match it exactly.

### 21. Drawer overlay elements are not reliably matched by Maestro text: selector
**Problem:** Text elements inside `react-native-drawer-layout` overlays can fail `assertVisible: text: "..."` even when clearly visible in the screenshot and present in the UI hierarchy.
**Symptoms:** `extendedWaitUntil: visible: "Meso 2" timeout: 5000` times out; screenshot shows "Meso 2" in drawer.
**Working solution:** Add `testID` to each dynamic element in the drawer and use `assertVisible: id: "drawer-meso-name-2"` for reliable matching. ID-based assertions work correctly even inside overlay drawers.

### 22. New RN component in a screen requires adding it to paper mock in tests
**Problem:** Adding a new `react-native-paper` component (e.g. `Chip`) to a screen causes tests that render that screen to fail with "Element type is invalid: ... got undefined".
**Symptoms:** `TrainingHome.spec.tsx` crashed with "Element type is invalid" after `Chip` was added to `TrainingHome`. The mock for `react-native-paper` was missing a `Chip` entry.
**Apply when:** Any time a new paper component is used in a screen that has tests — always update the `jest.mock('react-native-paper', ...)` block in the corresponding spec file.

### 23. Adding a new arg to a dispatch hook breaks call-site test assertions
**Problem:** When a dispatch function's signature gains a new parameter (e.g. `microNumber`), tests that assert on `toHaveBeenCalledWith(...)` with the old arg count fail.
**Symptoms:** `TrainingsBase.spec` expected `dispatchSuggestBasedOnTrained(3, 1, {rirDelta: 2})` but the code now calls `dispatchSuggestBasedOnTrained(3, 1, 2, {rirDelta: 2})`.
**Apply when:** Refactoring a hook to accept more context (meso, scope, etc.) — search for `toHaveBeenCalledWith` on that hook in specs and update the expected args.

### 24. Code review findings vs. device-observed findings must be treated separately
**Problem:** A reviewer may submit both "code review" findings (based on reading diff at commit X) and "UI/device" findings (based on testing build Y). If commit Z was made after commit X fixes the code-review items, the reviewer's feedback might include stale code-review line numbers that have already been fixed — while the device findings may still be valid.
**Symptoms:** All 5 review items looked unfixed in the feedback, but 3 were already addressed in bd981d2 before the review was submitted. Wasted multiple analysis cycles.
**Apply when:** Before investigating review feedback, check git log to see if fixes were already committed after the reviewer's last-tested commit.

### 25. Round-4 test assertion: single-micro Meso has "Micro 1" on BOTH drawer nav buttons
**Problem:** A test asserting "Micro 2" in the right SegmentedButton when in Meso 1 (with 1 micro) fails. `computeNextMesoStartMicro` for a fresh plan returns `startMicro+1 = 2` so Meso 1 ends at micro 1. `nextLocalMicroLabel = Math.min(maxLocalMicro, localMicro+1) = Math.min(1,2) = 1`.
**Symptoms:** `Assertion is false: "Micro 2" is visible` in the drawer filter test.
**Apply when:** Writing Maestro assertions for SegmentedButtons in a meso — compute expected labels from `computeNextMesoStartMicro` first; a fresh single-training plan's first meso has only 1 micro.

### 26. Windows ADB server needs `-a` flag for WSL access; existing process blocks rebind
**Problem:** When `adb -a -P 5037 nodaemon server` is called but another adb process is already running on 127.0.0.1:5037 (bound to localhost only), the new invocation fails with WSAEADDRINUSE (10048).
**Symptoms:** `nc -zv 172.18.240.1 5037` returns "Connection refused"; `adb devices` errors with "cannot connect to daemon".
**Working solution:** `powershell.exe "Get-Process adb | Stop-Process -Force"` to kill all existing adb processes, then re-run `Start-Process -NoNewWindow 'adb.exe' '-a -P 5037 nodaemon server'`. Then `nc -zv 172.18.240.1 5037` should succeed.
