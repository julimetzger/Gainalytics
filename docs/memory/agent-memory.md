# Agent Memory

This file captures learnings for feature worker agents — code patterns, test quality, emulator/Maestro usage from the worker perspective, and React Native gotchas.

## Problems And Working Solutions

### 1. Worker sandbox could not reach adb or localhost services

Problem:
- `codex exec --full-auto` workers in `workspace-write` could not talk to adb, Maestro, or local TCP ports by default.

Symptoms:
- `Operation not permitted`
- adb could see emulators on the host, but the worker could not
- inner worker commands showed `network_access:false`

Working solution:
- Launch workers with:
  - `-c sandbox_workspace_write.network_access=true`
  - `-c shell_environment_policy.inherit=all`
- Keep passing explicit adb and Maestro host settings from the orchestrator environment.

Relevant files:
- [launch_feature_job.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/launch_feature_job.py)

### 2. Metro must run on the host, not inside the worker

Problem:
- Metro started inside the worker sandbox was not a reliable host service for emulator verification.

Symptoms:
- Emulator could launch the app but bundle loading failed or behaved inconsistently.
- Metro from the worker behaved differently from a normal host-side packager.

Working solution:
- Start or reuse Metro on the host for each assigned worktree.
- Pass the host Metro port into the worker.
- Use adb reverse so the emulator sees device port `8081` while each worktree still uses its own host Metro port.
- The worker should reuse provided `E2E_METRO_PORT` and not start another packager.

Relevant files:
- [metro_host.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/metro_host.py)
- [launch_feature_job.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/launch_feature_job.py)
- [run-maestro-from-wsl.sh](/home/jmetzger/projects/PowerliftingWorkoutPlanner/__tests__/e2e/scripts/run-maestro-from-wsl.sh)

### 3. Metro resolver must not force everything through root node_modules

Problem:
- A Metro config that forced package resolution through root `node_modules` broke nested dependency resolution.

Symptoms:
- `react-redux` crashed at runtime
- `Provider` became `undefined`
- wrong `@babel/runtime` helper got bundled

Working solution:
- Do not force `extraNodeModules` or `disableHierarchicalLookup` for this repo.
- Use symlink-friendly Metro config with `unstable_enableSymlinks` and ordered `nodeModulesPaths`.
- Let packages like `react-redux` resolve their nested runtime dependencies correctly.

Relevant files:
- [metro_host.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/metro_host.py)

### 4. Worktrees need shared dependencies

Problem:
- Fresh worker worktrees did not always have usable dependencies on their own.

Symptoms:
- missing Jest binary in a worktree
- module resolution failures inside a fresh worktree

Working solution:
- Ensure each worktree has `node_modules` symlinked to the root repository `node_modules`.
- Ignore the symlink locally so fresh worktrees stay clean.

Relevant files:
- [create_worktree.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/create_worktree.py)
- [metro_host.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/metro_host.py)

### 5. Fresh runs need explicit fresh worktrees

Problem:
- Reusing long-lived ticket worktrees caused drift, stale artifacts, and confusion about what code a worker was actually running.

Symptoms:
- restarted tickets inherited old local state
- old run artifacts and worktree dirt confused review and status reporting

Working solution:
- Recreate ticket worktrees explicitly when a fresh round is required.
- Use:
  - `create_worktree.py --worktree-mode fresh`
  - `create_worktree.py --base-ref <snapshot-ref>`
- If current root fixes must be included, snapshot them first and branch fresh worktrees from that snapshot.
- Normal orchestrator behavior should stay `resume`; fresh should be an explicit opt-in.

Relevant files:
- [create_worktree.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/create_worktree.py)

### 6. Parallel Maestro needs unique driver host ports

Problem:
- Upstream Maestro was flaky when two Android sessions ran in parallel on the same machine.

Symptoms:
- whichever session started second often failed in the driver forwarder
- `dadb.forwarding.TcpForwarder.waitFor`
- failures around driver port `7001`

