# Worker Infrastructure Time Analysis

This document tracks how much time workers spend on infrastructure vs. feature work,
which problems recur, and which workers are affected. Use this to identify systemic
issues and prevent agents from re-discovering known solutions.

Last updated: 2026-04-12 (GH-71-fb7)
Last updated: 2026-04-12 (GH-95-r3)
Last updated: 2026-04-13 (GH-109)
Last updated: 2026-04-13 (GH-113-fb1)
Last updated: 2026-04-14 (GH-130)
Last updated: 2026-04-16 (merge: GH-127 + GH-130)
Last updated: 2026-04-17 (GH-124-fix1)
Last updated: 2026-04-18 (GH-124-fix1 r2)
Last updated: 2026-04-18 (GH-133)
Last updated: 2026-04-18 (GH-143)
Last updated: 2026-04-18 (GH-139)
Last updated: 2026-04-18 (GH-139-fix1)
Last updated: 2026-04-19 (GH-151 r2)
Last updated: 2026-04-19 (GH-152 r2)
Last updated: 2026-04-19 (GH-153)
Last updated: 2026-04-19 (GH-159-fix1)
Last updated: 2026-04-19 (GH-157)
Last updated: 2026-04-19 (GH-157-fix1)
Last updated: 2026-04-20 (GH-163)

## Per-Worker Breakdown

