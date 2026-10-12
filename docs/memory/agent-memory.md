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
**Observation (GH-486 round 2):** a one-exercise store was needed. `__tests__/testdata/scripts/make_gh486_fixture.js` strips `baseline.gains` to one exercise (≈85 KB instead of 1.7 MB) and keeps all references consistent. `gh486_import_fixture.yaml` is `00_import_baseline` with `tapOn: '${FIXTURE}'`, called via `runFlow: {file: …, env: {FIXTURE: x.gains}}` after `adb push x.gains /sdcard/Download/`. The SAF picker listed the pushed files without a media scan.
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
**Problem / Symptom:** In a feedback round the run-dir helper script still hardcoded the round-1 proxy (`--host 127.0.0.88`), which was no longer running. Switching it to the gateway (`--host 172.18.240.1 --device emulator-5556`) made Maestro log "Selected device emulator-5556" while `launchApp` force-stopped and relaunched the app on R5CN30HWZFN (`Got device info … widthPixels=720`). Every assertion failed even though uiautomator on the emulator showed the element.
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
