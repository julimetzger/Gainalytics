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