Working solution:
- Use one unique `--driver-host-port` per concurrent worker.
- Pass that port through the orchestrator and the Maestro wrapper.
- In this environment, the installed Maestro fork with driver-host-port support was materially better than the default behavior.

Relevant files:
- [launch_feature_job.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/launch_feature_job.py)
- [run-maestro-from-wsl.sh](/home/jmetzger/projects/PowerliftingWorkoutPlanner/__tests__/e2e/scripts/run-maestro-from-wsl.sh)

Environment note:
- The live Maestro install was switched to the `2.0.9-ports` fork in the user's Windows Maestro location, with a backup created beforehand.

### 7. The repository currently depends on react-dom for this environment

Problem:
- In this setup, `react-redux` resolution and runtime behavior were broken without `react-dom`.

Working solution:
- Keep `react-dom@18.2.0` present in the root dependency set unless the underlying resolution issue is removed in a cleaner way later.

Relevant files:
- [package.json](/home/jmetzger/projects/PowerliftingWorkoutPlanner/package.json)
- [package-lock.json](/home/jmetzger/projects/PowerliftingWorkoutPlanner/package-lock.json)

### 8. Spread operator on class instances breaks instanceof checks in React state

Problem:
- When updating a NullableRange instance stored in React state using the spread operator ({...prev, startDate: d}), the result is a plain object, not a NullableRange instance. Any downstream code using instanceof NullableRange returns false.

Symptoms:
- Calendar became unresponsive after a text-input Save
- DatePickerModal.extracted() ran the `if (date instanceof NullableRange)` branch and returned false, so no onChange was called
- Analyse tab stopped showing workouts (useWorkoutsIn received an invalid range object)

Working solution:
- Always use the class constructor when updating class instances in state: new NullableRange(d, prev.endDate) instead of {...prev, startDate: d}.
- Added AGENTS.md rule: "When storing class instances in React state, NEVER use the spread operator. Always construct a new instance."

Relevant files:
- [AGENTS.md](/home/jmetzger/projects/PowerliftingWorkoutPlanner/AGENTS.md)
- [DateRangePicker.tsx](/home/jmetzger/projects/PowerliftingWorkoutPlanner/app/components/picker/date/DateRangePicker.tsx)

### 9. Maestro assertions must verify actual values, not just element visibility

Problem:
- Maestro flows that only assert assertNotVisible: "Save" and assertVisible: id: "button-text" prove the modal closed — they do not prove the feature worked correctly.

Symptoms:
- A Maestro flow passed but the confirmed range was not verified. Review accepted the flow as e2e evidence even though a wrong range would also have passed.

