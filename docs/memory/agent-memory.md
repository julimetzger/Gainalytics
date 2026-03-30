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