| Ticket | Device | Driver-Port | gRPC Crash | Wrong Device | ADB Reverse | Metro | Red Screen | Build | Screenshot | Feedback Rounds | Final Status |
|--------|--------|-------------|------------|-------------|-------------|-------|------------|-------|------------|----------------|-------------|
| ANA-001 | emu | 34 | 0 | 7 | 15 | 4 | 14 | 16 | 0 | 10 | closed |
| ANA-002 | emu | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 4 | closed |
| ANA-003 | emu | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 7 | closed |
| ANA-003-fix | real | 3 | 0 | 0 | 2 | 0 | 0 | 2 | 0 | 4 | review |
| ANA-004 | emu | 35 | 24 | 6 | 8 | 4 | 47 | 48 | 1 | 5 | review |
| ANA-005 | emu | 9 | 4 | 0 | 2 | 1 | 43 | 16 | 6 | 0 | review |
| TRN-002 | emu | 6 | 0 | 2 | 2 | 2 | 14 | 3 | 12 | 6 | review |
| TRN-003 | emu | 24 | 6 | 4 | 16 | 8 | 24 | 10 | 0 | 0 | review |
| ANA-001-fix | emu | 10 | 7 | 4 | 22 | 23 | 27 | 16 | 2 | 0 | review |
| ANA-004-fix | emu | 8 | 8 | 2 | 5 | 7 | 21 | 13 | 0 | 0 | review |
| ANA-004-fix2 | real | 2 | 0 | 0 | 1 | 5 | 0 | 0 | 0 | 0 | ready_for_review |
| ANA-005-fix | emu | 13 | 1 | 3 | 6 | 2 | 4 | 6 | 0 | 0 | review |
| ANA-003-fix2 | emu | 2 | 15 | 0 | 0 | 0 | 0 | 0 | 12 | 8 | ready_for_review (r9) |
| TRN-004 | emu | 18 | 8 | 12 | 3 | 0 | 0 | 0 | 0 | 0 | ready_for_review (r2) |
| TRN-004-fix | emu | 0 | 0 | 0 | 5 | 0 | 0 | 0 | 0 | 0 | ready_for_review |
| TRN-004-r3 | real | 7 | 0 | 0 | 8 | 0 | 5 | 0 | 0 | 0 | ready_for_review |
| TRN-004-r4 | real | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 3 | 0 | ready_for_review |
| TRN-005 | emu | 4 | 3 | 0 | 2 | 0 | 2 | 8 | 0 | 2 | ready_for_review (r2) |
| ANA-006-fix | emu | 0 | 0 | 0 | 8 | 35 | 0 | 0 | 5 | 2 | ready_for_review (r2) |
| MNT-002 | emu | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ready_for_review |
| EXC-001-fix | emu | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | ready_for_review |
| GH-46-fix2 | emu | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 5 | ready_for_review |
| GH-71 | emu | 0 | 0 | 0 | 1 | 8 | 1 | 0 | 0 | 0 | ready_for_review |
| GH-71-fb2 | emu | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 | ready_for_review |
| GH-86 | emu | 7 | 0 | 0 | 8 | 45 | 5 | 10 | 0 | 2 | ready_for_review (r2) |
| GH-86 (r4) | emu | 12 | 0 | 0 | 2 | 5 | 3 | 0 | 0 | 4 | ready_for_review (r4) |
| GH-82 | real | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 15 | 2 | ready_for_review (r2: adb server unavailable during fix round, unit tests primary evidence) |
| GH-71-fb5 | emu | 0 | 0 | 0 | 2 | 30 | 8 | 0 | 0 | 0 | ready_for_review (Maestro driver ports all mapped to wrong device after ADB server restart; direct adb screenshots used as layout evidence) |
| GH-71-fb6 | emu | 0 | 0 | 8 | 5 | 20 | 10 | 0 | 0 | 0 | ready_for_review (emulator uses 10.0.2.2:8081 not adb reverse; fresh install failed disk full ~720MB; cleared GMS/Play caches to free 300MB; Dev Settings localhost:8081 fix) |
| GH-71-fb7 | emu | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ready_for_review (ADB_SERVER_SOCKET Windows host unreachable; logic-only fixes — reused fb6 screenshots; 20 unit tests primary evidence) |
| GH-94 | real | 0 | 0 | 0 | 1 | 0 | 0 | 1 | 0 | 3 | ready_for_review |
| GH-94-r4 | emu | 0 | 5 | 0 | 1 | 0 | 0 | 2 | 0 | 4 | ready_for_review |
| GH-77 | emu | 0 | 0 | 0 | 2 | 8 | 12 | 0 | 3 | 2 | ready_for_review |
| GH-77-fix | emu | 0 | 0 | 0 | 0 | 15 | 18 | 0 | 2 | 0 | ready_for_review (r2) |
| GH-86 | emu | 7 | 0 | 0 | 8 | 45 | 5 | 10 | 0 | 2 | ready_for_review (r2) |
| GH-86 (r4) | emu | 12 | 0 | 0 | 2 | 5 | 3 | 0 | 0 | 4 | ready_for_review (r4) |
| GH-82 | real | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 15 | 2 | ready_for_review (r2: adb server unavailable during fix round, unit tests primary evidence) |
| GH-98 | emu | 25 | 0 | 0 | 2 | 0 | 0 | 5 | 0 | 0 | ready_for_review (Maestro TcpForwarder broken both ports 7039+7040; storage full solved by removing YouTube) |
| GH-105 | emu | 8 | 0 | 0 | 3 | 0 | 0 | 3 | 0 | 1 | ready_for_review (APK 216MB→77MB via ndk abiFilters; git stash caused merge conflicts in unrelated files; Maestro TcpForwarder stale process; visual screenshot + 277 unit tests as evidence) |
| GH-95 | real | 0 | 0 | 0 | 1 | 0 | 0 | 2 | 5 | 2 | ready_for_review (r2: Samsung override res 720x1600 needed uiautomator dump; no API key so CoachInsightCard not visible in screenshots) |
| GH-95-r3 | real | 0 | 0 | 0 | 0 | 8 | 0 | 0 | 3 | 5 | ready_for_review (r3: keychain MMKV migration wiped device data; Metro blocklist needed for android/build; unit tests primary evidence for CoachInsightCard) |
| GH-72 | emu | 7 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 3 | ready_for_review (r3: P1 logic fix + unit tests; ADB server down in fix round — no device re-run; unit tests sufficient) |
| GH-77-fix2 | emu | 0 | 0 | 0 | 1 | 0 | 0 | 5 | 0 | 0 | ready_for_review (r3: Gradle CMake/reanimated rebuild failed, JS-only changes served via existing APK+Metro) |
| GH-109 | emu | 0 | 0 | 0 | 0 | 0 | 0 | 6 | 0 | 0 | ready_for_review (RN 0.72→0.73 upgrade; npm dedup dropped vector-icons + @react-navigation/native — promoted to direct deps; release keystore missing in worktree → used `-x packageRelease`; emulator /data full → uninstalled YouTube; no Maestro/driver issues) |
| GH-113 | real | 0 | 0 | 0 | 0 | 0 | 0 | 20 | 0 | 0 | ready_for_review (RN 0.73→0.75 upgrade; autolinking moved into Settings plugin, androidx.core 1.16 forced back to 1.13.1, JetifyTransform OOM → Xmx4096m, arm64-v8a added to debug abiFilters, Flipper removed from MainApplication.java; smoke.yaml pre-existing fragility in 00_import_baseline.yaml) |
| GH-113-fb1 | real | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | ready_for_review (PR #114 review: ios/Podfile still on RN 0.73 template with FlipperConfiguration — rewrote to match RN 0.75.5 upstream template byte-for-byte, cleaned dead FB_SONARKIT_ENABLED block from AppDelegate.m; `pod install` not runnable on WSL so verified via template diff; npm test hit the /.worktrees/ ignore-pattern gotcha — overrode on CLI) |
| GH-124-fix1 | emu | 0 | 0 | 0 | 1 | 0 | 0 | 2 | 3 | 0 | ready_for_review (patch-package emitted 4.5 MB with Gradle build artifacts → rm -rf android/build first; exact Settings button coords via uiautomator dump; npm test must run from main project root not worktree) |
| GH-124-fix1 r2 | emu | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ready_for_review (clean run: patch edited manually, patch-package verify only; `gh pr edit --body` fails with GraphQL Projects deprecation → use `gh api ... PATCH` instead) |
| GH-115 | real | 0 | 0 | 0 | 0 | 0 | 0 | 30 | 0 | 0 | ready_for_review (root `node_modules` stale at RN 0.72 after the #114 RN 0.75 bump → `com.facebook.react.settings` plugin-not-found, jest `@react-native/babel-preset` missing; fixed with one `npm install --legacy-peer-deps` at repo root; `your_key_name.keystore` + `ANDROID_RELEASE_PASSWORD` missing in worker env → temporarily swapped release `signingConfig` to `signingConfigs.debug`, built, installed, verified, reverted before commit; Jest `/.worktrees/` ignore pattern hit again — used `--runInBand` + CLI override) |
| GH-127 | real | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | ready_for_review (pure JS fix — createSelector memoization; Maestro import flow failed because app remembered Settings as last tab; imported manually via adb taps; no driver/gRPC/build issues; jest.setup.js NativeAnimatedHelper mock blocked all test suites — removed as known RN 0.76 change) |
| GH-130 | real | 5 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 1 | ready_for_review (no APK rebuild needed — JS-only crash fix via Metro; Maestro TcpForwarder closed-port error was background noise, not fatal; baseline data already loaded from prior session; npm test pre-existing fail: RN 0.75.5 in Windows node_modules vs 0.76.9 in worktree causes NativeAnimatedHelper not found) |
| GH-134 | emu | 5 | 0 | 0 | 8 | 30 | 0 | 20 | 0 | 0 | ready_for_review (Metro at 8084 had pre-existing VirtualView.js TC39 pattern-matching syntax error — bundled JS offline with npx react-native bundle + assembled APK; Maestro TcpForwarder port 7057 closed; imported baseline data manually via adb+app UI; pure JS fix, no native changes) |
| GH-133 | real | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 15 | 0 | ready_for_review (Samsung device screencap produces 0 bytes regardless of method — DRM secure mode; Maestro takeScreenshot bypasses this; stale Maestro JVM process on port 7056 required kill + use port 7058; JS-only change, no APK rebuild; 396 unit tests passed) |
| GH-143 | emu | 0 | 0 | 0 | 15 | 30 | 20 | 20 | 10 | 0 | ready_for_review (pre-existing Gradle Kotlin 2.1.20 vs gesture-handler 1.9.0 metadata mismatch prevented APK build; Hermes lazy bundle incompatibility with GH-135 APK prevented live Metro testing; SharedPreferences debug_http_host fixed via /data/local/tmp intermediary; unit tests primary evidence for fix) |
| GH-142 | emu | 0 | 5 | 0 | 5 | 10 | 0 | 0 | 0 | 0 | ready_for_review (APK build failed — pre-existing CMake/reanimated `No compatible library found`; used GH-135 APK; GH-139 APK incompatible with GH-142 bundle → Drawer `useLegacyImplementation` crash; Maestro import needed retry; baseline fixture has no VL data so `useVelocityLossInsights` always returns []; `with VL` screenshot AC met via unit tests only) |
| GH-139 | real | 0 | 0 | 0 | 1 | 0 | 3 | 2 | 15 | 0 | ready_for_review (RN 0.82→0.84 upgrade; reanimated 4 required react-navigation v7 upgrade; initialRouteName="Feed" typo caught by nav v7; react-native-worklets Jest mock needed; debug build ~10 min first clean build of worklets CMake; no Maestro/ADB issues) |
| GH-139-fix1 | real | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ready_for_review (pure one-line signing-config revert; assembleDebug clean pass; no ADB/Maestro/Metro issues; gh pr edit --body fails with GraphQL Projects deprecation warning but completes) |
| GH-151 | emu | 0 | 0 | 5 | 30 | 15 | 0 | 0 | 0 | 0 | ready_for_review (previous worker committed code but left no status.json or screenshots; debug_http_host pointed at another worker's Metro on :8083 — full APK rebuild required (11 min) to get correct bundle; Maestro import flow failed with WSL ADB server connectivity, imported baseline manually via adb taps; adb reverse + fresh APK worked cleanly for RN 0.84.1 emulator; 24 unit tests primary evidence) |
| GH-144-fix1 | emu | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | ready_for_review (pure logic fix — 2-line change + 3 unit tests; jest /.worktrees/ ignore pattern hit → overrode testPathIgnorePatterns on CLI; no APK/Maestro/ADB issues; 13/13 tests passed) |
| GH-152 | real | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | blocked (device PIN-locked; adb shows "device" state and file pushes succeed but PIN lock screen blocks Maestro; all code complete — 2 new flows, 2 fixtures, script update, 39 flows deleted; 402 unit tests pass) |
| GH-152 r2 | real | 0 | 4 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | ready_for_review (device unlocked; TcpForwarder closed-port noise on port 7001 — non-fatal, retry passed; Android 13 photo picker blocks adb-pushed files (not media-indexed) — flows redesigned to use existing device analysis; Maestro tapOn 'testID' matches text not id — fixed to tapOn {id:}; both flows pass in <60s each) |
| GH-153 | emu | 30 | 45 | 0 | 5 | 5 | 0 | 0 | 15 | 0 | ready_for_review (YAML-only ticket; WSL Maestro gRPC DEADLINE_EXCEEDED on consecutive sessions — workaround: cmd.exe/UNC path; takeScreenshot in UNC mode needs writable Windows CWD; Windows ADB needs -a flag restart for WSL access; DashboardTab pre-existing crash blocks screenshot evidence) |
| GH-159 | emu | 0 | 0 | 0 | 1 | 0 | 0 | 5 | 0 | 0 | ready_for_review (INSTALL_FAILED_INSUFFICIENT_STORAGE — uninstalled app before fresh install to free 720MB; Maestro swipe/scrollUntilVisible cannot scroll RN ScrollView — simplified flow to visible-only assertions; screenshot + uiautomator dump provide below-fold evidence; 432 unit tests all pass) |
| GH-159-fix1 | emu | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | ready_for_review (pure logic fix — no APK rebuild; jest /.worktrees/ ignore pattern hit → testPathIgnorePatterns override on CLI; 436/436 tests pass; cold-start component test added; adb reverse + screencap clean) |
| GH-157 | emu | 0 | 0 | 0 | 5 | 0 | 0 | 10 | 0 | 0 | ready_for_review (new AI Chat tab feature; CMake/reanimated build failed first attempt, passed on retry; MMKV encryption key unstable across emulator sessions → API key unreadable → 401 on all requests despite valid key from WSL curl; live assistant screenshot not possible; unit tests (18/18) + error-handling screenshots as evidence; Jest /.worktrees/ ignore pattern hit — CLI override required) |
| GH-157-fix1 | real | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | ready_for_review (resume round — prior worker crashed due to API image dimension limit from accumulated screenshots; all code changes already in worktree; Jest /.worktrees/ ignore pattern hit again — CLI config override required; gh pr edit --body fails with GraphQL Projects deprecation → used REST API patch; clean real-device run, 35/35 tests pass) |
| GH-163 | real | 0 | 0 | 0 | 1 | 0 | 25 | 0 | 0 | 0 | ready_for_review (resume round — disk-full crash from prior session; corrupted Gradle lock files in android/.gradle/8.14.1/ and maestro-java-home/.gradle/caches/ required targeted deletion; Jest /.worktrees/ ignore pattern hit — removed from jest.config.cjs in worktree; 11/11 MusclePicker tests + 472/472 full suite; real-device screenshots on R5CN30HWZFN; no Metro/gRPC issues) |

Numbers = log line counts mentioning that problem category. Higher = more time wasted.

## Key Findings

### 1. Every worker with emulator verification hits infra issues

ANA-002 is the only worker with zero infra problems — it was a pure logic/UI fix
with no Maestro or emulator interaction. Every other worker spent significant time
on infrastructure.

### 2. Top time sinks (by frequency across workers)

1. **Maestro driver port conflicts** — affects 9/10 workers. Agents spend time
   killing stale Maestro processes, trying different ports, debugging
   `TcpForwarder` errors. The orchestrator assigns ports but agents still fight
   with stale processes from previous runs.

2. **Red screen / app not loading** — affects 8/10 workers. Metro bundle errors,
   app crashes on fresh state, or video analysis overloading the app at startup.
   Agents cycle through reload attempts before finding the actual cause.

3. **Build issues** — affects 8/10 workers. Often `JAVA_TOOL_OPTIONS` leak from
   Maestro setup breaking Gradle, or agents running unnecessary rebuilds.

4. **gRPC DEADLINE_EXCEEDED** — affects 6/10 workers. Maestro driver times out
   on `viewHierarchy` calls, especially with video analysis (CPU-intensive) or
   when `clearState:true` triggers a heavy app restart.

5. **Wrong device targeting** — affects 7/10 workers. Maestro connects to a
   different device than assigned. Happens when stale drivers from other workers
   are still bound to the wrong device.

6. **ADB reverse setup** — affects 8/10 workers. WSL→Windows→Emulator port
   forwarding chain is fragile. Agents spend time debugging why Metro is
   unreachable from the emulator.

### 3. Infra problems cause cascading time loss

A single Maestro driver-port conflict leads to: debug port → kill stale process →
retry Maestro → wrong device attached → re-debug → finally works (or doesn't).
This cascade can consume 30+ agent turns.

### 4. Workers without Maestro verification finish faster

ANA-002 (pure logic fix) and TRN-003 (simple guard addition) had the least infra
overhead. The more device interaction a ticket needs, the more time is lost to
infrastructure.

## What's Already Covered in agent-memory.md

The following infra patterns are already documented in `docs/memory/agent-memory.md`:
- Entry #1: Worker sandbox network access
- Entry #2: Metro must run on host
- Entry #6: Parallel Maestro needs unique driver ports
- Entry #10: Real-device failures can be app bootstrap crashes
- Entry #14: clearState:true + CPU-intensive work = gRPC crash

## Gaps — Not Yet Solved

1. ~~**No automated Maestro cleanup between runs.**~~ **FIXED** (2026-03-30):
   `cleanup_stale_maestro()` in `launch_feature_job.py` kills stale Maestro Java
   processes for the assigned device/port before each worker launch.

2. **No Metro health verification before worker starts.** Workers discover
   Metro is unreachable mid-run and spend time debugging. The launch script
   should verify Metro is reachable from the device before handing off.

3. **JAVA_TOOL_OPTIONS pollutes Gradle.** Maestro setup sets a custom
   `-Duser.home` that breaks subsequent Gradle builds. Workers should unset
   `JAVA_TOOL_OPTIONS` before Gradle or the orchestrator should isolate it.

4. **No preflight device check.** Workers discover the wrong device is attached
   to a stale Maestro session mid-flow. A preflight `adb devices` + Maestro
   driver health check would catch this early.

5. **Agents re-derive WSL/adb/Metro setup.** Despite `__tests__/e2e/README.md`
   and agent-memory.md, agents still try to figure out the networking setup
   from scratch. The feature SKILL.md should include a concrete "Emulator
   Preflight Checklist" with exact commands.

6. **Windows ADB server can go offline between sessions.** When the Windows ADB
   server is not running, socat at 0.0.0.0:5037 exists but all connections are
   refused. A fix round run the next day found this. Workers should detect
   "connection refused to 172.18.240.1:5037" and report as blocked immediately
   rather than trying alternative ports — there is no WSL-side workaround when
   the Windows host ADB server is down.

7. **Physical device PIN lock blocks all adb screencap and Maestro operations.** Samsung devices lock after inactivity; screencap returns 0 bytes, Maestro flows fail before reaching the app. No automated unlock path exists without knowing the PIN. Orchestrator should either keep the device awake (`adb shell svc power stayon true`) or have a known PIN for dev devices.

6. **Windows adb server may not be running in fix/review rounds.** The orchestrator
   starts the socat proxy but does not ensure the Windows adb server is running.
   Fix round workers discover this only after the first adb command fails. The
   orchestrator should include an adb server health check in the fix round launch
   setup (or the fix prompt should note if adb is expected to be unavailable).

7. **`adb reverse` does not cover `10.0.2.2` traffic from AVD emulators.** (GH-86)
   Android AVDs connect to Metro via `10.0.2.2:8081` (host loopback), not
   `127.0.0.1:8081`. `adb reverse tcp:8081 tcp:PORT` only tunnels `127.0.0.1`
   connections, so it has no effect on `10.0.2.2`. Fix: run
   `socat TCP-LISTEN:8081,fork,reuseaddr TCP:127.0.0.1:PORT` on WSL so WSL2
   auto-forwarding propagates Windows `localhost:8081` → WSL socat → Metro.
   The orchestrator or SKILL.md preflight should start this socat bridge
   automatically when Metro is on a non-8081 port.