Working solution:
- Use assertVisible: text: "..." to verify the actual content of changed UI elements.
- For dynamic values (e.g. today's date), use evalScript to compute the expected string and assert against it.
- Added explicit Maestro Test Quality Rules section to feature/SKILL.md.

Relevant files:
- [feature/SKILL.md](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/feature/SKILL.md)

### 10. Real-device Maestro failures can actually be app bootstrap crashes, not flow bugs

Problem:
- A Maestro flow on the physical Android device can fail at the first screen assertion even though the real issue is that the debug bundle never booted cleanly.

Symptoms:
- Maestro fails on a simple first-step assertion such as `tab-analyse is visible`
- adb UI dump shows the React Native redbox instead of the app UI
- the runtime error can move as you patch startup globals, for example:
  - `ReferenceError: Property 'setImmediate' doesn't exist`
  - later `ReferenceError: Property 'window' doesn't exist`

Working solution:
- Before rewriting the flow, inspect the device UI dump or redbox text.
- If the app is crashing during bootstrap, fix the startup/runtime issue first.
- Keep the fix as small and early as possible, for example in [index.tsx](/home/jmetzger/projects/PowerliftingWorkoutPlanner/index.tsx), rather than scattering feature-specific workarounds deeper in the app.

Relevant files:
- [index.tsx](/home/jmetzger/projects/PowerliftingWorkoutPlanner/index.tsx)
- [VideoAnalysisPlaybackOverlayCard.test.tsx](/home/jmetzger/projects/PowerliftingWorkoutPlanner/__tests__/components/video/VideoAnalysisPlaybackOverlayCard.test.tsx)

### 11. TRN-002 emulator proof is more stable when it reimports baseline data and drives Planning mode directly

Problem:
- The earlier direct route into the training suggestion UI on `emulator-5554` was flaky: the body controls intermittently disappeared, and Maestro often failed before the progression inputs were usable.

Symptoms:
- `Push pull` or `tab-training` assertions failed unpredictably
- the route showed only a partial body or a minimal hierarchy dump
- the proof could not reliably reach `RIR delta` and `Weight increase %`

Working solution:
- Reimport the `.gains` baseline first from Settings.
- Then drive the proof through:
  - `tab-training`
  - open the training card
  - switch to Planning mode
  - step to `Micro 6`
  - scroll to the progression inputs
  - set `RIR delta = 1`
  - set `Weight increase % = 5`
  - trigger `Suggest based on last Training`
- Keep the focused Jest suite as the invariant proof for the implementation while the emulator flow is still being stabilized.

Relevant files:
- [trn-002-proof-5554.yaml](/home/jmetzger/projects/PowerliftingWorkoutPlanner/.codex-orchestrator/runs/TRN-002/checks/trn-002-proof-5554.yaml)
- [test.log](/home/jmetzger/projects/PowerliftingWorkoutPlanner/.codex-orchestrator/runs/TRN-002/checks/test.log)

### 12. React Native Views are not in the Android accessibility tree when off-screen

Problem:
- Maestro `scrollUntilVisible` with an `id:` selector fails for React Native Views that are below the current viewport because they are not yet in the Android accessibility tree.

Symptoms:
- `scrollUntilVisible: element: id: "some-testID"` either times out immediately or scrolls to the bottom without ever finding the element
- The element IS present in the app and IS visible once you scroll there manually, but Maestro cannot find it to scroll to it

Working solution:
- Use `scrollUntilVisible: element: text: "Some Label"` to target text elements (rendered by Text components), which ARE typically in the accessibility tree even when off-screen
- Card.Title text (react-native-paper) works reliably as a scroll target
- After scrolling to a text anchor, use `extendedWaitUntil: visible: "..."` rather than another `scrollUntilVisible` with an `id:` to wait for child elements to become visible

Relevant files:
- [07_video_analysis_overlay_visible.yaml](/home/jmetzger/projects/PowerliftingWorkoutPlanner/__tests__/e2e/maestro/flows/07_video_analysis_overlay_visible.yaml)

### 13. react-native-paper Button testID is not matchable as a Maestro id: selector

Problem:
- Adding `testID="my-button"` to a react-native-paper `<Button>` does NOT expose "my-button" as a matchable resource-id for Maestro's `id:` or `scrollUntilVisible: element: id:` selector.

Symptoms:
- `assertVisible: id: "my-button"` fails with element-not-found
- `tapOn: id: "my-button"` fails with element-not-found
- The button IS visible on screen and works fine when tapped by `text:` selector

Working solution:
- Match react-native-paper `Button` elements by their visible label text: `tapOn: "Play"` or `tapOn: text: "Play"`
- The button container gets `content-desc` equal to the button text, not the testID
- Only use `id:` selectors for plain React Native `<View>` or `<TouchableOpacity>` components where testID maps reliably to resource-id

Relevant files:
- [VideoAnalysisPlaybackOverlayCard.tsx](/home/jmetzger/projects/PowerliftingWorkoutPlanner/app/components/video/VideoAnalysisPlaybackOverlayCard.tsx)

### 14. clearState:true combined with CPU-intensive video analysis causes Maestro gRPC DEADLINE_EXCEEDED

Problem:
- Using `clearState: true` in a Maestro flow that imports and analyzes a video causes the Maestro gRPC driver to time out with DEADLINE_EXCEEDED (2-minute timeout).

Symptoms:
- Maestro fails immediately after `launchApp: clearState: true` with a gRPC error
- `viewHierarchy` request times out; Maestro marks the flow as failed before any step runs
- Happens consistently when the app starts a fresh CPU-intensive analysis right after `pm clear`

Working solution:
- Use `clearState: false` for overlay/playback flows that reuse an existing analysis result
- Reserve `clearState: true` only for the initial import flow (flow 06), which runs once in a clean context
- Chain flows so playback/overlay tests (flow 07) run after the analysis is already complete on the device

Relevant files:
- [07_video_analysis_overlay_visible.yaml](/home/jmetzger/projects/PowerliftingWorkoutPlanner/__tests__/e2e/maestro/flows/07_video_analysis_overlay_visible.yaml)
- [06_video_analysis_metrics_visible.yaml](/home/jmetzger/projects/PowerliftingWorkoutPlanner/__tests__/e2e/maestro/flows/06_video_analysis_metrics_visible.yaml)

### 15. Maestro scroll gestures through react-native-charts-wrapper fire onSelect and seek the video

Problem:
- A generic Maestro `scroll` (direction DOWN) that passes through a react-native-charts-wrapper chart area fires the chart's `onSelect` callback, causing unintended side effects (e.g. video seeking to a random timestamp).

Symptoms:
- After a scroll command, the video playback position jumps to ~00:44 even though no tapOn was issued
- The issue is silent — Maestro does not report an error; the app state just changes unexpectedly

Working solution:
- Avoid using generic `scroll` commands after `scrollUntilVisible` has brought the overlay into view; use `extendedWaitUntil` instead to wait for elements to appear
- If scrolling is truly necessary past a chart, use coordinate-based `swipe` with start/end Y values that avoid the chart bounds
- Wrap chart `onSelect` handlers with a guard that ignores events triggered during Maestro/automated testing if the issue recurs

Relevant files:
- [VideoAnalysisPlaybackOverlayCard.tsx](/home/jmetzger/projects/PowerliftingWorkoutPlanner/app/components/video/VideoAnalysisPlaybackOverlayCard.tsx)

## Operational Guidance For Feature Agents

- Do not spend time re-debugging host-vs-worker Metro. Reuse host Metro.
- Never use spread to update class instances in React state. Always use the constructor.
- A Maestro flow is only valid evidence if it asserts the actual resulting value, not just element presence.
- Check run_dir for existing artifacts before repeating work in a resumed round.
- Evidence paths in status.json acceptance_evidence must be bare relative paths with no inline annotations.
- On real devices, confirm that Maestro is failing on the app UI and not on a redbox before changing the flow itself.
- For `TRN-002`, prefer the baseline-import plus Planning-mode proof path over the older direct `Push pull` route if the body controls are unstable.
- For off-screen scroll targets, use `text:` anchors (e.g. Card.Title), NOT `id:` selectors — React Native Views are not in the accessibility tree until scrolled into view.
- Match react-native-paper `Button` by label text (`tapOn: "Play"`), not by testID — `id:` selector does not work for paper Button.
- Use `clearState: false` for playback/overlay flows that reuse an existing analysis; `clearState: true` + CPU-intensive analysis = Maestro gRPC DEADLINE_EXCEEDED crash.
- Avoid generic `scroll` commands after bringing a screen region into view if react-native-charts-wrapper charts are present; use `extendedWaitUntil` instead to avoid accidental chart `onSelect` triggers.

### 12. Progress bar indeterminate state for unknown-duration analysis

Problem:
- When a video analysis starts, `durationMs` is 0 until the video copy + `getVideoDuration()` completes.
- `calculateAnalysisProgress(elapsed, 0) = 0` always, so the ProgressBar rendered at 0% fill (visually invisible on dark background).
- Screenshots taken early in PROCESSING state showed no visible bar.

Observation:
- react-native-paper `ProgressBar` supports `indeterminate={true}` for a pulsating animation.
- Switching to `indeterminate` while `durationMs` is unknown, then `determinate` once duration is set, gives two visually distinct states.

Working solution:
```jsx
<ProgressBar
  indeterminate={!analysis.videoMeta?.durationMs}
  progress={analysis.videoMeta?.durationMs
    ? calculateAnalysisProgress(elapsed, estimated)
    : undefined}
/>
```

Apply when: any ProgressBar showing time-based fill where the total duration is not immediately available.

### 13. Maestro driver port conflict after back-to-back flows

Problem:
- Running a second Maestro flow immediately after a successful one with the same `--driver-host-port` fails:
  `Maestro Android driver did not start up in time`.

Symptoms:
- Port `7010` still occupied by the previous session for ~30s.

Working solution:
- Wait at least 30s before reusing the same driver-host-port.
- Or use a different port for each back-to-back run.
- The issue only affects the driver port; the adb connection and app state are unaffected.

### 14. JAVA_TOOL_OPTIONS leaks into Gradle builds via previous Maestro runs

Problem:
- The Maestro run script sets `JAVA_TOOL_OPTIONS=-Duser.home=<maestro-java-home>` for its own isolation.
- This env var persists in the shell if the run script is sourced or if the var is exported globally.
- Gradle picks up `JAVA_TOOL_OPTIONS` and fails with CMake/compilation errors.

Working solution:
- Always `unset JAVA_TOOL_OPTIONS` before running Gradle builds.
- The Maestro run script should be invoked in a sub-shell with a fresh JAVA_TOOL_OPTIONS scoped only to that invocation.

### 16. Reanimated mock creates new SharedValue objects per render — do NOT include them in useCallback/useEffect deps

Problem:
- `react-native-reanimated/mock` implements `useSharedValue` as `(v) => ({ value: v })` — a new plain JS object on every call.
- In production, Reanimated uses a ref internally so `useSharedValue` returns the same stable object across renders.
- Including SharedValue objects in `useCallback` or `useEffect` dep arrays works fine in production but causes dep churn in tests, since each render creates new objects.

Symptoms in tests:
- All interaction tests fail with unexpected `undefined` values.
- Reset `useEffect` fires on every render (because mock SharedValue is "new" each time), resetting all state back to initial values and creating an infinite-loop-like reset.
- `useCallback` deps referencing SharedValues get recreated every render, breaking closure stability.

Working solution:
- Never include Reanimated SharedValues in `useCallback` or `useEffect` deps arrays.
- SharedValues ARE stable refs in production code — excluding them from deps is semantically correct.
- The eslint exhaustive-deps rule may warn; suppress with `// eslint-disable-line` if needed, or trust it is correct.

Apply when: using Reanimated `useSharedValue` results in `useCallback`/`useEffect` hooks.

### 17. Both chart markers must be decoupled for full Bridge responsiveness

Problem:
- Partial fix (only speed-chart marker moved to Reanimated) still overloads the Bridge.
- The root cause is `setPlaybackTimeMs` being called 20×/second, causing full React re-renders.
- Even one state-driven marker (time-plot marker via useMemo + plain View) processed through the Bridge blocks the JS thread and prevents user input.

Observation:
- Moving BOTH markers to `useDerivedValue` + `Animated.View` on the UI thread AND increasing `PLAYBACK_UI_UPDATE_INTERVAL_MS` (50→200ms) reduces React re-renders from 20/s to 5/s.
- The combined effect makes the JS thread available for user interaction during playback.
- A Maestro tab-switch during active playback is the definitive responsiveness proof.

Apply when: implementing playback markers in react-native-charts-wrapper overlays.

### 16. socat proxy for ADB and reuseaddr flag (ANA-006)

Problem:
- `socat TCP-LISTEN:5037,fork TCP:172.18.240.1:5037` exits with "Address already in use" when a prior socat child process is still in TIME_WAIT.

Working solution:
- Use `socat TCP-LISTEN:5037,reuseaddr,fork TCP:172.18.240.1:5037` — the `reuseaddr` flag bypasses the TIME_WAIT issue.

Apply when: re-starting the ADB proxy after a session restart.

### 17. DocumentsUI file picker filters .gains files as unknown MIME type (ANA-006)

Problem:
- `DocumentPicker.types.allFiles` opens the Android DocumentsUI picker, but `.gains` files do not appear in the Downloads folder because they have no registered MIME type.
- Files only appear in "Recent" if previously imported in the same device lifetime.

Working solution:
- After `am force-stop` or `pm clear`, the file must be re-imported via Maestro's `tapOn: "baseline.gains"` only if it appears in "Recent". Otherwise, use `adb shell content insert` or copy the file to a path accessible as "Downloads" with a registered extension (e.g. rename to `.json`).

Apply when: importing baseline.gains after a device state reset.

### 18. 00_import_baseline.yaml needs extendedWaitUntil for bundle load (ANA-006)

Problem:
- `00_import_baseline.yaml` uses `assertVisible: "Training"` immediately after `launchApp`. After a force-stop, the Metro bundle loads from 10.0.2.2:8081 in ~30s. The assertion fires before the bundle renders and fails.

Working solution:
- Replace `assertVisible: "Training"` with:
  ```yaml
  - extendedWaitUntil:
      visible: "Training"
      timeout: 60000
  ```

Apply when: writing or modifying import/setup flows that run after a cold app launch.

### 19. Maestro driver needs time between back-to-back sessions (ANA-006)

Problem:
- Running two Maestro flows within a few seconds of each other causes `java.util.concurrent.TimeoutException` in `TcpForwarder` or `dadb.open(tcp:7001)` timeout on the second run.

Working solution:
- Wait at least 5 seconds between Maestro test invocations.
- If `pm list instrumentation` returns empty after a force-stop cycle, let Maestro install its own driver by running it fresh (it detects outdated APKs and reinstalls).

Apply when: running Maestro flows in sequence from a script.

### 20. Reanimated mock creates new SharedValue per render — stabilise with useRef

Problem:
- `useSharedValue(v)` in the Reanimated mock returns `{ value: v }` — a new plain object on every call.
- `useAnimatedStyle(fn)` in mock calls `fn()` immediately during render.
- Without a stable object, `fn()` always reads `value: 0` (the initial from the fresh object), even after `sv.value = someNewValue` on a previous render.

Symptoms in tests:
- `getScrubberState()` always returns `'0%'` even after seeks.
- All animated style checks fail with zero/initial values.

Working solution:
```js
const playbackTimeMsSV = useRef(useSharedValue(0)).current;
```
`useRef(initialValue)` only uses `initialValue` on the FIRST render; subsequent renders return the same ref object. So the SharedValue object is created once and mutations persist across renders.

Apply when: using `useAnimatedStyle` or `useDerivedValue` that reads a SharedValue and testing with assertions on the computed style.

### 21. "Import Emulator Squat Video" on physical device R5CN30HWZFN imports real PXL camera video

Problem:
- `tapOn: "Import Emulator Squat Video"` in Maestro triggers a file picker that imports a real camera video (`PXL_20250917_171414039~2.mp4`) on device R5CN30HWZFN, not the short test video.
- Processing takes 30+ minutes and the `extendedWaitUntil: "Status: done", timeout: 180000` always times out.

Working solution:
- Do NOT rely on "Import Emulator Squat Video" on R5CN30HWZFN for fresh Maestro runs.
- Keep an existing "done" analysis on the device between sessions; avoid clearing state.
- Use the prior round's Maestro evidence if the setup flow cannot produce a completed analysis.

Apply when: planning Maestro flows on R5CN30HWZFN that require a video analysis.

### 22. Maestro TcpForwarder timeout when HOME is overridden but driver port is in use

Problem:
- Running `maestro ... test` with a custom `HOME` (as in `run-maestro-from-wsl.sh`) causes TcpForwarder timeout when the driver port is held by an existing orchestrator session.

Symptoms:
- `java.util.concurrent.TimeoutException` from `dadb.forwarding.TcpForwarder.waitFor`
- Happens when `HOME` is overridden AND `--driver-host-port` conflicts with an active session.

Working solution:
- Run `maestro` directly without overriding `HOME` and without `--host`, passing only `--device` and `--driver-host-port` from the current shell.
- This uses the existing adb connection and reuses the driver port correctly.
- Only change `HOME` when no active driver session is holding the port.

Apply when: running one-off Maestro flows directly (not via run-maestro-from-wsl.sh) in a worker that has an orchestrator-assigned driver port.

### 23. Maestro `tapOn: "Play"` DEADLINE_EXCEEDED when video is playing (ANA-003-fix2)

Problem:
- Maestro's `waitForAppToSettle` calls `AndroidDriver.callViewHierarchy` via gRPC with a 120s deadline.
- When a video is playing, the playback time label (`00:12 / 00:47`) updates every second.
- The UI hierarchy is never "settled", so `waitForAppToSettle` hangs until the 120s gRPC deadline expires.
- Both `--format junit` (TestSuiteInteractor path) and plain `maestro test` (TestCommand path) hit this.

Symptoms:
- `tapOn: "Play"` fails with `DEADLINE_EXCEEDED` after exactly 120s.
- Any subsequent Maestro step after Play also fails.
- The app is fine; only Maestro's gRPC driver is timed out.

Working solution:
- Use Maestro only for navigation steps where the UI is stable (navigate to screen, scroll, assertions on static text).
- Switch to **pure ADB** for the Play tap and all subsequent screenshots:
  ```bash
  adb shell input tap <x> <y>      # Play button coords from uiautomator dump
  sleep 8
  adb exec-out screencap -p > screenshot.png
  ```
- Use `adb shell uiautomator dump` to get exact element coordinates before tapping.
- The video will naturally play to the end; a final `adb exec-out screencap` captures the right-edge state.

Apply when: any Maestro flow needs to interact with or screenshot a continuously-updating UI (video playback, live timers, animations).

### 24. Crashed Maestro session leaves device driver in bad state for subsequent run

Problem:
- After a Maestro gRPC disconnect (DEADLINE_EXCEEDED or TcpForwarder timeout), the Maestro agent on the device is stuck.
- The next Maestro run hits the same gRPC issue on the first heavy gesture (swipe, scroll) even though it previously worked.

Symptoms:
- First run: navigation works, then fails on Play.
- Second run immediately after: fails on first swipe with gRPC disconnect.

Working solution:
- After any crashed Maestro session, before running the next flow:
  ```bash
  adb shell am force-stop com.powerliftingworkoutplanner
  adb shell am force-stop dev.mobile.maestro.android
  sleep 15
  ```
- Wait at least 15 seconds before the next Maestro invocation.

Apply when: a Maestro session crashed mid-flow and a new flow will be started against the same device.

### 25. Marker-formula bug: clamping progress to [0,1] before pixel-multiply causes off-by-offset issue

Problem: If `progress = clamp((t - minTimeMs) / durationMs, 0, 1)` is used, then all `t <= minTimeMs` map to `x = LEFT_PADDING`. When `minTimeMs > 0`, the marker appears at the data-start pixel at video `t=0:00`, ahead of the scrubber.

Observation: The correct formula is to compute raw `x = LEFT_PADDING + fraction * drawableWidth` (where fraction can be negative), then clamp the final pixel position to `[0, chartWidth]`. This allows the marker to sit in the Y-axis area for `t < minTimeMs`.

Apply when: implementing overlay markers on charts where the chart X-range `[minTimeMs, maxTimeMs]` does not start at 0. Always clamp pixel result, never clamp the fraction.

### 26. Emulator test video vs device test video have different minTimeMs

Problem: `Import Emulator Squat Video` on device R5CN30HWZFN uses a real camera video (PXL_...) which tends to have `minTimeMs ≈ 0`. The reviewer's analysis had `minTimeMs ≈ 5000ms`. Unit tests with `makeResultWithOffset()` (minTimeMs=1000) are the reliable way to prove non-zero-offset behavior.

Apply when: taking device screenshots to prove marker-offset fixes — the fix may be invisible on screen if test data has minTimeMs=0. Prioritize unit test evidence for this class of bug.

### 27. Chart marker and video scrubber must share the same timeline domain

Problem: Multiple rounds (R1-R6) tried to align the marker by mapping it to `[minTimeMs, maxTimeMs]`. The real issue was that the chart x-axis domain and the scrubber domain were different. The scrubber uses `[0, videoDuration]` (full video timeline), but the chart was implicitly using `[minTimeMs, maxTimeMs]` (data range).

Working solution: Set `axisMinimum=0` and `axisMaximum=videoDuration` on the chart x-axis. Then use `progress = t / videoDuration` for the marker (same as scrubber). Data points with `tMs > 0` naturally appear offset from the left edge.

Apply when: implementing overlay markers on time-series charts in video analysis UIs. Always make the chart x-axis domain explicit and match it to the video timeline, not the data range.

### 28. Maestro `assertVisible` does not support regex patterns in text field

Problem: Using `assertVisible: text: "Playback: 00:00 / [0-9]{2}:[0-9]{2}"` fails with "Assertion is false" even when the text is on screen.

Observation: Maestro's `assertVisible` treats the `text` value as a literal string, not a regex. Remove the dynamic part and only assert the static prefix: `text: "Playback: 00:00"`.

Apply when: writing Maestro flows that assert on time-display strings with dynamic components (seconds, minutes). Assert only the fixed prefix.

### 29. Use viewPortOffsets to pin a chart overlay marker to the Y-axis line

Problem: Hardcoding `SPEED_CHART_LEFT_PADDING = 48` to estimate the Y-axis label width was unreliable. MPAndroidChart auto-calculates the left offset based on the actual text width of Y-axis labels, which is wider than the guess (~48dp). The marker at t=0 ended up 16dp too far left, inside the label area.

Working solution:
- Add `viewPortOffsets={{ left: N, top: 4, right: 4, bottom: 4 }}` to the `react-native-charts-wrapper` `LineChart`.
- Set the overlay marker constant to the same N: `SPEED_CHART_LEFT_PADDING = N`.
- `viewPortOffsets.left = N` overrides MPAndroidChart's auto-calculated left offset and forces the drawable area to start at exactly x=N dp. The Y-axis line is at x=N by definition.
- N=64 fits Y-axis labels up to 4 digits (e.g. "-999"). No native rebuild needed — `viewPortOffsets` is already a JS-bridge prop in `react-native-charts-wrapper/lib/BarLineChartBase.js`.

Apply when: implementing an Animated overlay marker on a react-native-charts-wrapper chart and the marker must align precisely with the Y-axis line.

### 30. viewPortOffsets requires physical pixels, not dp

Problem: In round 8, `viewPortOffsets={{ left: 64, top: 4, right: 4, bottom: 4 }}` was used with raw dp numbers. MPAndroidChart's `setViewPortOffsets()` expects **physical pixels**, not dp. At density 2.75, 64dp ≠ 64px, so the forced viewport offset did not match the JS marker translateX (which is always in dp). This caused a systematic misalignment proportional to (density - 1).

Working solution:
- Convert all viewPortOffsets values to physical pixels: `Math.round(VALUE_DP * PixelRatio.get())`.
- Keep the JS overlay constant in dp: `SPEED_CHART_LEFT_PADDING = 64` (dp).
- The marker uses `translateX: SPEED_CHART_LEFT_PADDING` (in dp), which React Native converts to the same 176px at density 2.75.
- Pixel analysis (Python + Pillow) is the reliable way to verify alignment: check that the marker left edge pixel overlaps with or immediately follows the Y-axis right edge pixel.

Observation: At density 2.75 with SPEED_CHART_LEFT_PADDING=64, the Y-axis occupies x=231-235 and the marker starts at x=236 (1px gap). This gap is structural — MPAndroidChart draws the axis line into the offset region, so the marker can never perfectly overlap it using the same constant. The 1px gap (<0.4dp) is visually imperceptible.

Apply when: using `viewPortOffsets` on a react-native-charts-wrapper `LineChart` with an Animated overlay.
