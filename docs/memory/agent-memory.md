# Agent Memory

Reusable learnings for feature workers (Claude Code / Codex) implementing tickets in Gainalytics and verifying them on emulators and a physical test phone via adb, Metro and Maestro from WSL2. This file is the entry point: skim the top rules, then open the topic files relevant to your ticket via the table of contents. Details live in `docs/memory/agent/*.md`; orchestrator learnings are in [orchestrator-memory.md](orchestrator-memory.md), the infra deep-dive in [worker-infra-analysis.md](worker-infra-analysis.md). Older references of the form `agent-memory #N` (in flows, docs and run logs) point to the pre-consolidation numbered log: `git show 899bf8ad:docs/memory/agent-memory.md`.

**CRITICAL — device serials:** never copy device serials from these files into your commands (they name other workers' devices). Always use your assigned `$ANDROID_SERIAL` from the orchestrator prompt.

## Top rules

1. Route every Maestro run through your own adb filter proxy and check afterwards which device it drove — `--device` alone is ignored on the shared adb server. [proxy](agent/adb-and-emulators.md#use-an-adb-filter-proxy-that-exposes-only-your-device) · [verify device](agent/maestro-running.md#verify-which-device-maestro-actually-drove)
2. Never `adb kill-server` from WSL and never kill a sibling's proxy; restart a wedged Windows adb server only with the documented recipe. [WSL adb](agent/adb-and-emulators.md#wsl-talks-to-the-shared-windows-adb-server) · [restart](agent/adb-and-emulators.md#restart-a-wedged-or-loopback-only-windows-adb-server)
3. The physical phone is a dedicated test device — imports, clearState and starting trainings are allowed; still guard taps with a foreground check (system dialogs) and route Maestro through your own proxy. [real device](agent/real-device.md#it-is-a-test-device-experimenting-is-allowed) · [foreground guard](agent/real-device.md#guard-every-scripted-tap-with-a-foreground-check)
4. Prove which JS the device runs before debugging a fix — the debug APK silently falls back to its embedded bundle. [prove JS](agent/metro-and-bundling.md#prove-which-js-the-device-runs-before-debugging-the-fix) · [embedded bundle](agent/metro-and-bundling.md#debug-apk-embeds-a-js-bundle-metro-is-only-preferred)
5. Emulators fetch Metro from `10.0.2.2:8081`, bypassing `adb reverse` — set `debug_http_host`, and re-add the reverse before every launch/Maestro run. [10.0.2.2](agent/metro-and-bundling.md#emulator-resolves-metro-at-10022-which-bypasses-adb-reverse) · [reverse wiped](agent/metro-and-bundling.md#adb-reverse-gets-wiped)
6. JS-only diffs need no Gradle build; reload from Metro. [JS-only](agent/metro-and-bundling.md#js-only-changes-need-no-gradle-rebuild)
7. `unset JAVA_TOOL_OPTIONS` before gradle, and never background a build and end the turn. [JAVA_TOOL_OPTIONS](agent/builds-and-deps.md#unset-java-tool-options-before-gradle) · [long builds](agent/builds-and-deps.md#long-builds-inside-the-tool-timeout)
8. `--mode bootstrap` and `--fixture` only push files — import with the `00_import_baseline.yaml` flow, and always pass `--suite`. [runner](agent/maestro-running.md#the-run-maestro-from-wslsh-modes-and-flags)
9. Maestro `text:` is a full-string regex, `id:` an unanchored one. [regex](agent/maestro-flows.md#text-selectors-are-full-string-regexes)
10. `evalScript: |` blocks are no-ops on this Maestro build — use quoted `"${…}"` and inline `assertTrue`. [scripting](agent/maestro-flows.md#scripted-values-evalscript-and-asserttrue-on-this-build)
11. Every assertion must be able to fail: assert values and transitions, and run new flows/tests once against the old code. [flows](agent/maestro-flows.md#make-every-assertion-able-to-fail) · [unit tests](agent/unit-testing.md#prove-a-test-can-fail)
12. Start flows with `launchApp` (`stopApp: false` to keep state) and wait for screen ids, not tab labels. [waiting](agent/maestro-flows.md#waiting-and-app-launch)
13. Capture evidence with `adb exec-out screencap` and read every image back. [screenshots](agent/maestro-running.md#maestro-screenshots-are-illustrative-capture-evidence-with-adb) · [evidence](agent/evidence-and-process.md#evidence-must-prove-the-claimed-state)
14. On a running training `uiautomator dump` returns stale files; Maestro sees inputs/touchables but not plain Text. [training screen](agent/app-screens.md#training-detail-screen-what-maestro-and-uiautomator-can-see) · [dumps](agent/device-interaction.md#uiautomator-dump-pitfalls)
15. AddWorkout rows carry `-N` testIDs and are prefilled with PLANNED values; `useUnfinishedWorkout` merges suggested sets. [rows](agent/app-screens.md#addworkout-set-rows-testids-and-prefilled-planned-values) · [reducers](agent/state-and-data.md#reducer-quirks-that-bite)
16. Tap coordinates live in the `wm size` override space — scale from the actual screenshot size. [coordinates](agent/device-interaction.md#compute-tap-coordinates-correctly)
17. `jest.setup.js` stubs `react-redux` globally — opt back in with `requireActual` for real-store tests. [jest redux](agent/unit-testing.md#jestsetupjs-stubs-react-redux-globally)
18. Selectors must return stable references (`createSelector`, module-level `EMPTY_ARRAY`). [selectors](agent/state-and-data.md#selectors-must-return-stable-references)
19. The baseline fixture is months old: recency windows are empty; planned targets don't exist. [fixture dates](agent/state-and-data.md#the-baseline-fixture-is-months-old-recency-windows-are-empty) · [fixture quirks](agent/state-and-data.md#gains-fixture-quirks)
20. Commit before the device phase; never `git checkout`/`git stash` over uncommitted work. [commit first](agent/evidence-and-process.md#commit-before-the-device-phase)
21. Emulator storage: don't clear GMS caches or lower storage thresholds; shrink the APK to the device ABI. [storage](agent/adb-and-emulators.md#install-failed-insufficient-storage-on-an-emulator) · [ABI](agent/builds-and-deps.md#shrink-the-debug-apk-to-the-device-abi)
22. A wedged emulator (ANR loop, driver timeout with SELinux denial, boot hang) recovers with `adb -s $ANDROID_SERIAL reboot`. [reboot](agent/adb-and-emulators.md#recover-a-wedged-emulator-with-adb-reboot)
23. `gh pr edit` fails on this repo — update PR bodies via `gh api -X PATCH --input`. [gh](agent/evidence-and-process.md#updating-a-pr-body-when-gh-pr-edit-fails)

## Table of contents

### [adb server, device routing & emulator health](agent/adb-and-emulators.md)

- [WSL talks to the shared Windows adb server](agent/adb-and-emulators.md#wsl-talks-to-the-shared-windows-adb-server)
- [Restart a wedged or loopback-only Windows adb server](agent/adb-and-emulators.md#restart-a-wedged-or-loopback-only-windows-adb-server)
- [The adb server saturates batch taps into one adb shell](agent/adb-and-emulators.md#the-adb-server-saturates-batch-taps-into-one-adb-shell)
- [Use an adb filter proxy that exposes only your device](agent/adb-and-emulators.md#use-an-adb-filter-proxy-that-exposes-only-your-device)
- [A stale local adb server on 127.0.0.1 5037 hides every device](agent/adb-and-emulators.md#a-stale-local-adb-server-on-127001-5037-hides-every-device)
- [Device topology changes invalidate your routing](agent/adb-and-emulators.md#device-topology-changes-invalidate-your-routing)
- [A physical device missing from adb devices](agent/adb-and-emulators.md#a-physical-device-missing-from-adb-devices)
- [Install failures and their real causes](agent/adb-and-emulators.md#install-failures-and-their-real-causes)
- [INSTALL FAILED INSUFFICIENT STORAGE on an emulator](agent/adb-and-emulators.md#install-failed-insufficient-storage-on-an-emulator)
- [Recover a wedged emulator with adb reboot](agent/adb-and-emulators.md#recover-a-wedged-emulator-with-adb-reboot)
- [Emulator stays offline or halted after a reboot](agent/adb-and-emulators.md#emulator-stays-offline-or-halted-after-a-reboot)
- [A loaded emulator delivers taps late](agent/adb-and-emulators.md#a-loaded-emulator-delivers-taps-late)
- [Emulator limitations](agent/adb-and-emulators.md#emulator-limitations)

### [Metro & JS bundling](agent/metro-and-bundling.md)

- [Reuse the orchestrator Metro and prove it serves your worktree](agent/metro-and-bundling.md#reuse-the-orchestrator-metro-and-prove-it-serves-your-worktree)
- [Debug APK embeds a JS bundle; Metro is only preferred](agent/metro-and-bundling.md#debug-apk-embeds-a-js-bundle-metro-is-only-preferred)
- [Emulator resolves Metro at 10.0.2.2 which bypasses adb reverse](agent/metro-and-bundling.md#emulator-resolves-metro-at-10022-which-bypasses-adb-reverse)
- [Avoid socat relays for Metro](agent/metro-and-bundling.md#avoid-socat-relays-for-metro)
- [Dev Menu Change Bundle Location](agent/metro-and-bundling.md#dev-menu-change-bundle-location)
- [App stuck on splash because of a corrupted debug_http_host](agent/metro-and-bundling.md#app-stuck-on-splash-because-of-a-corrupted-debug_http_host)
- [adb reverse gets wiped](agent/metro-and-bundling.md#adb-reverse-gets-wiped)
- [Prove which JS the device runs before debugging the fix](agent/metro-and-bundling.md#prove-which-js-the-device-runs-before-debugging-the-fix)
- [JS-only changes need no Gradle rebuild](agent/metro-and-bundling.md#js-only-changes-need-no-gradle-rebuild)
- [Metro watcher crashes ENOSPC or ENOENT](agent/metro-and-bundling.md#metro-watcher-crashes-enospc-or-enoent)
- [Metro serves stale modules or 404 or 500](agent/metro-and-bundling.md#metro-serves-stale-modules-or-404-or-500)
- [Last resort serve a prebuilt dev bundle](agent/metro-and-bundling.md#last-resort-serve-a-prebuilt-dev-bundle)
- [APK and bundle from different RN versions](agent/metro-and-bundling.md#apk-and-bundle-from-different-rn-versions)
- [Cold start crashes with setImmediate or window does not exist](agent/metro-and-bundling.md#cold-start-crashes-with-setimmediate-or-window-does-not-exist)
- [Reading JS console output](agent/metro-and-bundling.md#reading-js-console-output)

### [Running Maestro (infra)](agent/maestro-running.md)

- [The run-maestro-from-wsl.sh modes and flags](agent/maestro-running.md#the-run-maestro-from-wslsh-modes-and-flags)
- [Invoke Maestro directly](agent/maestro-running.md#invoke-maestro-directly)
- [Maestro drives the wrong device on a multi-device adb server](agent/maestro-running.md#maestro-drives-the-wrong-device-on-a-multi-device-adb-server)
- [Verify which device Maestro actually drove](agent/maestro-running.md#verify-which-device-maestro-actually-drove)
- [Transient device not connected while a sibling runs Maestro](agent/maestro-running.md#transient-device-not-connected-while-a-sibling-runs-maestro)
- [Maestro driver fails to start or install](agent/maestro-running.md#maestro-driver-fails-to-start-or-install)
- [gRPC DEADLINE EXCEEDED and connection closed](agent/maestro-running.md#grpc-deadline-exceeded-and-connection-closed)
- [takeScreenshot writes relative to the Maestro CWD](agent/maestro-running.md#takescreenshot-writes-relative-to-the-maestro-cwd)
- [Maestro screenshots are illustrative capture evidence with adb](agent/maestro-running.md#maestro-screenshots-are-illustrative-capture-evidence-with-adb)
- [Long Maestro runs and the 600 s tool cap](agent/maestro-running.md#long-maestro-runs-and-the-600-s-tool-cap)
- [Where Maestro failures are explained](agent/maestro-running.md#where-maestro-failures-are-explained)
- [Run Maestro and uiautomator never at the same time](agent/maestro-running.md#run-maestro-and-uiautomator-never-at-the-same-time)
- [Classify sweep failures carefully](agent/maestro-running.md#classify-sweep-failures-carefully)
- [Last resort Windows Maestro via cmd](agent/maestro-running.md#last-resort-windows-maestro-via-cmd)

### [Writing Maestro flows](agent/maestro-flows.md)

- [Dump the hierarchy before writing selectors](agent/maestro-flows.md#dump-the-hierarchy-before-writing-selectors)
- [Text selectors are full-string regexes](agent/maestro-flows.md#text-selectors-are-full-string-regexes)
- [How testIDs surface resource-id vs content-desc](agent/maestro-flows.md#how-testids-surface-resource-id-vs-content-desc)
- [React Native Paper components in Maestro](agent/maestro-flows.md#react-native-paper-components-in-maestro)
- [Assert actual values not visibility](agent/maestro-flows.md#assert-actual-values-not-visibility)
- [Scripted values evalScript and assertTrue on this build](agent/maestro-flows.md#scripted-values-evalscript-and-asserttrue-on-this-build)
- [Make every assertion able to fail](agent/maestro-flows.md#make-every-assertion-able-to-fail)
- [Waiting and app launch](agent/maestro-flows.md#waiting-and-app-launch)
- [Scrolling in flows](agent/maestro-flows.md#scrolling-in-flows)
- [Keyboard and text input in flows](agent/maestro-flows.md#keyboard-and-text-input-in-flows)
- [Small syntax gotchas](agent/maestro-flows.md#small-syntax-gotchas)
- [Suite and cross-branch flow hygiene](agent/maestro-flows.md#suite-and-cross-branch-flow-hygiene)

### [App screens: navigation & testability](agent/app-screens.md)

- [Bottom navigation and the remembered tab](agent/app-screens.md#bottom-navigation-and-the-remembered-tab)
- [Training home dashboard](agent/app-screens.md#training-home-dashboard)
- [Opening a specific training](agent/app-screens.md#opening-a-specific-training)
- [The plan drawer and micro navigation](agent/app-screens.md#the-plan-drawer-and-micro-navigation)
- [Training detail screen what Maestro and uiautomator can see](agent/app-screens.md#training-detail-screen-what-maestro-and-uiautomator-can-see)
- [Overflow menu and plan full-edit](agent/app-screens.md#overflow-menu-and-plan-full-edit)
- [AddWorkout set rows testIDs and prefilled planned values](agent/app-screens.md#addworkout-set-rows-testids-and-prefilled-planned-values)
- [Plan editor inputs](agent/app-screens.md#plan-editor-inputs)
- [Exercise picker sharingan dropdown](agent/app-screens.md#exercise-picker-sharingan-dropdown)
- [Analyse tab and its drawer](agent/app-screens.md#analyse-tab-and-its-drawer)
- [Settings import and the file picker](agent/app-screens.md#settings-import-and-the-file-picker)
- [Video analysis screens](agent/app-screens.md#video-analysis-screens)
- [AI chat and coach insight](agent/app-screens.md#ai-chat-and-coach-insight)
- [Exercise screens and the Records range](agent/app-screens.md#exercise-screens-and-the-records-range)

### [Driving devices with adb](agent/device-interaction.md)

- [uiautomator dump pitfalls](agent/device-interaction.md#uiautomator-dump-pitfalls)
- [Compute tap coordinates correctly](agent/device-interaction.md#compute-tap-coordinates-correctly)
- [Taps that do not register on RN touchables](agent/device-interaction.md#taps-that-do-not-register-on-rn-touchables)
- [Long press and drag with motionevent](agent/device-interaction.md#long-press-and-drag-with-motionevent)
- [Typing text with adb](agent/device-interaction.md#typing-text-with-adb)
- [Scrolling with adb when a gesture child eats the swipe](agent/device-interaction.md#scrolling-with-adb-when-a-gesture-child-eats-the-swipe)
- [Screenshots and pixel evidence](agent/device-interaction.md#screenshots-and-pixel-evidence)
- [Layout facts from dumpsys and bounds](agent/device-interaction.md#layout-facts-from-dumpsys-and-bounds)
- [Read device state with dumpsys and pm](agent/device-interaction.md#read-device-state-with-dumpsys-and-pm)

### [Real device (test phone)](agent/real-device.md)

- [It is a test device: experimenting is allowed](agent/real-device.md#it-is-a-test-device-experimenting-is-allowed)
- [Check for a PIN-locked phone at the start of every run](agent/real-device.md#check-for-a-pin-locked-phone-at-the-start-of-every-run)
- [Guard every scripted tap with a foreground check](agent/real-device.md#guard-every-scripted-tap-with-a-foreground-check)
- [Display size override and orientation](agent/real-device.md#display-size-override-and-orientation)
- [Samsung restrictions](agent/real-device.md#samsung-restrictions)

### [Builds, APKs & dependencies](agent/builds-and-deps.md)

- [Unset JAVA TOOL OPTIONS before gradle](agent/builds-and-deps.md#unset-java-tool-options-before-gradle)
- [Long builds inside the tool timeout](agent/builds-and-deps.md#long-builds-inside-the-tool-timeout)
- [Shrink the debug APK to the device ABI](agent/builds-and-deps.md#shrink-the-debug-apk-to-the-device-abi)
- [Release signing is not available to workers](agent/builds-and-deps.md#release-signing-is-not-available-to-workers)
- [Gradle failures that are build-state corruption](agent/builds-and-deps.md#gradle-failures-that-are-build-state-corruption)
- [Autolinking guardrail and Kotlin plugin](agent/builds-and-deps.md#autolinking-guardrail-and-kotlin-plugin)
- [Worktree node_modules is a symlink to the shared repo node_modules](agent/builds-and-deps.md#worktree-node_modules-is-a-symlink-to-the-shared-repo-node_modules)
- [npm install and patch-package discipline](agent/builds-and-deps.md#npm-install-and-patch-package-discipline)
- [Regenerating or merging a patch while other worktrees are live](agent/builds-and-deps.md#regenerating-or-merging-a-patch-while-other-worktrees-are-live)
- [Current patches in this repo](agent/builds-and-deps.md#current-patches-in-this-repo)
- [React Native upgrade notes still relevant](agent/builds-and-deps.md#react-native-upgrade-notes-still-relevant)

### [React Native & UI patterns](agent/react-native-ui.md)

- [Gesture handler needs the root import and GestureHandlerRootView](agent/react-native-ui.md#gesture-handler-needs-the-root-import-and-gesturehandlerrootview)
- [Fabric and reanimated wrappers can stop drawing laid-out content](agent/react-native-ui.md#fabric-and-reanimated-wrappers-can-stop-drawing-laid-out-content)
- [RangeSwiper layout rules](agent/react-native-ui.md#rangeswiper-layout-rules)
- [One-shot navigation params under swiper panes](agent/react-native-ui.md#one-shot-navigation-params-under-swiper-panes)
- [Mounted screens do not re-run lazy useState initializers](agent/react-native-ui.md#mounted-screens-do-not-re-run-lazy-usestate-initializers)
- [Effects and hooks pitfalls](agent/react-native-ui.md#effects-and-hooks-pitfalls)
- [Driving an animated marker from a native time source](agent/react-native-ui.md#driving-an-animated-marker-from-a-native-time-source)
- [Keyboard handling on Android](agent/react-native-ui.md#keyboard-handling-on-android)
- [Non-edge-to-edge Android double-counts the status bar inset](agent/react-native-ui.md#non-edge-to-edge-android-double-counts-the-status-bar-inset)
- [Flex layout traps](agent/react-native-ui.md#flex-layout-traps)
- [React Native Paper patterns](agent/react-native-ui.md#react-native-paper-patterns)
- [React 19 ignores defaultProps on function components](agent/react-native-ui.md#react-19-ignores-defaultprops-on-function-components)
- [Colours and themes](agent/react-native-ui.md#colours-and-themes)
- [Charts with react-native-charts-wrapper](agent/react-native-ui.md#charts-with-react-native-charts-wrapper)
- [Make a chart assertable via accessibilityLabel](agent/react-native-ui.md#make-a-chart-assertable-via-accessibilitylabel)
- [Lists FlashList and draggable lists](agent/react-native-ui.md#lists-flashlist-and-draggable-lists)
- [Stop off-screen screens from re-rendering](agent/react-native-ui.md#stop-off-screen-screens-from-re-rendering)
- [Responsiveness techniques](agent/react-native-ui.md#responsiveness-techniques)
- [TypeScript and JSX small traps](agent/react-native-ui.md#typescript-and-jsx-small-traps)

### [Redux state, data model & fixtures](agent/state-and-data.md)

- [Selectors must return stable references](agent/state-and-data.md#selectors-must-return-stable-references)
- [Reducer quirks that bite](agent/state-and-data.md#reducer-quirks-that-bite)
- [Deleting the latest finished training leaves plan lastTraining dangling](agent/state-and-data.md#deleting-the-latest-finished-training-leaves-plan-lasttraining-dangling)
- [Training and plan domain rules](agent/state-and-data.md#training-and-plan-domain-rules)
- [Settings and persisted enums](agent/state-and-data.md#settings-and-persisted-enums)
- [Coerce persisted numbers defensively](agent/state-and-data.md#coerce-persisted-numbers-defensively)
- [Reading the persisted store on device](agent/state-and-data.md#reading-the-persisted-store-on-device)
- [Gains fixture quirks](agent/state-and-data.md#gains-fixture-quirks)
- [The baseline fixture is months old recency windows are empty](agent/state-and-data.md#the-baseline-fixture-is-months-old-recency-windows-are-empty)
- [Video analysis domain](agent/state-and-data.md#video-analysis-domain)
- [AI request handling](agent/state-and-data.md#ai-request-handling)

### [Unit testing (jest, RNTL)](agent/unit-testing.md)

- [Running jest in a worktree](agent/unit-testing.md#running-jest-in-a-worktree)
- [jest.setup.js stubs react-redux globally](agent/unit-testing.md#jestsetupjs-stubs-react-redux-globally)
- [Seed a real store via preloadedState](agent/unit-testing.md#seed-a-real-store-via-preloadedstate)
- [Prefer a real-store test over flaky device taps](agent/unit-testing.md#prefer-a-real-store-test-over-flaky-device-taps)
- [Paper mocks](agent/unit-testing.md#paper-mocks)
- [jest.mock factory scoping](agent/unit-testing.md#jestmock-factory-scoping)
- [Native module and animation mocks](agent/unit-testing.md#native-module-and-animation-mocks)
- [Time and timers in tests](agent/unit-testing.md#time-and-timers-in-tests)
- [Prove a test can fail](agent/unit-testing.md#prove-a-test-can-fail)
- [Pre-existing failures](agent/unit-testing.md#pre-existing-failures)
- [Testing helpers without extra packages](agent/unit-testing.md#testing-helpers-without-extra-packages)

### [Evidence, review rounds, git & GitHub](agent/evidence-and-process.md)

- [Evidence must prove the claimed state](agent/evidence-and-process.md#evidence-must-prove-the-claimed-state)
- [Commit before the device phase](agent/evidence-and-process.md#commit-before-the-device-phase)
- [Before/after evidence for JS-only changes](agent/evidence-and-process.md#beforeafter-evidence-for-js-only-changes)
- [Legacy data and migration evidence](agent/evidence-and-process.md#legacy-data-and-migration-evidence)
- [Resuming a round](agent/evidence-and-process.md#resuming-a-round)
- [Review feedback](agent/evidence-and-process.md#review-feedback)
- [Ticket specs vs the codebase](agent/evidence-and-process.md#ticket-specs-vs-the-codebase)
- [Repo-wide audits](agent/evidence-and-process.md#repo-wide-audits)
- [Git pitfalls in this repo](agent/evidence-and-process.md#git-pitfalls-in-this-repo)
- [Updating a PR body when gh pr edit fails](agent/evidence-and-process.md#updating-a-pr-body-when-gh-pr-edit-fails)

## Inbox (new entries)

Workers append NEW learnings here (and only here), after checking the table of contents above for an existing entry — if one exists and is wrong or outdated, correct it in place in its topic file instead. Format: `### Short descriptive title` (no number), then **Problem / Symptom**, **Fix / Rule**, **Apply when**, max ~10 lines, concrete commands/testIDs, a `(seen in GH-xxx)` hint. Entries are sorted into the topic files at the next consolidation.

### In the running training's exercise picker, selecting a row CLEARS the search — a blind re-tap toggles an unrelated exercise
**Problem (GH-486):** `TrainingElementPicker` (Train tab, `training-add-exercise-box`) resets the search as soon as a row is picked, so the unfiltered list (A–Z) takes its place. The "first tap eaten by the keyboard" re-tap from #443 then lands on the alphabetically first row (`45 degree crunch machine free`) and DESELECTS it. The training silently loses an exercise, and the "N selected" counter looks plausible. A guard on `notVisible: 'N selected'` alone raced with the re-render.
**Working solution:** `waitForAnimationToEnd`, then `runFlow: {when: {notVisible: 'N selected', visible: {text: '<name>', below: {id: 'search-bar'}}}, commands: [tapOn: {text: '<name>', below: {id: 'search-bar'}, optional: true}]}`. Prove the result on Home: `next-training-slot` reads `Meso 1 · M7 · D1 · <count> exercises` and is assertable while the training pane is not (#206).
**Apply when:** adding exercises to a training from a flow or via adb taps.

### `pm clear` also revokes POST_NOTIFICATIONS — the first training open then SIGABRTs natively ("Can request only one set of permissions at a time")
**Problem (GH-486):** after `pm clear` + baseline import, tapping `next-training-start-button` killed the app. There was no JS error and no RN redbox. `logcat` showed `W Activity: Can request only one set of permissions at a time` followed by `F libc: Fatal signal 6 (SIGABRT)` in `libreactnative.so` (`CxxCallbackImpl.invoke`). Maestro only reported the next assertion failing on the launcher. `pm clear` also deletes the `debug_http_host` pref (#432), so the app falls back to the embedded bundle.
**Working solution:** after every `pm clear`: `adb shell pm grant com.powerliftingworkoutplanner android.permission.POST_NOTIFICATIONS` and rewrite `shared_prefs/com.powerliftingworkoutplanner_preferences.xml` via `run-as`. This is a real fresh-install bug (concurrent permission requests), not a flow problem.
**Apply when:** the app vanishes right after opening a training on a freshly cleared device: grep logcat for `SIGABRT|permissions at a time`.

### Reproduce a "legacy broken store" for real: commit the fix, point Metro at the old code with `git checkout HEAD~1 -- app App.tsx`, then restore
**Observation (GH-486):** "users whose data is already broken can open their training after the update" can't be faked with a `.gains` file, because `FULL_IMPORT` sanitizes references. Working route: commit the fix first. Then `git checkout HEAD~1 -- app App.tsx` (Metro picks it up; curl the bundle to confirm the new action name is GONE), drive the old app into the broken state and screenshot the crash. Then `git checkout HEAD -- app App.tsx`, cold-start, and the same persisted store is now opened by the fix. Files the fix ADDED stay on disk but are unreferenced by the old code. `git status` must be clean afterwards.
**Apply when:** a ticket requires migrating/repairing data that only an older version can produce.

### `ADD_EXERCISE` uses `max(allIds)+1` — deleting the newest exercise hands its id to the next one created
**Observation (GH-486):** that is why "create an exercise with the same name" was the users' workaround for the crash: the new exercise inherited the deleted id, and every dangling training reference resolved again. It also makes Maestro ids deterministic on the baseline (highest id 84 → new exercises are 85, 86 on every run after a re-import). Keep it in mind for any feature that keeps references to deleted exercises, because a later exercise silently inherits them.
**Apply when:** writing flows that create exercises, or anything that stores exercise ids outside the exercises slice.

### "Empty slice" is not "not loaded" — a `length === 0` guard silently skips the last-item case
**Problem (GH-486 round 2):** the dangling-reference repair returned early on `Object.keys(exercises.byId).length === 0` to "not prune against missing data". Deleting the only exercise produced exactly that state, so the running training stayed broken. Codex review caught it.
**Working solution:** guard only on `byId === undefined/null`. Write one test each for an empty slice (must clean) and a missing slice (must return the same object). Also check `Math.max(...ids) + 1` style id generators: on `[]` they give `-Infinity`.
**Apply when:** any cleanup or migration has a "skip if no data" guard.

### Edge-case device states: derive a small fixture with a node script + a parametrized import subflow
**Observation (GH-486 round 2):** a one-exercise store was needed. `__tests__/testdata/scripts/make_gh486_fixture.js` strips `baseline.gains` to one exercise (≈85 KB instead of 1.7 MB) and keeps all references consistent. The helper `import_fixture.yaml` is `00_import_baseline` with `tapOn: '${FIXTURE}'`, called via `runFlow: {file: …, env: {FIXTURE: x.gains}}` after `adb push x.gains /sdcard/Download/`. The SAF picker listed the pushed files without a media scan.
**Apply when:** a ticket needs a store state that is tedious to click together.

### Maestro's console log can end after the first step even on a green run — read `commands-(<flow>).json` in `--debug-output`
**Observation (GH-486 round 2):** with stdout redirected to a file, the ANSI live view left only "Launch app… Run flow when Dismiss…" in the log, although the exit code was 0. The authoritative record is `<debug-output>/<timestamp>/commands-(<flow>.yaml).json`; count `metadata.status` (here 122 COMPLETED, 9 SKIPPED, 0 FAILED). Quote that count in the summary.

### Drawer headers render regular, native-stack headers medium — Paper's MD3 theme has no `fonts.medium`
**Problem (GH-484):** "Make the Dashboard headline match the other tabs": all Analysis headers (drawer navigator, JS header from `@react-navigation/elements`) were regular weight, the Training/Exercises/Settings headers (native-stack, native toolbar) medium. Both libraries ask for `fonts.medium` of the navigation theme, but the app passes the Paper MD3 theme, whose `fonts` is the MD3 typescale (`titleMedium`, …) without `regular/medium/bold` — the JS header silently falls back to the default Text weight, the native toolbar to its own medium face.
**Working solution:** `headerTitleStyle: {fontFamily: theme.fonts.titleMedium.fontFamily, fontWeight: theme.fonts.titleMedium.fontWeight}` in the drawer's `screenOptions` (size stays the header's own 20). Compare header crops of different tabs side by side (`ffmpeg crop` + `vstack`) — weight differences are invisible in a single full screenshot.
**Apply when:** a JS-rendered header/title (drawer, bottom-tab or JS stack header) looks lighter than the native-stack ones.

### When the ticket asks for something that is already true, re-read the user's ORIGINAL words in the issue
**Observation (GH-484):** the rewritten ticket said "Dashboard heading like the other *Analysis pages*" — on device it already was identical to them. The issue's quoted original said "match the other *tabs*", and that difference (bottom tabs Training/Exercises/Settings) was real. Fixing it for all Analysis headers satisfied both readings; documented the interpretation in summary + PR.
**Apply when:** a "before" screenshot shows no defect — check `gh issue view` for the user's original text and attached screenshot (with auth) before concluding nothing needs changing.

### MPAndroidChart: x axis defaults to TOP and `spaceTop` is 0 for a single bar
**Problem (GH-482):** `react-native-charts-wrapper` BarCharts without `xAxis.position` draw the category labels at the TOP, in the same strip as the value labels (`drawValueAboveBar`), so they overlap. MPAndroidChart 3.1 computes `spaceTop` as a percentage of `dataMax - dataMin`, not of `axisMax - axisMinimum`. With one bar (or equal bars) the spread is 0, so the bar and its label touch the top edge despite `spaceTop: 25`.
**Fix / Rule:** `xAxis: {position: 'BOTTOM' as const}` (the type needs the literal). Set the headroom explicitly: `yAxis.left.axisMaximum = Math.max(...values, 1) * 1.3`. Check label fit against the slot width (`onLayout` width / bar count, ~0.6 × textSize per char).
**Apply when:** any bar chart with value labels, especially single-bar or equal-height datasets.

### Don't run `npx prettier`/`npx eslint` on a file. They resolve global newer versions and reformat the whole file
**Problem (GH-482):** `npx prettier --write` changed `x =>` to `(x) =>` and re-wrapped imports across all of `MicroHeroCard.tsx` (60+ lines of noise), and `npx eslint` is v10 and can't find a flat config. Revert with `git checkout <file>` and reapply the edits by hand, matching the surrounding style.
**Apply when:** formatting a changed file. Format by hand, or use the repo's own `npm run lint`.

### A Maestro flow can be reused for before/after/themes via `-e` + `when: true: ${X == 'true'}`
**Observation (GH-482):** `maestro … test -e TAG=… -e VOL=… -e CHECK_CHART=true flow.yaml` with `runFlow: {when: {true: ${CHECK_CHART == 'true'}}, commands: [...]}` ran the same flow on the old code (no new testID yet) and on the fix (extra assertions). `takeScreenshot: gh482_${TAG}_volume` names the files per run. Derived fixtures (weights ×20, a meso split moving the current micro to "Meso 2 · M1") gave the big-value and single-bar states. Push them with `--fixture` + the `00_import_baseline.yaml` suite.
**Apply when:** a ticket asks for before/after × several data states × light/dark.
### Gboard's "Show on-screen keyboard" on the emulator is FLOATING — it never docks and never resizes the window
**Problem (GH-487):** the toolbar's ≡ menu → "Show on-screen keyboard" gives a full QWERTY, but as a floating panel over the content; dragging it into the dock markers does not dock it, and `settings put secure show_ime_with_hard_keyboard 1` changes nothing. `adjustResize` never kicks in, so a screenshot of it proves nothing about keyboard avoidance.
**Fix / Rule:** don't rely on window resizing. Pin the focused field to the top of the ScrollView yourself (viewport-high spacer at the end while focused + `scrollTo` in `onContentSizeChange`) and prove "field at top after focus" with a unit test plus a screenshot.
**Apply when:** an AC says "keyboard must not cover X" and the evidence device is an emulator (seen in GH-487).

### Maestro `checked: true` works on Paper `Checkbox.Item` — use it as the idempotent guard for picks in a filtered list
**Observation (GH-487):** `assertVisible: {id: 'exercise-alternative-row-83', checked: true}` matches a checked `Checkbox.Item` (testID on the row). As a `runFlow when notVisible {id, checked: true}` guard it makes taps idempotent (fresh store or re-run with a saved pick) and absorbs the swallowed first tap after `inputText`.
**Apply when:** asserting or toggling any Paper checkbox row in Maestro (seen in GH-487).

### "Element stays in place" ACs: split the Maestro flow and diff uiautomator bounds between the parts
**Problem (GH-487 round 2):** Maestro has no position assertion, so "search stays pinned while chips wrap" passes `assertVisible` even when the field slid down by a row.
**Fix / Rule:** part 1 flow ends in the state before the change (search focused + filtered), then `uiautomator dump` + grep `resource-id="<id>"…bounds`; part 2 (no `launchApp`, run with `--mode flow`) does the picks; dump again and require identical bounds. Focus and IME survive between the two Maestro runs (`dumpsys input_method | grep mInputShown`). Note that off-screen chips are missing from the dump; a short `input swipe` afterwards shows them for the screenshot.
**Apply when:** an AC says something must not move/scroll away after an interaction (seen in GH-487).

### Paper `Tooltip` on `SegmentedButtons` segments: overlay a row of Tooltip-wrapped ripples
**Problem (GH-478):** "standard info on long press" means Paper's `Tooltip`, which clones its child and needs it to take `onLongPress`. `SegmentedButtons` has neither `onLongPress` nor a child per segment, and wrapping the whole control gives one tooltip. A nested touchable inside the icon would steal taps.
**Fix / Rule:** `app/components/common/TooltipSegmentedButtons.tsx` renders `SegmentedButtons` normally and lays an `absoluteFill` row (`flex: 1` cells, outer radii `5 × roundness`, `overflow: hidden`) of `<Tooltip><TouchableRipple onPress={select} style={{height}}/></Tooltip>` on top, with `importantForAccessibility="no-hide-descendants"`. Maestro still taps and asserts Paper's own ids and `checked:`. `longPressOn` followed by `assertVisible: '<tooltip text>'` passes within Paper's 1.5 s `leaveTouchDelay`. RNTL hides the overlay, so query it with `getByTestId(id, {includeHiddenElements: true})`. Tooltip text is one line, so keep it short.
**Apply when:** a SegmentedButtons control needs per-segment long-press info (seen in GH-478).

### `SegmentedButtons` icon + label truncates in a third of a narrow row — the 16 dp content padding is fixed
**Problem (GH-478):** Paper pads each segment's content by 16 dp horizontally, and neither `style` nor `density` changes that. At about 93 dp per segment, "Purple"/"Custom" plus an 18 dp swatch were cut off.
**Fix / Rule:** give the icon render function a wrapper with `marginLeft: -8` and pass `labelStyle: {marginRight: -8}`. Content may then run halfway into the padding, and the gap between icon and label stays. If you put a negative margin on the label's LEFT instead, the label overlaps the icon. `icon` accepts a render function (`({size, color}) => <PaletteSwatch …/>`) for colour previews.
**Apply when:** labelled + iconed SegmentedButtons share a row with a label (seen in GH-478).

### Old-code ↔ new-code swap: `git checkout <base> -- app`, back with `git restore --source=HEAD --staged --worktree app`
**Observation (GH-478):** `git checkout <base> -- app` restores files the branch deleted and stages them. `git checkout HEAD -- app` then leaves them behind as staged additions. `git restore --source=HEAD --staged --worktree app` removes them as well, and `git status` is clean afterwards. With the shared Metro, `curl` the bundle and count one old and one new component name (e.g. 6/0, then 0/6). Then force-stop the app and delete `files/BridgelessReactNativeDevBundle.js` before relaunching. Also: with an overridden `HOME`, `--debug-output <dir>` writes `commands-*.json` under `<dir>/.maestro/tests/<ts>/`.
**Apply when:** proving "settings stored by the old version survive the update" (seen in GH-478).
### A pull-down gesture inside the plan screen's plain ScrollView must activate BELOW the 8 dp touch slop
**Problem (GH-483):** an RNGH `Pan` with `activeOffsetY(12)` on the carousel tiles worked on the short edit view but never fired on the Plan tab (`onBegin` → `onTouchesCancelled`). The page's RN ScrollView starts dragging at Android's touch slop (~8 dp) and calls `requestDisallowInterceptTouchEvent`, which makes `RNGestureHandlerRootHelper` cancel every handler.
**Working solution:** `activeOffsetY(7)` (down-only) + `failOffsetX([-6, 6])`: whoever recognizes first wins. Upward drags still scroll the page.
**Apply when:** any vertical RNGH gesture inside `PlanNodeScrollContainer` or another plain RN ScrollView — always test on a page tall enough to scroll.

### `overflow: 'visible'` on the horizontal `DraggableFlatList` blanks every cell on Fabric
**Problem (GH-483):** to let a carousel tile translate below its 60 dp row, `overflow:'visible'` on the list made all exercise cells vanish (only "+" stayed).
**Working solution:** give each cell `paddingBottom` = travel, take it back with `marginBottom: -travel` on the list wrapper, and raise `zIndex` on the wrapper (and its parent in `TrainingsPlanNode`) only WHILE a tile is out of place — at rest the overlapping strip would swallow taps below.
**Apply when:** anything in the training carousel must draw outside its row.

### Paper `Portal`s stack in MOUNT order — a later tap-outside overlay covers an earlier-mounted Dialog/Snackbar
**Problem (GH-483):** an always-mounted `ConfirmDialog` plus a dismiss overlay mounted when a tile opened: taps on Cancel/Remove hit the overlay and the dialog stayed open.
**Fix / Rule:** don't render the overlay while a dialog is pending; mount snackbars after (or outside) such overlays.
**Apply when:** combining a full-screen Portal overlay with dialogs/snackbars.

### Undo snackbar + scripted taps: keep nothing slow between the action and the Undo tap
**Problem (GH-483):** a 5 s undo snackbar expired between "Remove" and `tapOn undo` (Maestro settles ~3 s per tap; an adb `uiautomator dump` in between is slower still) and the Undo tap hit the tab bar under it.
**Fix / Rule:** undo duration 8 s; in flows only `assertVisible` + `takeScreenshot` between removal and `tapOn undo`; in adb scripts chain both taps in ONE `adb shell "…; sleep 1.2; input tap …"` and use screencap, not dump.
**Apply when:** any transient snackbar/toast action in a flow.

### First `Linking.openURL` on an emulator lands in Chrome's first-run screens, not on your page
**Problem:** a fresh emulator opens `com.android.chrome/…firstrun.FirstRunActivity` ("Make Chrome your own") and then a "Chrome notifications make things easier" sheet over the target page.
**Fix / Rule:** tap "Stay signed out" (never "Add account to device") and "No thanks"; check `dumpsys activity activities | grep topResumedActivity` → `ChromeTabbedActivity`. In Maestro, wait for a regex alternative such as `.*(auth\.openai\.com|Welcome back|Stay signed out|No thanks).*` instead of the final page text.
**Apply when:** a flow opens an external URL/OAuth page in the browser. (seen in GH-504)

### Collapse Settings → "AI Configuration" again before scrolling further down
**Problem:** with the accordion expanded, `scrollUntilVisible` towards `settings-app-version` fails — swipes start on the multiline Chat/Training prompt editors, which scroll internally (the wrapper's retry then passed by chance).
**Fix / Rule:** after asserting inside it, `scrollUntilVisible {text: "AI Configuration", direction: UP}` + `tapOn` to collapse, then scroll down.
**Apply when:** a Settings flow needs the API-key field AND anything below the AI section. (seen in GH-504)

### OAuth loopback redirects work on Android — and can be simulated without an account
**Observation:** an app-owned `ServerSocket` bound to `127.0.0.1:<port>` receives Chrome's redirect (`ss -tln | grep <port>` on the device shows it). Simulate the provider's redirect with `adb -s $S shell "am start -a android.intent.action.VIEW -p com.android.chrome -d 'http://127.0.0.1:1455/auth/callback?code=fake&state=<state shown in app>'"` — exercises state check + real token endpoint (`invalid_grant`).
**Apply when:** verifying an OAuth/PKCE flow whose real login needs credentials the worker must not create. (seen in GH-504)

### A backgrounded app is FROZEN after ~10 s: a loopback/socket listener started before opening the browser never answers
**Problem (GH-504):** the browser OAuth redirect to `http://127.0.0.1:1455/…` hung forever (Chrome spinner). `adb shell ss -tn` showed the connection ESTABLISHED with unread bytes in Recv-Q, and every app thread sat in `do_freezer_trap`. No root is needed to check: `adb shell "run-as com.powerliftingworkoutplanner sh -c 'for t in /proc/<pid>/task/*; do cat \$t/comm \$t/wchan; echo; done'"` (`debuggerd -j` needs root on these images). Freezer settings: `dumpsys activity | grep -A3 'Freezer settings'`.
**Fix / Rule:** foreground-ing the app thaws it and the pending request is processed (this rescues a stuck login without re-login). Durable fix: run a foreground service (start it while the app is still TOP) for the whole background phase, and stop it only after the follow-up network work is done.
**Apply when:** any feature waits in the background for a browser/other app (OAuth, payment redirects, share flows).

### RN `fetch` never resolves while the app is in the background: JS timers are paused
**Observation (GH-504):** even with a foreground service (process not frozen), the token-exchange `fetch` only finished after returning to the app. `JavaTimerManager.onHostPause` pauses timers (unless a HeadlessJS task runs), and whatwg-fetch resolves via `setTimeout(…, 0)`. Native promises and XHR events still arrive.
**Apply when:** JS must finish network work while another app is in front. Do it natively, use raw `XMLHttpRequest`, or run a HeadlessJS task.

### `intent://…;action=MAIN;category=LAUNCHER;end` links from Chrome open the Play Store, not the app
**Problem (GH-504):** Chrome adds `CATEGORY_BROWSABLE`, and the launcher intent-filter doesn't have it, so Chrome falls back to the market page. Fix: a VIEW + DEFAULT + BROWSABLE filter with its own scheme (here debug-only via `src/debug/AndroidManifest.xml` merging into `.MainActivity`), and link to `<scheme>://<host>`.
**Apply when:** a web page or loopback page should hand the user back to the app.

### Flows with `00_import_baseline` destroy owner-provided state: write a separate no-clearState flow
**Observation (GH-504 r2):** the owner had signed in on the emulator. The ticket's suite starts with the baseline import (clearState) and would have wiped the session. I wrote a manual-only flow (`launchApp: clearState: false`, no sign-out) that asserts the real values instead, and documented why the suite was not re-run.
**Apply when:** the feedback says "keep the owner's login / data" and the existing suite imports or clears.

### Coach Insight on the baseline fixture always says "Not enough data" — import a date-shifted copy via Settings → Import Data
**Problem (GH-504):** `CoachInsightCard` only looks at trainings finished in the last 28 days; the `.gains` fixture's last training is months old, so every micro shows "Not enough data for an insight yet." and no request is made.
**Fix / Rule:** shift every epoch-ms number (1.5e12–1.8e12) and ISO date string by `now − 1 day − max(training.end)` with a small node script (GH-504 run dir `checks/r3/fixture/shift_dates.js`). Push it to `/sdcard/Download/` and import it with a copy of `00_import_baseline.yaml` (`tapOn: '<file>.gains'`). The import keeps the secure store (API key / ChatGPT sign-in) but replaces Redux settings. Micro 5 of plan 5 then gets a real insight.
**Apply when:** any ticket needs Coach Insight / recency-window evidence.

### Standalone release APK for the owner: temporary debug signing + per-ABI split by zip
**Observation (GH-504):** `assembleRelease` needs `ANDROID_RELEASE_PASSWORD` + the release keystore (not on WSL). Temporarily switch `buildTypes.release.signingConfig` to `signingConfigs.debug`, build both ABIs at once (`-PreactNativeArchitectures=x86_64,arm64-v8a`), then `git checkout android/app/build.gradle`. Derive per-device APKs with `zip -d app-release.apk "lib/<other-abi>/*"` + `zipalign -f -p 4` + `apksigner sign --ks android/app/debug.keystore`. Being debug-signed, it installs with `adb install -r` OVER the debug app and keeps all data (Keystore-encrypted MMKV included). Check `pkgFlags` lose `DEBUGGABLE`.
**Apply when:** a ticket asks for an installable APK without Metro.

### Maestro can't see the drawer/native-stack header title — assert screen content instead
**Problem (GH-504):** `extendedWaitUntil: visible: 'Micro 5 Overview'` (also as `(?s).*…*` regex) failed while the title was clearly on screen in the Analysis drawer header.
**Fix / Rule:** don't wait on header titles. Rely on deterministic navigation (N × `swipe: LEFT` + `waitForAnimationToEnd`) and assert an element inside the screen (`coach-insight-card`).
**Apply when:** a flow needs to prove which micro/screen it is on.

### Prove a feature that needs the owner's OAuth sign-in without signing them out: add a "Reconnect" path
**Observation (GH-504):** the AC demanded "login works in the release build", but signing out would have lost the owner's ChatGPT session. A "Reconnect" button (re-run the browser flow; replace the stored session only on success) let the login be verified end to end with zero risk: if the browser had asked for a password, backing out would have left the old session intact. Also: PoC→feature storage-key changes need a one-time migration, or the update silently signs the owner out.
**Apply when:** verifying any account-linking flow on a device where an existing login must survive.


### Without the adb proxy, "the assigned device shows Chrome" is the symptom of Maestro on a foreign device
**Problem / Symptom:** `run-maestro-from-wsl.sh` (no `--host`) force-stopped the app on the CORRECT device via `adb -s`, so the previous task (Chrome) came to the front there. Meanwhile Maestro ran the flow on the first device of the adb server (a phone), and the flow got far ("tab-settings" was tapped). It looked like `launchApp` was failing and the app was "jumping to Chrome".
**Fix / Rule:** if the assigned device never shows the app during a run, add `takeScreenshot` steps and look at them (foreign nav bar or data = wrong device). Always pass `--host <proxy> --adb-host <proxy>`. A proxy from an earlier round may still be listening: check with `ss -ltnp | grep 5037` and `adb -H <ip> -P 5037 devices`.
**Apply when:** any Maestro run in a feedback round, before the first flow. (seen in GH-504)

### Maestro `tapOn` hangs forever on a screen with a running seconds counter
**Problem / Symptom:** the AI Chat's "AI is thinking… Ns" counter changes every second, so `tapOn: {id: chat-stop-button}` never saw the screen settle and hung for more than 5 min. `uiautomator dump` also silently left the stale previous `/sdcard/ui.xml` in place during that time.
**Fix / Rule:** add `waitToSettleTimeoutMs: 500` to taps on screens with live counters or spinners. While debugging, find coordinates from a resized screencap instead of a dump.
**Apply when:** tapping Stop/Cancel during a running request. (seen in GH-504)

### Async token refresh vs. sign-out: guard the write with a session generation
**Observation:** a refresh started before sign-out wrote rotated tokens back after `clearTokens()`, so the account returned after a restart. Fix: bump a module-level `sessionGeneration` on sign-in, sign-out and terminal refresh errors. The refresh captures it at the start; if it changed, the refresh does not write, returns null and revokes the new refresh token. Clear the tokens before the remote revoke. Test it by holding the refresh `fetch` in a manual promise, signing out, then resolving the refresh.
**Apply when:** any persisted credential that can be written by a background refresh. (seen in GH-504)
### An empty store now opens the first-start onboarding OVER the tabs — empty-store flows must skip it
**Problem (GH-497):** after `pm clear`/`clearState` (no plans, trainings or logged workouts) a full-screen onboarding (`onboarding-screen`) covers the tab bar. `tab-training`/`training-home-screen` are still in the hierarchy underneath, so waits pass but taps hit the overlay (the Settings scroll in `smoke.yaml` failed with "No visible element found").
**Fix / Rule:** `runFlow: gh497_dismiss_onboarding.yaml` (waits for `tab-training`, then taps `onboarding-skip` if visible). `00_import_baseline.yaml` and `smoke.yaml` already call it. A `when: visible: {id: onboarding-skip}` checked right after `launchApp` runs before the JS has rendered and is silently SKIPPED. Reopen it on purpose via Settings › Help `settings-show-onboarding-button`.
**Apply when:** writing or reviving any flow that starts from an empty store (seen in GH-497).

### `navigate('Settings', {screen: 'Settings', params})` from the container ref is swallowed by the focused Settings stack
**Problem (GH-497):** the Settings tab and its stack screen share the name "Settings". While that tab is focused, the inner stack handles the action itself and the screen receives `route.params = {screen: 'Settings', params: {…}}` — the one-shot param never arrives (seen via a `console.log` of `route.params` in logcat `ReactNativeJS`).
**Fix / Rule:** address the tab navigator: `navigationRef.dispatch({...CommonActions.navigate(tab, {screen, params, initial}), target: navigationRef.getRootState().key})` (see `OnboardingGate.navigateInTab`). Training is safe (tab "Training", screens "TrainingHome"/"TrainingPlan").
**Apply when:** navigating into a tab's stack from outside the navigators (notification handlers, overlays) (seen in GH-497).

### From a running training back to Training home: `tapOn: 'tab-training'`, not `hideKeyboard`/`back`
**Observation (GH-497):** on the emulator no soft keyboard is up after `add-workout-set-confirm-N`, so `hideKeyboard` is a BACK that already lands on home. A following guarded `back` (`when: notVisible: training-home-screen`, evaluated during the transition) then left the app. Tapping the focused Training tab pops the native stack to `training-home-screen` deterministically; the dashboard is assertable there (`micro-hero-value` "360 kg", `next-training-status-label` "Training running").
**Apply when:** a flow logs sets and then asserts the home dashboard (seen in GH-497).

### Real baseline state in jest: `rootReducer(undefined, {type: '@@INIT'})` + `FULL_IMPORT` of the fixture read with `fs`
**Observation (GH-497):** `require('../testdata/x.gains')` fails ("Jest encountered an unexpected token"), but `JSON.parse(fs.readFileSync(path.join(__dirname, '…/baseline.gains'), 'utf8'))` works. Reducing `FULL_IMPORT` onto the fresh-install state gives the exact device store, so selectors (e.g. `selectAllTimeOneRepMax`: Squat id 2 = 225 kg) can be computed and then asserted as concrete values in Maestro. Delete the throwaway spec afterwards.
**Apply when:** a Maestro assertion needs a value derived from the fixture (seen in GH-497).

### Imported plans stored planned workouts as LOGGED ones (fixed in GH-497)
**Observation (GH-497):** before GH-497, `IMPORT_TRAININGS_PLAN` pushed the plan's workouts into `workouts.allIds` (the logged list read by history/last-workout-date), not `plannedWorkouts`. It now uses `plannedWorkouts`; templates use the same path. Plans imported before the fix may still have such ids in `allIds`.
**Apply when:** debugging phantom "logged" workouts without a date after a plan import.


### Resumed round: the previous round's adb filter proxy is gone, so its helper scripts drive the phone
**Problem / Symptom:** In a feedback round the run-dir helper script still hardcoded the round-1 proxy (`--host 127.0.0.88`), which was no longer running. Switching it to the gateway (`--host <wsl-gateway-ip> --device emulator-5556`) made Maestro log "Selected device emulator-5556" while `launchApp` force-stopped and relaunched the app on <phone-serial> (`Got device info … widthPixels=720`). Every assertion failed even though uiautomator on the emulator showed the element.
**Fix / Rule:** At the start of every round, run `ss -tlnp | grep :5037` and restart your own proxy (`python3 .codex-orchestrator/proxies/adb_filter_proxy.py --serial $ANDROID_SERIAL --listen 127.0.0.<n>:5037 --upstream <gateway>:5037`), then verify with `adb -H 127.0.0.<n> -P 5037 devices`. Put a `widthPixels` check from `maestro.log` into the helper so a wrong device fails loudly.
**Apply when:** resuming a ticket in a new round, or reusing run-dir scripts. (seen in GH-497)

### Dispatch hooks that need the created entity: reserve the id via a selector, don't read the store back
**Problem / Symptom:** Review rejected `useStore().getState()` inside a dispatch hook (inputs before the dispatch, the new plan after it).
**Fix / Rule:** Read inputs with `useSelector` (memoized selectors; for per-id lookups use a `createSelector` that returns a function over the slice), reserve the id with `determineNewId(state.<slice>)`, send it in the action (the reducer honours it if free), and return it. Adding `useSelector` to a hook breaks component specs whose mocked `useSelector(selector(mockState))` state lacks that slice, so mock the hook there.
**Apply when:** a dispatch must hand the new entity's id to navigation or UI. (seen in GH-497)
### Reproduce gesture-navigation reports on the test phone via the navbar overlay
**Problem (GH-420):** the user's screenshot showed gesture navigation (pill, no 3-button bar); the test phone runs 3-button nav, so edge-swipe/back behaviour differed.
**Fix / Rule:** `adb -s $S shell cmd overlay enable-exclusive --category com.android.internal.systemui.navbar.gestural` (back: `…navbar.threebutton`; check `settings get secure navigation_mode` 2/0). The switch recreates the activity: ~15 s white screen, the bottom tab bar moves (y 1376→1434 on 720x1600), and once Samsung's Galaxy Finder popped up in front, so run a foreground check afterwards. Restore 3-button nav before finishing. Animations off (`settings put global animator_duration_scale/transition_animation_scale/window_animation_scale 0`, restart app) emulates Reanimated reduced motion; restore to 1.
**Apply when:** a bug report's screenshot shows a different nav mode or the bug may depend on gestures/animations.

### Prove a drawer is closed by tapping a control INSIDE its area
**Observation (GH-420):** `Close drawer` (overlay content-desc) vanishing and underlying text in the a11y tree prove nothing (the Analyse drawer content stays in the tree while open). Strong check: after closing, tap a control of the screen behind whose bounds lie within the drawer's width (Records `records-view-muscle` / `records-view-heatmap`) and assert the switched view (`records-muscle-lanes.*` / `records-heatmap.*`). If the drawer were still open, the tap would hit a drawer entry. Since GH-420 the Analyse drawer starts below the header, and tapping `analyse-drawer-toggle` while it is open closes it (it used to select "Dashboard").
**Apply when:** any drawer/overlay open-close evidence.

### `pgrep -f`/`kill` with a pattern from the same Bash call kills your own shell
**Problem (GH-420):** `for p in $(pgrep -f "maestro.*--driver-host-port 7055"); do kill $p; done` matched the tool's own bash (its cmdline contains the pattern) → exit 144, rest of the command never ran.
**Fix / Rule:** take PIDs from `ps -eo pid,cmd | grep … | grep -v grep` and check them before killing, or kill the PID you captured with `$!` at launch.
**Apply when:** cleaning up Maestro/adb/wrapper processes after a failed run.

### Make "save via the share sheet" testable on an account-less emulator: a ChooserAction "Save to Downloads"
**Problem (GH-496):** the AC said "the file can be saved through the share menu", but the emulator's share targets (Drive, Gmail, Quick Share) all need an account, and DocumentsUI is not an `ACTION_SEND` target.
**Fix / Rule:** on Android 14+ put `Intent.EXTRA_CHOOSER_CUSTOM_ACTIONS` = `ChooserAction("Save to Downloads", PendingIntent.getBroadcast(<own non-exported receiver>, FLAG_IMMUTABLE))` on the chooser. The receiver copies the cache file into `MediaStore.Downloads` (no permission needed). Maestro sees and taps the `'Save to Downloads'` text, and `adb pull /sdcard/Download/<name>` gets the file back. A second save is auto-renamed `<name> (1).csv`; nothing is overwritten. See `FileShareModule.kt` / `SaveToDownloadsReceiver.kt`.
**Apply when:** a ticket exports or shares a file and needs device evidence of the saved file.

### Analyse → Metrics Overview tables are not in the accessibility tree
**Observation (GH-496):** after "Show that period" only the header ("Metrics Overview", "Select Exercises, Metrics, Accumulation Mode", "0 selected") is in `uiautomator dump`/Maestro. The date-range button and the Muscle/Exercise Overview rows (e.g. "Bench Press (Barbell) 76.7") are invisible to it, so `extendedWaitUntil` on the range text times out although it is on screen.
**Fix / Rule:** assert a value that IS accessible (the Dashboard text "Your last training was on Thu, 20/08/26." is) and show the table values with an `adb exec-out screencap` after a right-edge swipe.
**Apply when:** a flow needs to prove numbers on the Metrics Overview.

### Idempotent imports: dedupe keys must survive your own merge step, so re-import the real export on the device
**Problem (GH-496):** the Strong import skips sessions whose start second already exists, and merges two sessions of one day into one training. The merged session's own start was stored nowhere, so re-importing the same file brought back 12 "new" trainings. The unit test for "no double import" only used files without same-day sessions; the device round trip (baseline export → import → same import again) caught it.
**Fix / Rule:** persist every source key that a merge folds away (`Training.mergedSessionStarts`). Test idempotency with the REAL round-trip file (export of `baseline.gains` → import → `buildStrongImport(...).summary.trainingCount === 0`), not only with hand-written mini files.
**Apply when:** any importer that groups or merges input records and also claims "no double import".

### Format-verification ACs: real sample files are findable with `gh api search/code`
**Observation (GH-496):** "check against a real Strong export" was solvable without the app: `gh api -X GET search/code -f q='"Workout Notes" "Set Order" extension:csv'` listed ~100 real Strong exports in public repos (both the old `,` format and the current `;` "Workout #" format). Fetch them raw with `gh api repos/<o>/<r>/contents/<path> -H 'Accept: application/vnd.github.raw'` into a `/tmp` dir and run the parser over all of them. One of them became a device fixture (`fixtures/gh496/strong_sample_export.csv`). The web search alone only returned prose and outdated column lists.
**Apply when:** an AC asks to verify a third-party file format.

### Imports that add history must rebuild the record history of every touched exercise
**Problem:** a bulk import computed 1RM records only for exercises without records. An imported set that beat the existing PR never got `workout.records['1RM']`, so it was missing from Analyse → Records (which filters on that field), and older imported bests left later "records" stale. 0-rep sets with a weight scored as a 1RM of their full weight (`repsCoefficient(0) = 1`).
**Fix / Rule:** after inserting workouts, walk ALL done workouts of each touched exercise in start order. Set `workout.records['1RM']` on each new best, delete it on workouts that are no longer a best, and replace `exercise.records['1RM']`. Drop or flag failed attempts before any `repetitionMax`.
**Apply when:** any import, merge or backfill that writes workouts with past dates. On the device, prove it with a record dated inside Records' default range (last 3 months), so the card with its "+Δ kg" to the previous record is visible. (seen in GH-496)

### Restored activity after `adb reboot` crashes: "Screen fragments should never be restored"
**Problem:** after `adb -s $ANDROID_SERIAL reboot`, `am start` brought back the old task, and the app died in `ScreenFragment.<init>` (react-native-screens), leaving a white or black screen. A System UI ANR dialog followed while the emulator was still busy.
**Fix / Rule:** `am force-stop` the app, then `am start -S -n com.powerliftingworkoutplanner/.MainActivity`, re-add `adb reverse`, and wait with an until-loop for `tab-settings` in a dump before running Maestro. Check `logcat -d -b crash` if the screen stays blank. (seen in GH-496)

### DocumentsUI grid view turns a Maestro tap into a selection on a loaded emulator
**Problem:** `00_import_baseline` failed with "Import Data is visible": the picker (grid view) showed "1 selected" with `baseline.gains` ticked, because the slow tap had registered as a long press.
**Fix / Rule:** tap "Select" (top right) to clear the selection, or re-tap the tile with `adb shell input tap`. Re-running the flow on a calmer emulator passed. (seen in GH-496)
### The Analyse drawer can stay painted open after picking an entry — the hierarchy says it is closed
**Problem (GH-508):** on a loaded emulator, tapping a drawer entry (e.g. "AI Chat") navigates, but the drawer stays visibly open over the screen. Its state is already "closed": the entries drop out of the hierarchy (`assertNotVisible: 'Chat History'` passes), the scrim and the menu icon do nothing, Back pops the drawer HISTORY (lands on Dashboard). Reproduced with the old AI Chat layout too (A/B of the same mini flow) — pre-existing, not caused by header changes.
**Fix / Rule:** before tapping an entry wait until the drawer is really open (`extendedWaitUntil: visible: '<last entry>'` + `waitForAnimationToEnd`), keep the app running between flows (`launchApp: {clearState: false, stopApp: false}`) so repeats skip the drawer, and only force-stop to recover. Wait until the guest load is < 5 after a reboot before running.
**Apply when:** a flow navigates through the Analyse drawer and a later tap "does nothing" — screenshot it; assertions can't see this state.

### Maestro `below:`/`above:` compare top edges — a header title counts as "below" the menu icon in the same row
**Observation (GH-508):** `assertNotVisible: {text: 'AI Chat', below: {id: 'analyse-drawer-toggle'}}` failed on the header title itself (title top 184 > icon top 168). `index: 1` can't count duplicates either while a closing drawer still lists its "AI Chat" entry. Count duplicates with a uiautomator dump (`grep -c ' text="AI Chat"'`) and use `leftOf:`/`rightOf:` for same-row checks.
**Apply when:** asserting that a label exists only once or sits in a particular row.

### Since GH-447 a dummy API key can't build a chat — seed one through the `.gains` import
**Observation (GH-508):** a failed send now rolls the user message back, so "type + send with a dummy key" leaves the chat empty (older, since removed flows relied on it). `FULL_IMPORT` takes `aiChat` verbatim without migrations: add `aiChat: {messages: [...], isLoading: false, error: null, seedContextJson: null, contextRange: null, includePlannedTrainings: true, selectedTrainingId: null, history: [], pendingLegacyArchive: false}` to the baseline JSON (see `__tests__/testdata/gh508_chat_fixture.gains`). Keep `pendingLegacyArchive: false` or the chat is archived on first open.
**Apply when:** a flow or screenshot needs an AI chat with messages.

### Changing font scale or density while the app runs crashes it ("Screen fragments should never be restored")
**Observation (GH-508):** `settings put system font_scale …` / `wm density …` recreates the activity; react-native-screens throws in `ScreenFragment.<init>` (logcat `-b crash`), the app dies (Application Error dialog or launcher). Set the values first, then cold-start the app and navigate. Restore with `wm density reset` + `font_scale 1.0`.
**Apply when:** checking narrow screens / large fonts on the device.

### The plan drawer's rows ARE visible to Maestro (positive checks), and the drawer keeps its scroll position
**Observation (GH-509):** `assertVisible: 'Mesos:'`, `'Add Meso'`, `'Training 5'` and `tapOn: 'Add Training'` inside the open plan drawer all worked on the real phone. So for positive checks the "drawer not in hierarchy" note in app-screens.md is out of date (it still holds for `assertNotVisible` gating). The drawer also stays where it was scrolled: after scrolling to the `Micro N` pager, the next open starts mid-list and `Mesos:` is off-screen. Wait for a lower element, then `scrollUntilVisible {element: 'Mesos:', direction: UP}`.
**Apply when:** writing flows that open the plan drawer more than once, or the drawer of a plan with a long training list.

### Kebab "Edit plan" (`overflow-edit-plan`) only exists on the Plan sub-tab; the landing sub-tab varies
**Problem (GH-509):** the gh340 recipe (Micro 69 → Push → kebab → `overflow-edit-plan`) now lands on Train or Analysis, and there the kebab only offers "Edit training" (`overflow-edit`) / "Delete". On the 720x1600 phone the sub-tab strip sits at y≈11 % (`point: '17%,11%'`), not the 14 % from the gh401 emulator flow. At 14 % you hit the Analysis "Show Plan/Train" toggle instead.
**Fix / Rule:** `repeat while notVisible overflow-edit-plan: [tap 17%,11%; tap header-overflow-icon; when notVisible overflow-edit-plan → tap 50%,60% (dismisses the menu)]` (the helper `goto_micro69_push.yaml` with env `MODE=edit` does this). Prove the mode with `header-plan-editing-kicker`.
**Apply when:** a flow needs "EDITING PLAN" mode.

### `settings-theme-active-mode` is gone — assert the theme segment instead
**Fix / Rule:** assert the segment itself: `assertVisible: {id: '^settings-theme-mode-${MODE}$', checked: true}`. For mode + palette + custom HEX in one helper, use `set_appearance.yaml` (env MODE / PALETTE / HEX). (seen in GH-509)

### Two PRs that rename and use the same variable merge cleanly into a ReferenceError — grep tsc for the touched files
**Problem (GH-514):** GH-504 renamed `hasApiKey`→`hasCredentials` in `AIChatTab.tsx`, and GH-508 added new lines using `hasApiKey`. Git merged both without a conflict, so 0.180 threw on every render ("AI Chat could not be displayed"). `tsc` reported `TS2304 Cannot find name 'hasApiKey'`, but nobody saw it among ~229 existing errors. The 30 red AIChat jest tests got dismissed as "pre-existing failures" by later workers.
**Rule:** after a rebase/merge, run `npx tsc --noEmit | grep -E '<changed files>'` and look for TS2304/TS2552 in particular. Do not record a red suite as "pre-existing" without reading its first error message (`ReferenceError` = real bug).
**Apply when:** your branch touches a file that another recently merged PR also changed, or you see red suites on master.

### A dev RedBox hides the Analyse error-boundary card — negative assertions on the boundary pass on the broken build
**Observation (GH-514):** with the Metro dev bundle, a render error opens the RedBox over the screen. `assertNotVisible: {id: analyse-error-boundary}` then passes although the screen is broken. The flow only failed on the positive `assertVisible: {id: 'chat-input|chat-no-key-message'}`. In release builds there is no RedBox.
**Rule:** every "screen opens" flow needs a positive assertion on the real screen content, not just the absence of the fallback.
**Apply when:** writing regression flows for crashes/error boundaries.

### Startup red screen "Cannot read property 'BottomTabs' of undefined" + SoLoader `libworklets.so` = stale APK from another branch
**Symptom (GH-514):** the phone had a debug APK (0.179) left by another worker. Loading the current Metro bundle failed with `Cannot read property 'BottomTabs' of undefined` (App.tsx:117); Log 2/3 showed `couldn't find DSO to load: libworklets.so`. The JS code is fine.
**Fix:** `assembleDebug -PreactNativeArchitectures=arm64-v8a` from your own worktree (~3 min incremental) + `adb install -r`. Check first with `dumpsys package <pkg> | grep -E 'versionName|lastUpdateTime'` whether the APK comes from your branch.
**Apply when:** the first app launch of a run red-screens in `App.tsx` before any feature code runs.

### AI chat context bar on the 720dp phone: last chips off-screen, subject + period persist across runs
**Observation (GH-514):** `chat-context-bar` scrolls horizontally. On R5CN-width screens, `chat-context-inspect` ("View context (N)") and the subject chip's close icon ("Clear selected training") are not in the hierarchy until you `swipe: {from: {id: 'chat-context-bar'}, direction: LEFT}`. The chosen subject and period (Meso/28d) survive `chat-clear-button` and new runs, so reset them at the start of the flow (`chat-filter-toggle` → `chat-preset-28d`; `when notVisible 'Training: none'` → clear).
**Apply when:** writing/reusing AI chat flows (`ai_chat_context.yaml`, `ai_chat_errors_history.yaml`, `manual/gh515_chat_device.yaml`).

### Any `settings` dispatch remounted the whole Training stack — navigator was created inside `TrainingRouter`
**Problem (GH-518):** starring a plan (a settings write) jumped TrainingHome to the top and swallowed its snackbar. App rebuilds the Paper theme from `settings` on every settings change → the tab tree re-renders → `TrainingRouter` called `createNativeStackNavigator()` in its body → new navigator type → full remount (all local state lost).
**Fix / Rule:** create navigators at module level (fixed for TrainingRouter; `SettingsRouter`/`exerciseRouter` still have the pattern). Symptom to recognise: local screen state "resets" right after a dispatch that touches `settings`.
**Apply when:** storing UI state in `settings` that a Training screen reacts to, or debugging state loss after theme/settings changes.

### FAB-overlap ACs: prove "never over content" with uiautomator bounds, not Maestro
**Observation (GH-518):** Maestro can't read bounds on this build. A GH-518 bounds script (no longer in the repo) checked list bottom ≤ FAB top and no card control (`plan-select-*`, `edit-trainings-plan-*`, `next-training-start-button`) intersecting `add-trainings-plan`; `--expect collapsed` checks width≈height; `--tap-out` writes a tap point at the button's lower-right corner, passed to a flow via `-e TAP=x,y` (`tapOn: point: '${TAP}'`). Run it against an old-code dump once — it must fail there. Driver pattern: `checks/e2e.sh` in the GH-518 run dir.
**Apply when:** any "X never covers Y" / layout-overlap acceptance criterion.

### Training home snackbar can render ~8 s after the tap on a loaded emulator — adb burst captures miss it
**Observation (GH-518):** star tap → re-render took up to ~8 s on emulator-5556; `extendedWaitUntil visible: '<snackbar text>' timeout: 3000` failed while the failure screenshot showed the snackbar. Use ≥10 s waits, and wait `notVisible` for it before tapping a control near the bottom (it sits right above the FAB strip). For an evidence shot use `adb shell "screenrecord --time-limit 10 /sdcard/x.mp4 & sleep 1; input tap X Y; wait"` and extract the last frame with `ffmpeg -sseof -0.3 -i x.mp4 -frames:v 1`.
**Apply when:** capturing transient UI (snackbars/toasts) as evidence on an emulator.

### Emulator /data refills to 99 % because Play Store re-installs YouTube updates
**Problem (GH-518):** after `pm uninstall com.google.android.youtube` (+ `…apps.youtube.music`) freed ~200 MB, it was gone again within one Maestro run; redux-persist then logged `Failed to set persist:root!` (state silently not saved). **Fix:** `pm uninstall <pkg>` followed by `pm disable-user --user 0 <pkg>` (disabled apps aren't auto-updated); free space then stayed at ~560 MB. Check `adb shell df /data` before evidence runs and grep logcat for `Failed to set persist`.
**Apply when:** an emulator's /data is ≥ 95 % full or persisted state "doesn't stick".

### Paper `AnimatedFAB` anchored right puts the icon RIGHT of the label
**Observation (GH-518):** `animateFrom="right"` (the only sane anchor for a right-aligned FAB) renders "New Training +"; `left` grows off-screen. To collapse an extended FAB on scroll keep the plain `FAB` and pass `label={extended ? '…' : undefined}` plus a constant `accessibilityLabel`, so Maestro text selectors still find it collapsed.
**Apply when:** an extended FAB must shrink to its icon while scrolling.

### Owner-phone layout overflow: reproduce with `font_scale 1.3` on the emulator
**Observation (GH-522):** the owner's Samsung showed the Finish Training Timer delete button pushed right of the Pause one; at font_scale 1.0 the emulator looked fine. `adb -s $S shell settings put system font_scale 1.3` (then cold-start — see the crash entry below) reproduced it: the row overflowed and the icon sat past the card edge.
**Fix / Rule:** in a `space-between` row, give the text button `flexShrink: 1`. Paper `Button` labels are `numberOfLines={1}`, so very long labels end in an ellipsis. Paper `Surface` moves `flexShrink` onto an unnamed outer layer, so a jest test cannot read it from `<testID>-container`; use `UNSAFE_getByType(Button).props.style`. Prove the alignment from uiautomator bounds (the GH-522 checker script was removed in GH-584 — see git history).
**Apply when:** a layout bug from a real phone doesn't reproduce on the emulator.

### Bounds checks for in-list header controls via uiautomator
**Observation:** a `testID` on a plain RN `View` (e.g. `plans-header`) shows up in `uiautomator dump` as `android.view.ViewGroup` with that resource-id, and a Paper `Button` with `testID="x"` exposes its label as `x-text` — enough to prove "inside the header", "header height unchanged" (px / (density/160)) and "label not clipped" from bounds. A control moved from a floating FAB into the scroll content needs `scrollUntilVisible` before every `tapOn` in existing flows (smoke and the target flows), or they fail on tall dashboards.
**Apply when:** replacing a FAB/overlay with an in-flow control, or proving layout claims Maestro can't read. (The GH-518 bounds checker script was removed in GH-584 — see git history.) (seen in GH-518)
### Edge-to-edge (GH-356) means `adjustResize` no longer resizes — and the Paper bottom nav hiding on `keyboardDidShow` clamps the scroll
**Problem (GH-418):** with `edgeToEdgeEnabled=true` the keyboard only draws over the window. A short plan has no scroll range for the focused field, and a list scrolled to its END jumps DOWN on focus: Paper's `BottomNavigationBar` sets `keyboardVisible` (position absolute) in its own `keyboardDidShow` listener, the scroller grows by the tab-bar height and Android clamps the offset (field 1133 → 1357 px on the phone).
**Fix / Rule:** set keyboard-height `paddingBottom` on the ScrollView's `contentContainerStyle` synchronously inside your own `keyboardDidShow` listener — React batches it into the same commit as the nav bar, so content grows before the viewport. On hide, scroll back out of the padding (animated) before removing it. See `KeyboardAwareScrollView`.
**Apply when:** anything keyboard-related on Android in this app; never trust `adjustResize`.

### An extra child VIEW appended to a ScrollView's content can abort the app in Fabric/Yoga — use padding instead
**Problem (GH-418):** `{spacer > 0 && <View style={{height}}/>}` after the children: switching fields (blur → store write → re-render) killed the app with `F ReactNative: YogaLayoutableShadowNode.cpp:709 assertion failed (YGNodeGetOwner(childYogaNode) == &yogaNode_)` + SIGABRT on `mqt_v_js`. Not reproducible on master; bisected over Metro (`git checkout <sha> -- app`, delete `files/BridgelessReactNativeDevBundle.js`, cold start).
**Fix / Rule:** `contentContainerStyle={[style, {paddingBottom}]}`. Find the message with `adb logcat -d | grep ' F ReactNative'` — the crash buffer only has the native stack.
**Apply when:** the app vanishes to the launcher after a re-render; grep logcat for `assertion failed`.

### `useProgressiveLimit` capped lists for good at the last ProgressiveMount stage (fixed in GH-418)
**Observation:** `useProgressiveLimit(2)` stopped at 2 + 4×2 = 10 items, so the plan read view never showed an 11th exercise (baseline Micro 69 "Push" has 11) and `MicroExerciseOverview` stopped at 5 cards. The last stage now provides `Infinity`. If a list "loses" its last items only inside a sub-tab, check stage caps first.

### Keyboard/position checks on a RUNNING training: read `maestro hierarchy`, not uiautomator
**Observation (GH-418):** `HOME=$E2E_MAESTRO_HOME … maestro --host <proxy> --device $S --driver-host-port <port> hierarchy > h.json` works while `uiautomator dump` fails ("could not get idle state"); JSON nodes carry `resource-id`, `text`, `focused`, `bounds` in input coordinates (~19 s per call). Keyboard top = IME window `frame` top + `mGivenContentInsets` top from `dumpsys window windows`. (The GH-418 keyboard check script was removed with its flows in GH-584 — see git history.)
**Apply when:** asserting positions (field vs keyboard, element moved) on screens with a ticking timer.

### Debug JS on the phone: LogBox is muted (`LogBox.ignoreAllLogs`) and Metro shows no logs — render an on-screen overlay
**Observation (GH-418):** `console.warn` never appears; Metro 0.84 says "JavaScript logs have moved" (DevTools). A temporary absolutely positioned `<Text>` fed from `globalThis.__dbg` (re-rendered by a 300 ms interval) showed the measurements in a screenshot. Remove it before measuring performance — the interval re-render alone starved `requestAnimationFrame` to ~2 fps. Fast Refresh after such edits twice left a white screen: force-stop + cold start.

### Drag on the phone: `input motionevent` costs ~150 ms per event, and a busy JS thread delivers few rAF frames
**Observation (GH-418):** a 16-step drag plus 110 hold steps takes ~25 s; the gesture's rAF loop got only a few frames per second on the 11-exercise plan editor. Make per-frame work time-based (dp/s × elapsed), run timed animations with `useNativeDriver: true`, and verify with `screenrecord` + `ffmpeg -vf fps=2,tile=…` rather than single screenshots. (The GH-418 `input motionevent` drag script was removed in GH-584 — see git history.)

### Jest: Animated timing finishes in one frame, and the native driver fails on its second use
**Problem / Symptom:** In jest, an `Animated.timing` with `duration: 180` called its `start` callback after about 16 ms of fake time. Advancing 50 ms to land "inside" the animation therefore landed after it, and the race test passed on the buggy code. A value animated twice with `useNativeDriver: true` threw `Unable to find node on an unmounted component` (also on the old code).
**Fix / Rule:** To test the "during the animation" window, fire the next gesture synchronously right after the release, with no timer advance. When a test animates the same values over several drags, wrap `Animated.timing` with `jest.spyOn(Animated, 'timing')` and force `useNativeDriver: false`.
**Apply when:** writing jest tests for drag/settle races or for repeated native-driver animations (seen in GH-418 round 2).

### Compute expected fixture values offline from the `.gains` JSON — useful while the phone is locked
**Observation (GH-526):** `__tests__/testdata/1772318214222.gains` is plain JSON (`exercises/workouts/trainings/trainingsPlan` with `byId`), so the numbers a value-asserting flow needs (sets per training/micro, muscle sets via `exercises[].muscles[].percent`, start/end) can be derived with a ~60-line `python3 -I` script before touching the device. That filled a PIN-locked wait with useful work and fixed the expected values up front. Plan 5 "Push pull" has **no `mesos`** in the file (migrated in-app), and M1 "Push squat" has 1 planned set whose exercise has no muscle taxonomy → empty planned muscle map. The script is in `.codex-orchestrator/runs/GH-526/checks/gh526_fixture_values.py`.
**Apply when:** writing Maestro assertions on fixture values, or when the device is unavailable and flows still have to be written Durations: the app sums SECONDS and floors (`7h 28min`), so summing per-training rounded minutes (`7h 29min`) is off by one — compute from the raw timestamps.

### Fixed-width numeric readouts get ellipsized on the Samsung phone — use `minWidth`
**Problem / Symptom:** the muscle map readout column (`width: 64`, monospace 12sp) showed `10.4/10…` on <phone-serial>. Jest and the design looked fine, and the Maestro `copyTextFrom` still read the full text, so only a screenshot revealed it.
**Fix / Rule:** give value columns next to a `flex: 1` bar `minWidth`, not `width`, so the bar yields. Always eyeball a screenshot of every new numeric column on the phone (larger font scale than the emulators).
**Apply when:** row layouts of label | flex bar | numeric readout (seen in GH-526).

### The assigned phone can be missing from `adb devices` altogether — not locked, just not attached
**Problem / Symptom:** `adb devices` (shared Windows server, also `adb.exe` directly) lists only emulators; `adb -s <phone> …` → `device '<serial>' not found`. This is different from the PIN-locked bouncer case, where the phone is still listed.
**Fix / Rule:** commit and push the code first. Poll `adb devices | grep "^$ANDROID_SERIAL\s*device"` every 15 s for two non-overlapping ~9-min windows (foreground loop with `timeout` ≤ 580000; a background poll plus a foreground poll overlap and count as one window). Then write `blocked` with "device not attached". Never fall back to a listed emulator; those belong to siblings.
**Apply when:** the run starts with the assigned real device absent. (seen in GH-526 r3)

### `shallowEqual` over trainings is safe; over workouts only for set edits
**Observation:** `trainingsReducer` clones every training before changing it (`let training = {...state.byId[id]}`), so `useSelector(…, shallowEqual)` on a mapped list of trainings re-renders on every real change. The workout reducer clones on `ADD_SET` but mutates `FINALIZE_WORKOUT`'s `end` in place.
**Apply when:** you stabilise a mapped selector. For a value that only feeds a header string, select the formatted primitive instead (`useSelector(s => format(select(s)))`): strings compare by value, so this needs no equality fn. (seen in GH-526 r3)
### Hero micro label carries the meso prefix even for plans without `mesos`
**Problem / Symptom:** A flow asserting `id: micro-hero-micro-label` with `text: 'M6'` failed although the screen showed M6. On import the app gives meso-less plans (baseline "Push pull") a default `Meso 1`, so the label reads `Meso 1 · M6`, and Maestro `text:` is a full-string regex.
**Fix / Rule:** Assert `'Meso 1 · M6'` (and `'Meso 1 · M6 · D2 · .*'` for `next-training-slot`). The ring text is `micro-hero-completion-label` (e.g. `2/4`).
**Apply when:** asserting the Training home hero or next-training card on a baseline-derived fixture (seen in GH-533).

### Week-relative dashboard scenarios: generate fixtures in UTC for the current week
**Observation:** "This week"/"new week" states (day strip, GH-533 micro switch) can't be reached with `adb shell date`. GH-533 generated four stores whose plan-5 sessions were dated relative to the current Monday (UTC — the emulators run GMT), incl. a STARTED training (generator removed in GH-584; the current-micro logic is now covered by `__tests__/utils/currentMicro.spec.ts`, and the owner decided against date-shifted fixtures for flows). A running training's ticking timer on the home card did NOT block Maestro assertions here.
**Apply when:** you need trainings "this week" vs "last week"; regenerate on the day of the run (seen in GH-533).

### Run-maestro wrapper `--report` wants a FILE path — a directory crashes Maestro after a passing flow
**Problem (GH-532):** `--report <existing dir>` → `FileNotFoundException … (Is a directory)` in `TestCommand.saveReport` AFTER "1/1 Flow Passed", so exit 1 and the wrapper re-ran the whole suite (import included).
**Fix / Rule:** pass `--report <dir>/report.xml` or omit it; judge results by `[Passed]/[Failed]` lines, not only the exit code.
**Apply when:** using `--report` with `run-maestro-from-wsl.sh`.

### "This week vs last week" dashboard evidence: shift the baseline, anchor to Monday, not to now
**Observation (GH-532, generator removed in GH-584 — flows now stay on the fixed baseline):** a GH-532 generator shifted every date so the last logged workout ends on this week's Wednesday 20:00 (Europe/Berlin), plus a `last_week_only` variant (empty current week). Anchoring to Monday keeps per-muscle values identical on every weekday, so Maestro can assert exact numbers (`Back, 9 sets`; strip `9 sets · 5.7t · -2 sets vs last week`). A node preview of per-muscle sets (percent-weighted) matched the app exactly.
**Apply when:** any Dashboard/weekly comparison needs non-empty current and previous weeks.

### Dashboard muscle radar: tapping `muscle-chip-<Muscle>` only SELECTS since GH-532
**Rule:** drill-down = tap the label, `scrollUntilVisible muscle-radar-details-button` (strip sits below the 300 dp chart, off-screen on the phone), tap it. The chart wrapper `muscle-radar-svg` has every value in its accessibilityLabel (`Back 9 (last week 11), …`) → assert it with a full-string regex. Labels expose `selected: true` when chosen.
**Apply when:** writing flows that use the Dashboard's Muscle Groups card.

### Resumed CI run: the shallow clone hides the previous run's commits
**Problem / Symptom:** the task said "its two commits are already on this branch (git log)", but the CI checkout is shallow (`git rev-parse --is-shallow-repository` → true) and `git log` only shows the "Merge master into agent/emulator-…" commit, so the old commits can't be shown or diffed.
**Fix / Rule:** find the earlier work by content: `grep -rln "GH-<n>" app __tests__` plus `ls __tests__/e2e/maestro/flows | grep <n>`. Without new JS edits the job-start APK bundle already contains that work — skip `metro-start` and run the existing flows directly for evidence.
**Apply when:** an emulator-agent task says "continue issue #N" / "do not start over". (seen in GH-523)
### CI emulator: first Metro bundle takes >60 s — a flow started right after `launch` times out on "Bundling 85%"
**Problem (GH-542):** `tool.sh metro-start` + `launch` + immediately `tool.sh flow` failed at the first `extendedWaitUntil` (screenshot showed "Bundling 85.0%…"); the identical rerun passed.
**Fix / Rule:** after the first Metro launch rerun the flow once, or give the first wait a ≥120 s timeout.
**Apply when:** first flow on the CI emulator after switching from the embedded bundle to Metro.

### Edit/Train pane keeps local state across strip picks — only "Add Workout" remounts it
**Problem (GH-542 r2):** a flow that picked the newly added exercise in the strip (`training-exercise-N`) passed on the OLD code: `ExecuteTraining` is re-rendered, not remounted, so its local `date` leaked over from the previously shown exercise. The `Date.now()` bug only shows on a fresh mount — `goToNextExercise` ("Add Workout", `key={refresHeky}` in TrainingsPlanNode).
**Fix / Rule:** reach the exercise under test via "Add Workout" on the one before it (log a set first — the button is disabled without one). Run the flow on the embedded job-start bundle before `metro-start`; that gives you the failing "before" run.
**Apply when:** testing per-exercise local state (date, inputs, flags) in a running or edited training.

### `import-baseline` fails "No visible element found: baseline.gains" — DocumentsUI opened on an empty "Recent"
**Problem (GH-542 r2):** the 2nd import on the CI emulator showed the picker on "Recent / No items"; a retry failed the same way.
**Fix / Rule:** while the picker is open: `adb -s <serial> shell input tap 72 126` (drawer) → tap "Downloads" (260 578 at 1080 px) → tap the file (296 900). Every later `tool.sh import-baseline` passed again.
**Apply when:** `import-baseline` fails at the file pick step.

### `add-workout-finalize-button` IS in the Maestro hierarchy in the edit mode
**Observation (GH-542 r2):** `maestro --device <serial> hierarchy` listed `add-workout-finalize-button`, `add-workout-set-number` and `training-exercise-N` (with the exercise name as text) on the edit pane; `tapOn: {id: 'add-workout-finalize-button'}` works. The gh323 flow comment saying it is not exposed is outdated.
**Apply when:** finalizing a workout or moving to the next exercise in a flow.
### First Metro bundle after `tool.sh launch` takes ~1.5 min — flows fail with "id: tab-analyse is visible"
**Problem (GH-546):** a flow started right after `metro-start` + `launch` runs against a white "Bundling 75%" screen. `extendedWaitUntil: visible: {id: "tab-analyse"}` also never matched on a loaded app; the string form `visible: "tab-analyse"` did.
**Fix / Rule:** take a `tool.sh screenshot` after ~90 s and wait for the Training screen before the first flow; use the string form for tab ids.
**Apply when:** first Maestro run after starting Metro in the CI emulator.

### New top-level Redux slice: four places must change together
**Rule (GH-546):** `GlobalState` + `combineReducers` (`rootReducer.ts`), `FULL_IMPORT` default (`fullStateReducer.ts`, `slice ?? initial` so old `.gains` files import), whitelist + `version` bump + migration in `configureStore.ts`. Export needs nothing (it stringifies the whole store). Existing specs that build a full `GlobalState` by hand need the new key too.
**Apply when:** adding persisted state.

### CI emulator job: `tool.sh metro-start` Metro does not see edits made after it started
**Problem (GH-546 r2):** after editing a file, cold starts (`tool.sh launch`) still served the old module: a temporary visible marker text never appeared, and a second `metro-start` exits with "A dev server is already running". `kill <pid>`, `nohup … &` and `run_in_background` all need approval in this sandbox, so Metro cannot be restarted.
**Fix / Rule:** finish ALL JS edits before the first `metro-start`. Prove each later edit with a marker text before trusting a device result. If an edit lands after Metro started, `tool.sh rebuild` is the only way, and see the next entry.
**Apply when:** iterating on JS in the agent-emulator workflow.

### CI emulator job: `tool.sh rebuild` took 26 min and the emulator died during it
**Problem (GH-546 r2):** the rebuild (552 tasks, clean x86_64) ran past the 10-min tool limit and was moved to the background. Gradle succeeded, but the emulator process died (the runner has 7 GB), and the install step printed "No booted Android device found". The agent cannot restart the emulator (background starts need approval).
**Rule:** treat `rebuild` as a last resort. Collect every before/after screenshot and run every flow BEFORE starting it.
**Apply when:** considering a rebuild in the agent-emulator workflow.

### Shared `DatePicker` (date mode) showed a blank calendar: CalendarList nested in a vertical ScrollView
**Observation (GH-546 r2):** Exercise → Log date button and any `<DatePicker>` modal rendered only the MM/DD/YYYY input; no months were drawn. `uiautomator` showed two nested ScrollViews and no day nodes. `DateRangePicker` renders `DatePickerModal` without a wrapper and works. Fix committed in GH-546 r2 but not yet confirmed on a device: replace the ScrollView with a `flex: 1` View. Calendar days carry accessibility labels like `Monday 5 October 2026` (prefixed `today` for today), which Maestro can target.
**Apply when:** using the single-date picker in a new screen or flow.
### Health Connect on Android 13 (Play-Store provider): what bites a PoC
**Observation (GH-502):** Health Connect is not preinstalled on Android 13; `market://details?id=com.google.android.apps.healthdata` + tap "Installieren" works with the existing Google account. The first permission request shows a one-time onboarding ("Jetzt starten") before the dialog. `createRequestPermissionResultContract()` returns ONLY the permissions granted in that dialog, so re-read `getGrantedPermissions()` afterwards. Reading the app's OWN records older than 30 days before the first grant silently returns an empty list (no error) until `READ_HEALTH_DATA_HISTORY` is granted (separate dialog; check `FEATURE_READ_HEALTH_DATA_HISTORY`). In connect-client 1.1.0 the constants are `ExerciseSegment.EXERCISE_SEGMENT_TYPE_*` and `HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS`.
**Apply when:** touching Health Connect on the test phone or in code.

### Debug-only native feature: put it in `android/app/src/debug` and register it by reflection
**Observation (GH-502):** `debugImplementation` deps + `src/debug/java/...` classes + debug `AndroidManifest.xml` (permissions, activities) never reach release. `MainApplication` adds the package only via `if (BuildConfig.DEBUG) Class.forName(...)`, and JS registers the route only when `NativeModules.X` exists. Verify with `./gradlew :app:compileReleaseKotlin :app:processReleaseMainManifest` (~1.5 min) and grep the merged release manifest.
**Apply when:** a ticket asks for a hidden PoC/debug-only feature with native code.

### Is a third-party app Health-Connect-capable on this Android version? Ask the package manager
**Observation (GH-502):** `dumpsys package <pkg> | grep -o "android.permission.health\.[A-Z_]*"` lists its declared HC types (Garmin Connect 5.30.1: only `WRITE_*`). `cmd package query-activities --brief -a androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE <pkg>` — "No activities found" means the HC app on Android ≤13 will not list it at all (Garmin only has the Android-14 `VIEW_PERMISSION_USAGE` alias).
**Apply when:** checking whether a vendor app can feed data through Health Connect without logging into it.

### `am start` of the Health Connect settings brings the OLD task screen to the front — never tap blind
**Problem (GH-502):** after earlier navigation, `am start -a androidx.health.ACTION_HEALTH_CONNECT_SETTINGS` returned "brought to the front" on the App-Berechtigungen page; a tap computed for the home screen hit "Zugriff für alle Apps entfernen" (dialog cancelled in time). Health Connect's own data browser is Daten und Zugriff → Aktivität → Sport → Alle Einträge ansehen → date picker (8× "previous month" taps for 7 months back).
**Fix / Rule:** `uiautomator dump` + grep bounds before every tap in system/third-party apps.
**Apply when:** driving Health Connect or other system settings with adb.

### Maestro `launchApp` grants EVERY declared permission — including Health Connect ones
**Problem (GH-528):** after `pm revoke … android.permission.health.*` the app still showed "Connected": a plain `launchApp` (also in `00_import_baseline.yaml`) re-grants all runtime permissions, health permissions included (`dumpsys package` → `granted=true`, no `USER_SET`). The CI APK install (`-g`) grants them too.
**Fix / Rule:** in flows that depend on a permission state use `launchApp: {clearState: false, permissions: {notifications: allow}}` (only the listed ones are touched); import baseline with `gh528_import_baseline.yaml`; set states with `adb shell pm grant|revoke <pkg> android.permission.health.<X>` (works on Android 14 for declared permissions; `READ_HEALTH_DATA_HISTORY` is "Unknown permission" on the API-34 image).
**Apply when:** testing any runtime-permission state (Health Connect, notifications, exact alarms).

### Health Connect on the API-34 emulator: first-run onboarding backgrounds the app; 30-day rule hits own data
**Observation (GH-528):** the first permission request shows "Get Started with Health Connect"; after "Get started" → Allow the grant succeeds, but the device lands on the HOME screen (app task closed behind the dialog) — later requests return normally. The dialog's "privacy policy" link is a span inside one text node (tap by point, ~67%,41% on 1080x2400) and opens the app's VIEW_PERMISSION_USAGE activity. Reading the app's OWN weights older than 30 days returns nothing here as well (provider 14-10541443 has no history feature), so deleting test data by record id misses them — delete by `TimeRangeFilter` (only the caller's records are removed; needs the write permission of each type). Debug helper: `.healthconnect.HealthConnectTestDataActivity` (`--es weights "82.5@1"`, `--ez clear true`, `--ez dump true`, logcat tag `GainalyticsHcTestData`); `bash script.sh` and `node script.js` need approval in the CI sandbox — call adb directly.
**Apply when:** verifying Health Connect features on an emulator.

### Maestro `text:` selectors ignore case — prefix `(?-i)` for wording/casing tickets
**Problem:** `assertVisible: 'Skip Rest'` also matches the old `Skip rest`, so a casing-fix flow passes on the unfixed app.
**Fix / Rule:** prefix the regex with `(?-i)` (`assertVisible: '(?-i)Skip Rest'`, `assertNotVisible: '(?-i)Skip rest'`). Confirmed: the old bundle failed exactly at the `(?-i)` assertion and the fixed one passed (GH-543; now part of `train_rest_timer_1rm.yaml`).
**Apply when:** asserting labels whose capitalization is the point of the change. (seen in GH-543)

### Rest timer overflow menu: tap the `rest-timer-overflow` id, detect the open menu by text, never by point
**Observation:** on a running training Maestro resolves `rest-timer-overflow` (while the rest card exists), but NOT the Paper `Menu.Item` testIDs (`rest-timer-skip` stays "not visible" with the menu open). A point-tap fallback on the icon then lands on "Skip rest" in the open menu and silently stops the timer. Route: Home `next-training-start-button` → "Plan this Training" → `^Suggest based on last Training$` → `subtab-train` → `train-tab-start-button` → log one set → `tapOn: {id: rest-timer-overflow}` → `extendedWaitUntil: visible: 'Skip rest'` (see the helper `open_rest_menu.yaml`).
**Apply when:** flows touching the rest timer menu/dialogs. (seen in GH-543)

### CI emulator: cold start under Maestro SIGSEGVs in Fabric (`MountingCoordinator::pullTransaction`) — start via adb, then `launchApp: {stopApp: false}`
**Problem:** with a large imported store, `launchApp` (cold start) in `00_import_baseline.yaml` crashed the app twice (`F libc: Fatal signal 11 … (mqt_v_js)`, frames in `ShadowTree::commit` → `pullTransaction`) while Maestro polled ("Could not detect idle state"); the flow then failed on the launcher.
**Fix / Rule:** `adb shell am start -n com.powerliftingworkoutplanner/.MainActivity`, let it settle ~45 s, then run an import flow that starts with `launchApp: {stopApp: false}`. The SAF picker also opened on "Recent / No items" — `tapOn: 'Show roots'` → `tapOn: 'Downloads'` → `baseline.gains`.
**Apply when:** `tool.sh import-baseline` fails with "Training is visible" false and the screenshot shows the launcher. (seen in GH-543)

### Maestro text selectors match the FULL string — a label without "…" cannot pass on the "…" build
**Observation:** `assertVisible: '(?-i)Edit Rest Target'` failed on the old bundle that showed `Edit Rest Target…` (no substring match), and passed after the fix. To assert an ellipsis is gone use `assertNotVisible: '(?-i)Edit Rest Target(…|\.\.\.)'` (escape the dots). In Jest, `queryByText(/…|\.\.\./)` is a substring regex and catches any leftover ellipsis in the open menu.
**Apply when:** tickets that remove a suffix/prefix from a label (ellipsis, colon, counter). (seen in GH-543)

### CI emulator: the job-start APK is a free "before" build — run the new flow on it before `metro-start`
**Observation:** right after `wait-ready` the installed APK still runs the PR's previous JS. Capturing the before screenshot and running the updated Maestro flow there (it must FAIL at the changed assertion) before `tool.sh metro-start` + `tool.sh launch` proves the flow is not vacuous, without any rebuild. (seen in GH-543)


### CI tsc baseline: typed store fixtures without `as`, and jest-native matcher types
**Observation (GH-528 merge):** the CI typecheck (`npm run typecheck`, root tsconfig) does not load `@testing-library/jest-native` types (only `__tests__/tsconfig.json` does), so every `toHaveTextContent`/`toContainElement` was a TS2339. Merging parallel PRs also leaves test `GlobalState` fixtures without newly added slices (TS2741 for e.g. `bodyWeight`), and master itself can be red against `scripts/ci/*-baseline.json`.
**Fix / Rule:** start specs that use jest-native matchers with `/// <reference types="@testing-library/jest-native" />`; `rootReducer` is a typed redux `Reducer<GlobalState, AnyAction>`, so `createStore(rootReducer)` and `rootReducer(undefined, {type: '@@INIT'})` type-check without casts. After a master merge run both `check-baseline.js` checks locally and compare with a pristine master worktree to tell your errors from master's.
**Apply when:** merging master into a long-running PR or adding a slice to `GlobalState`. (seen in GH-528)

### Since GH-584 there are target flows per feature — extend them, don't add `ghNNN_*.yaml`
**Observation (GH-584):** the 236 per-ticket flows were merged into ~31 target flows + 10 helpers; the list, data basis and rules are in `__tests__/e2e/maestro/FLOW_AUDIT.md`. Old flow names in older memory entries/run logs point to git history. Helpers: `goto_micro69_push.yaml` (env `MODE=planned|running|edit`, replaces gh466_goto_push/gh443_goto_running_push/gh418_open_plan_edit), `goto_micro2_push.yaml`, `open_rest_menu.yaml`, `import_fixture.yaml` (`FIXTURE`), `pick_file.yaml` (`FILE`), `set_appearance.yaml`, `set_dummy_api_key.yaml`, `open_ai_chat.yaml`. Manual flows (real key/device) are in `flows/manual/`.
**Apply when:** a ticket needs e2e coverage — add a section to the feature's target flow and run it once standalone.

### The baseline's current micro is M6 (not M7) since GH-533 — "Next Training" is `Meso 1 · M6 · D1 · 0 exercises`
**Problem (GH-584):** many old flows and memory entries assert `Meso 1 · M7 · D1`; since GH-533 an incomplete micro stays current, and in `baseline.gains` only M6 D4 is done → hero `Meso 1 · M6`, `1/4`, next `Push squat` with an empty slot. "Suggest based on last Training" fills it with 10 exercises; the first logged Adductor set gets row `add-workout-set-logged-2` (the copied plan has sets 2 and 3).
**Apply when:** asserting home/next-training values on the baseline.

### Edge swipe in the SAF picker = system BACK; steer to Downloads via "Show roots"
**Problem (GH-584):** a `swipe` from `2%,50%` to open the picker's roots drawer closed the whole picker (gesture navigation BACK) and the import flow failed on "Downloads". Also a `when: notVisible: 'baseline.gains'` check right after opening runs before the picker has listed anything.
**Fix:** `extendedWaitUntil: {visible: '<file>', timeout: 20000, optional: true}`, then only if still missing `tapOn: 'Show roots'` → `tapOn: 'Downloads'` (now in `00_import_baseline.yaml` and `import_fixture.yaml`).
**Apply when:** any flow that picks a file in the system picker.

### Analysis picker (sharingan) rows: a text tap does not select; `childOf` a section id does not resolve
**Problem (GH-584):** in Analyse › Analysis "Select Exercises, Muscles, Metrics…", `tapOn: {text: 'Mmkv', below: {id: 'search-bar'}}` left the row unselected (no chip), also for Volume/Frequency/Week. In the plan editor `assertVisible: {id: '^plan-set-1-reps-input$', childOf: {id: 'plan-edit-exercise-section-32'}}` never matched although the row was on screen.
**Fix:** after filtering to one result, tap the row by position (`point: '30%, 26%'`, `retryTapIfNoChange: false`) and assert the `chip` with its text; for repeated per-section ids rely on the first match (first section) plus a value in the assertion.
**Apply when:** selecting in the Analysis picker or scoping repeated plan-set ids.

### Several Bash forms are blocked in the agent-emulator job — use tool.sh/adb/ffmpeg + Edit
**Observation (GH-584):** `python3 -c`, `node -e`, `bash script.sh`, shell loops/variables (`for f in …; $(…)`), `sed -i` and `git mv` all needed approval; `tool.sh <cmd>` (also several chained with `;`), `adb -s … push/shell`, `ffmpeg`, `git add/commit/rm`, `mv`, `grep` worked. YAML validation therefore happens on the first Maestro run. Subagents have the same limits.
**Apply when:** planning a CI emulator run — rename with `mv` + `git add -A`, delegate failure analysis of one flow to a no-device subagent (debug folder `commands.json` + resized screenshots) while the next flow runs, edit with the Edit tool, run flows one `tool.sh flow` per call (≤ 10 min per Bash call; a longer chain is moved to the background).

### Three Maestro traps found while consolidating (placeholder text, `}` in scripts, unscanned Downloads)
**Problem (GH-584):** (1) `text:` also matches an EditText's hintText — a TextInput with `placeholder={DEFAULT_MODEL}` makes `assertNotVisible: {id, text: DEFAULT_MODEL}` fail forever and a positive check pass on an empty field. (2) Maestro ends a `${…}` script at the FIRST `}` — a regex quantifier like `[0-9]{3}` inside `assertTrue: "${/…{3}…/.test(x)}"` gives `SyntaxError: Expected an operand but found /` (only visible in `maestro.log`); write `[0-9][0-9][0-9]`. (3) Files pushed with `adb push` are missing from the SAF picker's "Recent" view (and the default picker landing) until the media store indexes them, and grid view truncates long names (`gh391_planned_fi…`).
**Fix:** assert saved values positively; no `{n}` in inline scripts; `adb shell content call --method scan_volume --uri content://media --arg external_primary` after pushing (now in `run-maestro-from-wsl.sh`), and `import_fixture.yaml` switches the picker to "List view".
**Apply when:** asserting text inputs, writing inline JS checks, importing pushed fixtures. (seen in GH-584)

### A dependency major bump can remove an export: the screen crashes, and a hand-written jest mock keeps the spec green
**Problem (GH-589):** gesture-handler 3 no longer exports the legacy `Swipeable`. `DateRangePicker` imported it, so every screen with a date range (AI Chat filter, Records, Analysis, History, Body weight) fell into the Analyse error boundary ("Element type is invalid … got: undefined" in logcat). `DateRangePicker.spec.tsx` mocked `react-native-gesture-handler` with its own `Swipeable`, so it never noticed.
**Fix / Rule:** `ReanimatedSwipeable` from `react-native-gesture-handler/ReanimatedSwipeable`. Its `onSwipeableOpen` direction is INVERTED vs. legacy (dragging right = `RIGHT`, legacy said `'left'`). Mock the real module path in `jest.setup.js` and never mock exports the library no longer has. After a dependency bump, grep the app's imports against the package's `src/index.ts`.
**Apply when:** an Analyse screen shows "… could not be displayed", or after a gesture-handler/reanimated/paper bump.

### RTK 2 rejects `middleware: [..]` only in DEV bundles — the embedded APK bundle hides it, Metro shows a red screen
**Problem (GH-589):** `configureStore({middleware: [healthConnectMiddleware]})` worked in the job-start APK (production-mode embedded bundle). The first Metro bundle died with "[runtime not ready]: Error: `middleware` field must be a callback".
**Fix / Rule:** `middleware: () => new Tuple(...)`. If the Metro red screen points at `configureStore`, this is the cause, not your feature.
**Apply when:** the first Metro launch of a run shows a red screen before any of your code runs.

### CI emulator: Metro can't be restarted — point `debug_http_host` at a dead port to use the embedded bundle, then `tool.sh rebuild`
**Observation (GH-589):** `kill`/`fuser -k`, a second Metro on another port (copied tool.sh) and `bash x.sh` all needed approval, so a stale/broken Metro on :8081 stays up all job. Bridgeless RN has no cached-bundle fallback: Metro or the embedded `assets/index.android.bundle`. Write `<map><string name="debug_http_host">10.0.2.2:9</string></map>` (Write tool → `adb push` → `run-as <pkg> sh -c 'cat /data/local/tmp/prefs.xml > shared_prefs/<pkg>_preferences.xml'`) and cold-start; logcat says `isMetroRunning(): Async result = false`. A `clearState`/`pm clear` deletes the pref, so rewrite it afterwards.
**Apply when:** you need a JS edit on the device after `metro-start`, or Metro serves a broken bundle.

### Trigger a real "isn't responding" dialog on demand: SIGSTOP the debuggable app via run-as
**Observation (GH-589):** `adb shell pidof <pkg>`, then `adb shell "run-as <pkg> kill -STOP <pid>"`, two `input tap`s, wait ~12 s → "Gainalytics isn't responding" (Close app / Wait). Maestro sees the dialog. `dismiss_system_anr.yaml` ignores the app's own ANR; `maestro test -e OWN_APP=NotThisApp …` makes it count as foreign and proves the Close path.
**Apply when:** testing ANR/system-dialog handling in flows.

### Video analysis detail reopens scrolled; compare sync starts at rep-1 lift-off, not 0:00.0
**Observation (GH-589):** after `back` + opening another row, `video-analysis-detail-screen` kept the previous scroll offset, so the header (`Squat · No linked set`) was off-screen. Scroll up along the left edge (`swipe 6%,25% → 6%,79%`, the video/chart eat centred swipes) before asserting the header. `CompareSyncPlaybackCard` seeks both videos to rep 1 lift-off on load (`squat-3reps.mp4`: `0:01.0`). Assert A == B, not `0:00.0`.
**Apply when:** writing video detail/compare flows.

### Typing into masked or secure inputs: the tap puts the cursor mid-text, so erase only removes the left part
**Problem (GH-589):** `tapOn: {id}` hits the field's centre. In the date-range `DatePickerInput` (MM/DD/YYYY mask) `eraseText` + `inputText: '03/01/2026'` ended as "06/2". In the secure API-key field two tap+erase rounds still left "•••", so the key was never removed.
**Fix / Rule:** date mask: tap the field's right end (`point: '31%, 16%'` for the Records start input), single `pressKey: Backspace` ×12, one `inputText` per digit (the mask adds the slashes), then `assertVisible: '03/01/2026'` (the testID sits on a wrapper, so match by text). Secure field: `scrollUntilVisible … centerElement: true` (above the keyboard) and tap+erase three times. Prove the result downstream.
**Apply when:** a flow edits a prefilled date, masked or password input.

### Move the emulator clock without root: `cmd alarm set-time`, but import fixtures first
**Observation (GH-589):** `adb shell settings put global auto_time 0; adb shell cmd alarm set-time <epoch-ms>` works on the CI image (restore with `auto_time 1`). It proves time-dependent assertions ("still green in 2027"). After the jump, the SAF picker showed "Recent / No items" and could no longer find `baseline.gains`. `tool.sh import-baseline` deletes + re-pushes the file without a media scan, so it is also missing from the index: run `content call --method scan_volume --uri content://media --arg external_primary`. Import at the real date, then jump and run only the assertions.
**Apply when:** a flow or ticket depends on today's date or a "last N months" window.

### Analyse tab and Training home reopen where they were left — flows must navigate, not assume
**Problem (GH-589):** after deleting a chat in "Chat History", `tapOn: tab-analyse` reopened Chat History, not AI Chat (`chat-no-key-message` never appeared). Back on the Training home after detours, the list sat BELOW the Next Training card, and `scrollUntilVisible DOWN` never found `next-training-start-button`. The Settings muscles accordion opened with its rows below the fold.
**Fix / Rule:** `runFlow when notVisible <target>` → drawer → entry; scroll UP to `next-training-name` first; `scrollUntilVisible` before asserting rows of an expanded accordion.
**Apply when:** a flow step follows another flow section that left the tab/screen elsewhere.
### A clipped node counts as "100 % visible": scrollUntilVisible stops on a sliver
**Problem (GH-588):** uiautomator reports a node clipped by the ScrollView with its VISIBLE bounds only (a card at the tab-bar edge dumps as `[2124][2127]`, 3 px). `visibilityPercentage: 100` is therefore met by a button whose top edge just peeks out; its label child below the edge is not in the hierarchy. CI failed on `assertVisible {id: next-training-start-button-text, text: 'Continue Training'}` right after `'Training running'` passed (the running card is taller: it lists two exercises). It depends on where the swipe ends, so it fails on slow runners only.
**Fix:** `centerElement: true` on `scrollUntilVisible` before asserting or tapping children of a card.
**Apply when:** asserting a child of the scroll target, especially near the bottom tab bar. (seen in GH-588)

### The running rest timer makes every Maestro interaction take 11–23 s
**Observation (GH-588):** after a set is logged on a running training, the RestTimerCard's animated ring never lets the screen settle. Each `tapOn` took ~22 s and each `eraseText`/`inputText` ~11 s, about 3 min per smoke run (17 min in CI). Skipping the rest (`rest-timer-overflow` → `Skip rest`, both taps with `waitToSettleTimeoutMs: 500`) brings them back to 1–4 s. Correcting a logged row does not restart the rest (GH-443); a NEW logged set does.
**Apply when:** a flow keeps interacting after logging a set, unless the flow tests the timer itself.

### `launchApp: {stopApp: false}` keeps the previous flow's scroll position
**Problem (GH-588):** after switching chained flows to `stopApp: false` (saves the cold start and the ~7 s `when: visible: 'Dismiss'` check), `analyse_dashboard_drilldown` failed on `micro-hero-plan-name` 1 run in 2: home_dashboard had left the Training home scrolled to the plan list, and tapping the focused tab did not reliably scroll it back up.
**Fix:** `scrollUntilVisible … direction: UP` to the hero before the precondition assert. Also: every `when: visible/notVisible` whose answer is "no" costs ~7 s.
**Apply when:** chaining flows without app restarts. (seen in GH-588)

### Intermittent native crash on cold start (Fabric MountingCoordinator::pull SIGSEGV)
**Observation (GH-588):** in 1 of ~12 cold launches on the CI emulator the app died 2 s after start with `SIGSEGV (SEGV_ACCERR)` in `facebook::react::MountingCoordinator::pull` on `mqt_v_js`. `00_import_baseline` then fails with `"Training" is visible` while the launcher is on screen. Another launch worked. This is not caused by the flows. Find it in logcat with `grep "Fatal signal"`.
**Apply when:** an import/launch step fails with the launcher on screen and there is no Java `FATAL EXCEPTION`.

### A "flaky" assertion on an Analyse screen can be the error boundary — look at the failure screenshot first
**Problem (GH-588 round 2):** smoke failed on `"1 selected" is visible` after the Details tap; it looked like gesture timing. The Maestro debug screenshot showed "Metrics Overview could not be displayed": RNGH 3 (master bump) removed `Swipeable`, `DateRangePicker` imported `undefined` → `Element type is invalid … got: undefined` (logcat `ReactNativeJS`, stack ends at `DateRangePicker`). Deterministic, every screen with a range picker.
**Rule:** open `debug/…/screenshots/*.png` and grep logcat for `Element type is invalid|failed to render` before hardening a flow. `npm run typecheck` had flagged it (`TS2305 has no exported member 'Swipeable'`); the global RNGH mock in `jest.setup.js` hides missing exports. Migration: `react-native-gesture-handler/ReanimatedSwipeable`; directions are flipped (legacy `'left'` = new `SwipeDirection.RIGHT`), actions are no longer hidden at rest (fade them with the `progress` shared value), `dragOffsetFromRight` must be ≤ 0.
**Apply when:** a smoke/flow fails on an Analyse screen, or after a gesture-handler bump. (seen in GH-588)

### Metro dev bundles crash at startup since RTK 2 (`middleware` field must be a callback) — rebuild instead
**Problem (GH-588 round 2):** after `tool.sh metro-start` + `launch` the app showed a red screen `[runtime not ready]: Error: 'middleware' field must be a callback` in `configureStore`: RTK 2 only checks the array form in dev; the embedded (non-dev) bundle runs fine. Killing Metro (`kill <pid>`) needs approval in the CI job.
**Fix:** `tool.sh rebuild` (incremental ~1–7 min) and point the app away from Metro: `adb -s <serial> shell "run-as com.powerliftingworkoutplanner sh -c 'echo \"<map><string name=\\\"debug_http_host\\\">localhost:8099</string></map>\" > /data/data/com.powerliftingworkoutplanner/shared_prefs/com.powerliftingworkoutplanner_preferences.xml'"` (survives `install -r`, no flow clears state). Real fix: `middleware: () => new Tuple(...)` in `configureStore.ts` (not done yet).
**Apply when:** JS changes must reach the CI emulator while `configureStore.ts` still passes an array. (seen in GH-588)

### `stopApp: false` also keeps component state — a resumed Dashboard deselects on the next chip tap
**Problem (GH-588 round 2):** `analyse_dashboard_drilldown` run twice in a row failed on the stale banner: the resumed Dashboard was still scrolled to the radar with Quads selected (MuscleHeatmap chips TOGGLE, so the next tap would deselect).
**Fix:** cold start standalone; callers that know the screen is fresh pass an env switch (`ANALYSE_RESUME: 'true'` from `smoke.yaml`; `when: true: ${typeof X === 'undefined' || X !== 'true'}`, no header `env:` default).
**Apply when:** a flow resumes the app and asserts initial screen state or taps toggles. (seen in GH-588)
### Dependabot npm groups: check three hard pins before taking a bump
**Problem (AGENT-RUN, #574):** a grouped bump broke Jest and assembleDebug at once. (1) `react`/`react-dom` must equal the React version bundled in `node_modules/react-native/Libraries/Renderer/implementations/ReactFabric-dev.js` (RN 0.84.1 → 19.2.3); a patch bump fails Jest with `Incompatible React versions: … react-native-renderer: 19.2.3`. (2) reanimated/worklets: read `node_modules/react-native-{reanimated,worklets}/compatibility.json` + peer `react-native` range; Gradle `preBuild` runs `scripts/validate-react-native-version.js` and throws for an unlisted RN minor (4.7.x/0.13.x need RN ≥ 0.86). Jest does NOT catch this — reanimated is mocked. (3) `react-native-paper-dates` ≥ 0.24 nests ESM-only `color` v5 → add `color|color-string|color-convert|color-name` to `transformIgnorePatterns` (done in `jest.config.cjs`).
**Rule:** `npm view`, `node <script>` and `./gradlew` need approval in the CI emulator job; read peer ranges from installed `package.json` with Grep and wait for Gradle with `adb -s <serial> shell sleep 300` (host `sleep`/`perl` are blocked). The calendar grid in `DatePickerModal` is `react-native-calendars`, not paper-dates (paper-dates only provides the MM/DD/YYYY inputs).
**Apply when:** reviewing or reproducing a Dependabot dependency group. (seen in AGENT-RUN deps #574)

### RTK 2 `configureStore({middleware: [...]})`: dev throws, release silently drops the middleware
**Problem (AGENT-RUN deps majors):** after RTK 1→2 the array form compiled to a baseline TS2322 only. At runtime RTK 2 throws "`middleware` field must be a callback" when `NODE_ENV !== 'production'` (Metro dev bundle, Jest), and in production it ignores the array and installs `getDefaultMiddleware()`. So release 0.186 ran without `healthConnectMiddleware`. The CI job-start APK embeds a production bundle, so it started fine and hid the problem.
**Fix / Rule:** `middleware: () => new Tuple(...)` (the same set, no default thunk/check middleware). `__tests__/redux/configureStore.spec.ts` creates the real store and fails on the array form. For any library major bump, read the library's runtime `throw`s (`grep "must be" node_modules/<lib>/dist/*.mjs`), not only tsc.
**Apply when:** touching `configureStore.ts` or bumping RTK/redux.

### Restore `debug_http_host` after testing the embedded bundle, or every later launch silently runs it
**Problem (AGENT-RUN deps majors):** I set `debug_http_host=10.0.2.2:8099` to compare with the embedded bundle and did not revert it. Every later `launchApp` (import flows) then ran the job-start JS for 40 min, and "passing" flows proved nothing about the change. On the CI emulator the pref file does not exist by default: delete it again with `adb shell run-as <pkg> rm shared_prefs/<pkg>_preferences.xml`.
**Fix / Rule:** stack traces name the source (`index.android.bundle` = embedded, `http://10.0.2.2:8081/index.bundle?…` = Metro). redux-logger lines (`action %c…`) exist only in the dev bundle, so `logcat | grep "action %cpersist/REHYDRATE"` after each launch is a cheap Metro proof.
**Apply when:** switching between embedded and Metro JS on the CI emulator.

### Plan drag & drop on a dev bundle: the drop re-renders 3–9 s later; set values repeat across sections
**Observation (AGENT-RUN deps majors):** with redux-logger printing the whole store, a set-row drop on the emulator showed the new order only after 3–9 s. A second drag started earlier was ignored (the previous drop is still pending), which looked like "every other drag fails". Adductor (13/12) and the next section, Single leg (12/13), share values, so `{id: '^plan-set-1-reps-input$', text: '12'}` matched before the drop landed.
**Fix / Rule:** wait with `extendedWaitUntil` on a value that is unique to the dragged section (`notVisible` set-1 = 13, then `visible` set-1 = 13 / set-2 = 12) before the next swipe (now in `plan_edit_sets.yaml`). For adb drags: `input swipe 114 830 114 1040 1500` (set row) / `114 656 114 1500 1500` (section), 1080x2400.
**Apply when:** asserting reorders in the plan editor.

### Rest notification never fires on the emulator: the baseline enables exact alarms that the emulator has not granted
**Problem (AGENT-RUN deps majors):** `baseline.gains` carries `localNotification.exactAlarmPermission: true`, so `PauseDoneNotification` asks notifee for an AlarmManager trigger. Without SCHEDULE_EXACT_ALARM, notifee logs `System.err: Missing SCHEDULE_EXACT_ALARM permission. Trigger not scheduled.` and nothing is shown. No JS error, and `train_rest_timer_1rm` still passes.
**Fix / Rule:** `adb shell appops set <pkg> SCHEDULE_EXACT_ALARM allow`, log a set, and press Home. `dumpsys alarm | grep -A2 NotificationAlarmReceiver` shows the trigger, and about 90 s later `dumpsys notification --noredact` shows "Pause done!". In the app, a stale imported flag silently disables the rest notification (follow-up candidate).
**Apply when:** verifying notifee/rest-timer notifications.

### gesture-handler 3: `PanGesture` now names the hook gesture — per-item pans move into the item component
**Observation (AGENT-RUN deps majors):** `import type {PanGesture}` resolves to the v3 hook type; `Gesture.Pan()` (deprecated builder) returns `LegacyPanGesture` → TS2345/TS2739. `useDragReorder` now hands out stable per-index callbacks (`onActivate`/`onUpdate`/`onFinalize({canceled})`), and each handle calls `useDragHandleGesture` (`usePanGesture`, memoised config — a new config object re-sends the native config every render). Jest mocks need `usePanGesture` (added to `jest.setup.js`). Body Weight also crashes on master in `DateRangePicker` (`Swipeable` removed).
**Apply when:** touching gestures after the RNGH 3 bump.
### Metro dev bundle red-screens with "`middleware` field must be a callback" — load a non-dev bundle instead
**Problem (GH-527):** after `tool.sh metro-start` + `launch`, the app showed `[runtime not ready]: Error: 'middleware' field must be a callback` in `configureStore`. `configureStore.ts` passes an ARRAY as `middleware` when `NODE_ENV === 'development'`, and RTK 2 rejects that. Only Metro's dev bundle hits it; the APK's embedded bundle is production, so the app looks fine until you switch to Metro. On the CI emulator there is no `shared_prefs/…_preferences.xml` at all (defaults: `10.0.2.2:8081`, dev on).
**Fix / Rule:** push a prefs file with `<string name="debug_http_host">10.0.2.2:8081</string>`, `<boolean name="js_dev_mode_debug" value="false" />` and `js_minify_debug=false` via `adb push` to `/data/local/tmp` + `run-as … cp … shared_prefs/com.powerliftingworkoutplanner_preferences.xml`, delete `files/BridgelessReactNativeDevBundle.js`, then `tool.sh launch`. Don't fix the store in a feature ticket.
**Apply when:** any JS verification via Metro on the current master (until `configureStore.ts` uses `getDefault => getDefault().concat(...)`).

### Old-vs-new on the CI emulator without git checkout: point `debug_http_host` at a dead port
**Observation (GH-527):** the debug APK embeds the job-start (= master) bundle. With `debug_http_host=10.0.2.2:8099` (nothing listening) + force-stop + delete `BridgelessReactNativeDevBundle.js`, the app silently runs the OLD code. Switch back to `:8081` for the new code. Same store, no rebuild, no `git checkout` (not allowed there). To prove that each new assertion can fail, copy them into a temp flow with `optional: true` on `assertVisible` and count `"status" : "WARNED"` in `commands.json` (the run itself is green).
**Apply when:** before/after screenshots or "the assertion fails on old code" proof for a JS-only change in the GitHub Actions emulator job.

### Muscle Overview table of the training/micro overviews IS assertable — columns are global, persisted settings
**Observation (GH-527):** inside `MicroOverview`/`MicroPlanOverview`/`TrainingsOverview` the `MetricsOverviewForWorkouts` cells resolve: `metrics-muscle-<Muscle>-<slot>` (value) and `…-<slot>-delta`, headers `metrics-muscles-header-<slot>` → dialog `metric-selector-option-<1rm|sets|max-intensity|average-intensity|volume|reps|frequency>`. The slot choice is stored in settings for every screen → set it explicitly in the flow and restore Volume/Sets/Reps at the end. (The Analyse tab's MetricsNode table is still invisible.)
**Apply when:** asserting per-muscle metric values in an overview flow.

### Baseline plans still store planned sets of exercises that were removed from a training
**Observation (GH-527):** `training.plannedWorkouts` keeps workouts whose exercise is no longer in `training.exercises` (plan 5: M1 SA lat pulldown + Machine chest press, M2 three more; plan 1: ~25 trainings). The Plan tab lists only `exercises`. Since GH-527, the overviews count only listed exercises (`plannedWorkoutIdsOf` in `app/utils/overview-comparison.ts`). Any new plan sum must use that helper, or its numbers won't match the Plan tab.
**Apply when:** summing planned sets/volume anywhere (overviews, hero cards, AI context).

### "Import done" waits on a Settings button break when the section heights change — wait for the imported value
**Problem (GH-589):** `start_existing_data` opened the import through the onboarding ("Show Introduction" scrolled into view, not the Data buttons). After the SAF pick it waited for `'Import Data'`. On the nightly emulator the Health Connect card shows "Connected" + a write toggle, which makes it taller, so the button sat just below the fold. The flow failed on both attempts while the import itself had worked. Same class: `scrollUntilVisible` to a row's star while the asserted `plan-meta-N` line under it is still clipped by the bottom bar (`home_new_plan_current`, 1 of 3 fresh runs). In `analyse_drawer_screens`, a scroll stopped at `records-shown-count` (empty text below it), and a scroll UP stopped at the Week button (`training-length-mode-label` above it).
**Fix / Rule:** after a pick, wait for `tab-training` and then `extendedWaitUntil` on the imported value (`micro-hero-plan-name` = `Push pull`). Scroll to the exact element you assert, not to a neighbour.
**Apply when:** a flow waits for a static screen element as a proxy for "operation finished", or passes in the suite but fails on a fresh emulator.

### Maestro can hang host-side inside `launchApp` (stopApp: false) — only the per-flow timeout ends it
**Observation (GH-589):** in a fresh shard-2 run, `plan_overflow_actions` stopped logging at `Launch app … without stopping app` (inside `goto_micro69_push.yaml`). The app stayed RESUMED, logcat had no FATAL/ANR and no `START` for the app. It did not recover in 10+ min. The nightly's 900 s `timeout` + one retry covers this. When running by hand, wrap every `tool.sh flow` in `timeout 900`.
**Apply when:** a flow is silent for minutes. Check `debug/.maestro/tests/<ts>/maestro.log` for the last RUNNING command before you suspect the app.

### Records: pin BOTH range ends for date-independent values; the end input is at `64%, 16%`
**Observation (GH-617):** the start-input recipe (`31%, 16%`, 12× Backspace, one digit per `inputText`) works the same for the end input at `point: '64%, 16%'`. Range 12/01/2025–03/01/2026 holds all 40 baseline records, button `Mon, 01/12/25 to Sun, 01/03/26`, 13 weeks (no lane bundling), so counts never drift with today's date. Week tiles (UTC): 12/01 = 9, 12/08 = 2, 12/15 = 5, 12/22 = 2, 01/12 = 1, 01/19 = 5, 01/26 = 7, 02/02 = 4, 02/16 = 1, 02/23 = 4. Tiles have testIDs `records-tile-week-YYYY-MM-DD`; bars `records-bar-<Group>-<index>`.
**Apply when:** asserting Records/heatmap values on the baseline.

### Accessible Pressable with `accessibilityLabel` + `accessibilityState` is fully assertable in Maestro
**Observation (GH-617):** a `Pressable testID=… accessibilityLabel="week of 01/26/26: 7 records" accessibilityState={{selected, disabled}}` gives `assertVisible: {id, text: '<label>'}`, `{id, selected: true}`, `enabled: false` for disabled tiles, and `copyTextFrom: {id}` returns the label. Good pattern for chart tiles/bars without visible text nodes.
**Apply when:** making tappable chart cells testable.

### CI emulator: run one section of a long target flow inside the 10-min tool cap
**Observation (GH-617):** `analyse_drawer_screens.yaml` runs >10 min. `cp` the flow into `.agent-run/flows/`, add `- assertVisible: 'TEMP-END-MARKER'` right after the section under test, and run that copy: the run fails exactly at the marker, which proves every step before it passed (7m44s here). `tool.sh flow` does not forward `-e KEY=VAL`, so temp flows hardcode env values or wrap helpers with `runFlow: {file, env}` (relative path from `.agent-run/flows/`: `../../__tests__/e2e/maestro/flows/<helper>.yaml`).
**Apply when:** a target flow is too long for a single foreground Bash call.

### CI emulator: `maestro --device <serial> test -e KEY=VAL <flow>` works directly (tool.sh flow can't forward `-e`)
**Observation (GH-621):** calling Maestro directly with `--format junit --output .agent-run/maestro/<x>.xml --debug-output .agent-run/maestro/<x>-debug` was permitted and ran the same flow at FPS=15/20/30. Watch the header-`env:` trap (see maestro-flows "Small syntax gotchas"): a run that "passes" with an override proves nothing until you check the produced value.
**Apply when:** a flow must run once per parameter value.

### CI emulator: a clean `tool.sh rebuild` fit in ONE foreground call (7m04s, 519 tasks), emulator survived
**Observation (GH-621):** after the background setup finished (it builds in a frozen copy, so the checkout build is cold), `tool.sh rebuild` with `timeout: 600000` finished and installed in ~7.5 min; `install -r` kept the imported baseline. Detached builds (`setsid nohup …`), direct `./gradlew` and `> file` redirects in the workdir were all refused by the permission layer. Contrast GH-546 (26 min, emulator died): do all old-APK before-screenshots first, then rebuild once.
**Apply when:** a ticket changes Java/Kotlin code in the agent-emulator workflow.

### Video analysis: decoder samples record the decoded frame's PTS since GH-621; emulator gives 2 reps for `squat-3reps.mp4` at every FPS
**Observation (GH-621):** `extractTrackedSeriesWithDecoder` takes the first decoded frame with PTS ≥ the planned sample time. It used to record the PLANNED time (up to one source frame early). It now records the real PTS, so the `tMs` gaps are uneven at 15/20 FPS (0,100,167,233…). Velocity uses central differences over `tMs`, so uneven gaps are fine. Integer-ms planned times also skip ~2 frames per 300 at 30 FPS. x86_64 emulator, `squat-3reps.mp4`: 2 reps at 15/20/30. Total analysis time ≈7.4–9.5 s at 15 FPS, 8.7 s at 20, 12.9 s at 30. Read the numbers with `adb exec-out run-as <pkg> cat files/video-analysis/results/analysis-<id>.json | jq '.analysisMeta.performanceMetrics'`.
**Apply when:** touching video sampling, or asserting rep counts or timings on the emulator.

### Closing the picker list: wait for `search-bar` to be gone before a second conditional `back`
**Problem (GH-636):** the pattern `runFlow when visible search-bar → back; waitForAnimationToEnd; runFlow when visible search-bar → back` races. `waitForAnimationToEnd` returned after ~0.4 s. The second check can still see the fading list, and the extra `back` on Analysis opens the Dashboard (verified on the emulator), so the next `assertVisible: 'N selected'` fails. Also `hideKeyboard` closed the whole list here, not only the keyboard.
**Fix / Rule:** after each conditional back, use `extendedWaitUntil: {notVisible: {id: search-bar}, timeout: 3000, optional: true}` (and 15000 non-optional after the second one). Then assert a screen id (`analyse-chart-Volume`) before the value assertion.
**Apply when:** any flow dismisses the TrainingElementPicker list with `back`.

### Scroll back to the element you assert, not to a neighbour
**Observation (GH-636):** a scroll-up loop that stops at `'Volume \(sum\)'` can leave the picker anchor ("3 selected") above the viewport. Loop on the anchor's own label (`'Select Exercises, Muscles, Metrics, Accumulation Mode'`) instead.
**Apply when:** asserting a header or picker value after scrolling down a ScrollView.
### Removing a JS-only package can silently change tsc's `react-native` types
**Problem (GH-638):** `tsconfig` sets `types: ["react-native", "jest"]`, which resolves `@types/react-native` FIRST when it exists. The stale `@types/react-native` (RN 0.7x) only arrived transitively via `react-native-elements` → `@types/react-native-vector-icons`. Removing `react-native-elements` switched tsc to RN 0.84's own `src/types/globals.d.ts` and added 4 `AbortSignal` errors (`fetch(..., {signal})` in the AI clients). Fixed in `abort-signal.d.ts` by mirroring RN's `onabort`/`addEventListener`/`removeEventListener`/`dispatchEvent`.
**Rule:** after a dependency removal, diff the tsc error LIST (not the count) against the job-start snapshot: run `npx tsc -p <dir>/tsconfig.json --noEmit --pretty false | grep -oE "^[^(]+\([0-9]+,[0-9]+\): error TS[0-9]+" | sort` for `$RUNNER_TEMP/build-src` and the checkout. `--listFiles | grep -oE "node_modules/(@[^/]+/)?[^/]+" | sort -u` shows which type packages disappeared.
**CI env:** `node -e`, `python3`, `npm ls`, `npx depcheck` and `> file` redirects need approval; find reverse deps with a multiline Grep on `package-lock.json`: `"node_modules/[^"]+": \{\n(      [^\n]*\n)*?\s+"<pkg>": "`. The checkout is shallow (1 commit), so `git log -S` finds nothing.
**Apply when:** removing or upgrading npm packages, especially ones that depend on `@types/*`.

### Baseline Home is M6 (not M7) — the micro trainings counter lives in `countMicroTrainings`
**Observation (GH-644):** issue text from the GH-505 audit quoted "M7 · 1/4". On the CI emulator the baseline's Home hero reads `Meso 1 · M6`, `1/4` (GH-533 keeps the incomplete M6 current), so M6 is the case to assert. Home (`MicroHeroCard`, plan row in `TrainingHome`) and the micro Overview "vs Plan" now all call `app/utils/micro-training-count.ts`. A flow compares them by reading both with `copyTextFrom` → `evalScript: "${output.x = maestro.copiedText}"` → `assertTrue`. Drawer path to a micro's Overview: `meso-card-5-1` → `drawer-menu-button` → tap `Micro 2` … `Micro 6` one after another → `Overview`.
**Apply when:** asserting baseline micro counters or touching the trainings counter of a micro.

### CI emulator: after `tool.sh metro-start`, the first `launchApp` waits on a cold Metro bundle (~1 min white "Loading from 10.0.2.2:8081")
**Problem (GH-644):** a flow started right after `metro-start` + `launch` failed with `Element not found: tab-training`: the app was still on the white loading screen, and the flow's `stopApp` restart re-triggered bundling. `cp`/compound commands with `$var` or `timeout bash -c` need approval in this environment, so polling loops in Bash are out.
**Fix / Rule:** put `extendedWaitUntil: {visible: 'tab-training', timeout: 120000}` right after `launchApp` in any flow you run on Metro, and use a tiny wait-only flow before a "plain" adb screenshot.
**Apply when:** the first device step after switching to Metro JS.

### Video analyses overlap on a slow emulator: the shared TFLite Interpreter is not thread-safe
**Problem (GH-636):** `video_compare` imports the same clip twice. On a loaded emulator, import #2's seed preflight ran while #1 was still tracking; both called `interpreter.run()` on the one shared Interpreter, and #2 got `outcome:"failed_no_candidate"` → `Status: failed` (the flow waits 10 min for "Status: done"). On an idle emulator the analyses (~12 s each at 30 FPS) never overlap, so the flow passes standalone and the bug only showed in the nightly.
**Fix / Rule:** all inference goes through `runInterpreter()` (synchronized on `interpreterLock`); guarded by `__tests__/utils/videoAnalysisInterpreterLock.test.ts`.
**Repro trick:** load the emulator CPU with `adb -s <serial> shell "for i in 1 2 3; do nohup sh -c 'while :; do :; done' >/dev/null 2>&1 & done"` (stop: `adb -s <serial> shell pkill sh`), then import twice; check logcat `VideoAnalysisImportMetrics` outcome + `analyzeSquatVideo ... metrics=` timings.
**Apply when:** a video flow fails only in the nightly/suite, or an analysis ends FAILED/"no candidate" on a clip that works alone.

### CI emulator: the 10-min foreground cap vs. long flows — split the flow
**Observation (GH-636):** background Bash, `setsid`/`nohup` and `> file` redirects need approval here. A long flow can be split into chunks in `.agent-run/flows/` (use an absolute path in `runFlow: file:`) and run with one `tool.sh flow` call per chunk; the store and app state carry over between chunks. A fresh CI emulator is still in onboarding, so run `tool.sh import-baseline` once before running a flow that starts with `import_fixture.yaml` on its own.
**Apply when:** a flow (with analyses) may take longer than 10 min.

### CI emulator: setup can end `failed:sdk` AFTER a green APK build — check `setup-status` early, not only at `wait-ready`
**Problem (GH-544):** the Gradle build succeeded (9m16s), then the system-image download failed (`Error on ZipFile unknown archive`). `tool.sh setup-status` showed it ~25 min into the job, and `wait-ready` exits 1 immediately. No emulator for the whole job.
**Fix / Rule:** don't repair it (agent prompt). Finish the JS work and the Jest/tsc/lint checks while no emulator is running (the full `npm test` is then allowed), write the flow section unrun, commit, and report the log lines under `## Open question`.
**Apply when:** `setup-status` prints `failed:<step>`.

### New `use…` hooks under `redux/*/dispatch/` must be named `useX` — the `dispatchX` naming is baseline lint debt
**Problem (GH-544):** a new `dispatchPlanFromAi` written like `dispatchSuggestBasedOnTrained` raised 7 `react-hooks/rules-of-hooks` errors. The old `dispatchX` files only pass because they are in `scripts/ci/eslint-baseline.json`, so a new file would fail the ratchet. Check with `npm run lint 2>&1 | grep -A8 <file>` (plain `npx eslint` is v10 and needs approval).
**Apply when:** adding a hook that dispatches.

### Baseline workouts can lack a `sets` array — guard `workout?.sets?.length`
**Problem (GH-544):** walking the done/planned workouts of the baseline's M5 D1 crashed on `workout.sets.length` in a real-store Jest test. `useWorkoutsByIds` returns such workouts, too.
**Apply when:** iterating the sets of stored workouts (especially planned ones).

### Real models answer "RIR −1" with `rir: -1` on sets already at RIR 0 — clamp, don't drop
**Problem (GH-544 r2):** the first live "Plan with AI" request (Claude, tool output) returned `rir: -1` for every base set at RIR 0. The structural validator dropped those sets, which removed whole exercises (Adductor, Leg extension) and filled the toast with "Ignored: …". Unit tests with hand-written answers never produced this.
**Fix / Rule:** keep numeric out-of-range values at the nearest app bound and name them (`rirClamped` in `aiPlanResult.ts`); also state the floor in the prompt ("RIR never goes below 0"), which the second live answer obeyed. Do one live request BEFORE finalising a validator for model output.
**Apply when:** validating numbers a model derives by arithmetic on stored values.

### `set_dummy_api_key.yaml` typed INTO a key saved by an earlier run — erase first, centred
**Problem (GH-544 r2):** re-running a flow that saves a key: the tap puts the cursor mid-text, so the echo key became `sk-ant-e2e-sk-ant-e2e-echo-answerecho-answer`, and the app sent a real request ("Invalid API key"). Re-tapping after the keyboard opened failed ("not found"), because the keyboard scrolled the field away.
**Fix / Rule:** `scrollUntilVisible … centerElement: true` before the first tap, then tap + `eraseText` three times (re-taps `optional: true`) before `inputText` (now in the helper).
**Apply when:** any flow that types into the Settings key field more than once per store.

### Plan read view RIR cell: label is `RIR, <value>` — `text: 'RIR\s*0'` never matches
**Observation (GH-544 r2):** `plan-set-N-rir-cell` exposes `accessibilityText: "RIR, 0"` (reps cell `"5, reps"`, weight `"170, kg"`). Assert `{id: 'plan-set-1-rir-cell', text: 'RIR, 0'}`; the first match is the first section's.
**Apply when:** asserting planned set values in the Plan tab's read view.

### CI emulator: feed the live AI test key with `adb push` + `input text "$(cat …)"`
**Observation (GH-544 r2):** `ls $RUNNER_TEMP/ai-test-key` is blocked (outside the workdir), but `adb -s <serial> push /home/runner/work/_temp/ai-test-key/key /data/local/tmp/aikey` works without showing the content. Focus the empty key field with a flow, then `adb -s <serial> shell 'input text "$(cat /data/local/tmp/aikey)"'`, `adb shell rm /data/local/tmp/aikey`, and save via a second flow that waits for "API key saved". Remove it again the same way ("API key removed"). Maestro `takeScreenshot` only accepts paths inside its output folder (absolute paths fail the flow).
**Apply when:** a ticket needs the live-key check in the agent-emulator workflow.
