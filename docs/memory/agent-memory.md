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
