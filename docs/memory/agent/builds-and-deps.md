# Builds, APKs & dependencies

Gradle builds, APK size/installs, `node_modules`, `patch-package`, and notes from past React Native upgrades.
Back to the [index](../agent-memory.md).

### Unset JAVA TOOL OPTIONS before gradle
**Problem:** the orchestrator exports `JAVA_TOOL_OPTIONS=-Duser.home=<run_dir>/checks/maestro-java-home` for Maestro. Gradle inherits it ("Picked up JAVA_TOOL_OPTIONS"), resolves `~/.gradle` under that empty dir and re-downloads everything — builds overrun the 10-min tool cap (exit 143 = harness SIGTERM, not a build error) or CMake/NDK steps fail.
**Fix:** `env -u JAVA_TOOL_OPTIONS ./gradlew assembleDebug …` (or `unset JAVA_TOOL_OPTIONS`); leave it set for Maestro. Echo it first when a build is mysteriously slow. (seen in GH-316, GH-358, GH-421)

### Long builds inside the tool timeout
**Never** background a build and end the turn — the process dies with zero verification.
- Fit it in one foreground call: build only the device ABI — `adb -s $S shell getprop ro.product.cpu.abi` → `./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain` (~3 min vs ~15 min cold). Not for artifacts whose ABI coverage matters.
- Or detach and poll in the same turn: `setsid nohup env -u JAVA_TOOL_OPTIONS bash -c './gradlew assembleDebug …; echo $? > $RUN/checks/build.exitcode' > $RUN/checks/build.log 2>&1 < /dev/null &`, then poll `[ -f build.exitcode ]` in further calls (`perl -e 'select(undef,undef,undef,5)'` as sleep).
- Expect 5–17 min cold, ~1 min incremental. Skip the build entirely for JS-only diffs ([JS-only](metro-and-bundling.md#js-only-changes-need-no-gradle-rebuild)) — and a native build in the shared `node_modules` kills sibling Metros ([shared node_modules](#worktree-node_modules-is-a-symlink-to-the-shared-repo-node_modules)).
(seen in GH-316, GH-358, GH-421)

### Shrink the debug APK to the device ABI
**Context:** `android/app/build.gradle` debug `ndk.abiFilters "x86_64", "arm64-v8a"`; full debug APKs measured 132–242 MB, too big for the emulators' cramped `/data` (see [emulator storage](adb-and-emulators.md#install-failed-insufficient-storage-on-an-emulator)).
**Options:** `./gradlew assembleDebug -PreactNativeArchitectures=x86_64` (emulator) — repackages in ~15 s when natives are built; produced 119–132 MB APKs. One round found `lib/arm64-v8a/` still packaged: strip it without a build change — `zip -d app-debug.apk "lib/arm64-v8a/*"`, `zipalign -f -p 4`, re-sign with `apksigner sign --ks android/app/debug.keystore --ks-pass pass:android`. Check with `unzip -l app-debug.apk | grep lib/`. Never put ABI filters into `release`.
(seen in GH-391, GH-396)

### Release signing is not available to workers
The release keystore and `ANDROID_RELEASE_PASSWORD` live on the user's Windows machine. To verify a runtime fix in a release-like build, temporarily switch `signingConfig signingConfigs.release` → `signingConfigs.debug`, do NOT commit that, install via `adb install -r`. Final signed-release verification is the user's job after merge.

### Gradle failures that are build-state corruption
- **First build of a fresh worktree crashes on launch** with `NoClassDefFoundError … NativeSafeAreaContextSpec` (class IS in the dex): `./gradlew :app:clean :react-native-safe-area-context:clean` then `./gradlew :app:assembleDebug --rerun-tasks`. The FATAL is on a pool thread after `am start` returns, so a 15 s cold-start grep misses it — verify with one `launchApp` flow or `pm clear` + start + 30 s + `logcat -d | grep -E "FATAL EXCEPTION|NoClassDef"`.
- **`BUILD SUCCESSFUL` but `SoLoaderDSONotFoundError: libworklets.so`** after an interrupted earlier build: the merge/strip tasks were UP-TO-DATE for one ABI. `rm -rf android/app/build/intermediates/merged_native_libs android/app/build/intermediates/stripped_native_libs android/app/build/outputs/apk` and rebuild (~15–45 s); verify `unzip -l app-debug.apk | grep lib/x86_64/libworklets.so`.
- **`Could not read workspace metadata from …/transforms/<hash>/metadata.bin`** with new hashes every run: project-local state — `rm -rf android/.gradle android/build android/app/build`, not `~/.gradle/caches`.
- **Kotlin type-inference errors in gesture-handler / `method does not override` in a dependency:** `node_modules` don't match `package.json` (or patches got clobbered) — `npm ci` + `npx patch-package` before gradle.
- A flaky native step (e.g. react-native-screens CMake link error) orthogonal to a JS-only ticket: skip the rebuild.
(seen in GH-307, GH-361, QA-MAESTRO-001)

### Autolinking guardrail and Kotlin plugin
- `android/settings.gradle` autolinks from a pre-generated `autolinking.source.json` (Windows workaround) and has a configure-time guardrail that throws when zero Android native deps were linked — a 0-byte autolinking JSON otherwise ships a release APK that crashes on the first native module. Don't remove it.
- The app module needs the Kotlin Android plugin (`org.jetbrains.kotlin.android`) for variant-aware resolution of KMP libraries (e.g. `androidx.datastore`); without it release builds crash with `NoClassDefFoundError` for top-level Kotlin functions while debug works.
- `compileSdk`/`buildToolsVersion` must stay within what the pinned AGP supports.

### Worktree node_modules is a symlink to the shared repo node_modules
**Observation:** `.worktrees/<x>/node_modules -> ../../node_modules`. Editing a file there edits it for EVERY worktree; `patch-package` diffs that shared package; `./gradlew assembleDebug` writes into `node_modules/*/android/build/…`, which kills sibling Metros watching it.
**Rules:** `readlink -f node_modules/<pkg>` before patching; treat a native build as having blast radius while siblings run; don't leave half-edits in shared packages.
(seen in GH-401)

### npm install and patch-package discipline
- After ANY `npm install`, immediately `npx patch-package` (no args = APPLY all patches); `npm install` can bump unrelated transitive deps and clobber patched files (`react-native-document-picker` 9.1.1 → 9.3.1 broke compile). Only patches physically in `./patches/` are applied by `postinstall`; if a patch mentioned elsewhere is missing on your branch, fetch it: `git show origin/master:patches/<name>.patch > patches/<name>.patch`.
- `npx patch-package <name>` REGENERATES (create mode) the patch from current `node_modules`; it never re-applies.
- Before regenerating, delete build outputs inside the package (`node_modules/<pkg>/android/build`, `android/.cxx`) or the patch fills with binaries (4.5 MB / 85k lines instead of ~130).
- Check an appended line didn't land after `//# sourceMappingURL` (it is then commented out — an export vanished and the Plan screen crashed).
- RN resolves some packages via `"react-native": "src/index"` — patch `src/`, not only `lib/`. A repo-root ambient `declare module` file (`sharingan-rn-modal-dropdown.d.ts`) shadows the package's types — add patched props there too.
- Validate an RN upgrade with a fresh `npm ci` (strict peer deps; `.npmrc` has `legacy-peer-deps=true` for React 19), not only `npm test` on reused `node_modules`.
(seen in GH-124, GH-135, GH-324, GH-403)

### Regenerating or merging a patch while other worktrees are live
- Regenerating from the SHARED `node_modules` swallows other worktrees' unmerged edits to the same package into YOUR patch. Rebuild the package state first: back up the package, reverse your edits, `git apply -R <other branch's patch>` → pristine, apply master's patch, replay your edits (keep them in a replayable `--reverse`-capable script), run patch-package, restore the backup. Verify `git diff patches/ | grep <other ticket id>` is empty. Don't rebuild "pristine" via `npm pack` — the repo pins `github:julianMMetzger/sharingan-rn-modal-dropdown` whose layout differs from the npm tarball.
- A conflicted patch file: never merge hunks. Copy the package to scratch, `patch -p1 -R` your patch → pristine (must reverse without fuzz), build base/master/branch states into separate copies, `diff -ru M O`; if only your edits differ, `git checkout --ours` is correct. Round-trip before committing.
(seen in GH-401, GH-403)

### Current patches in this repo
- GH-642 removed `sharingan-rn-modal-dropdown` and `react-native-modal` (only sharingan used it) together with their patches, the `.d.ts` and the `overrides` entry. If either comes back, the old `BackHandler.removeEventListener` crash of `react-native-modal` 13 returns with it (`git show 6264d7a:patches/react-native-modal+13.0.1.patch`).
- `react-native-document-picker+9.3.1.patch`: RN 0.80 removed `GuardedResultAsyncTask`; replaced by a helper + executor. When writing such native patches: use an instance `ExecutorService` shut down in `invalidate()` (a static one leaks a thread per reload), and capture `promise` as a final local before `executor.execute(...)` and call `promise.reject(...)` directly (`sendError` uses a field that may already be null).
- `react-native-draggable-flatlist+4.0.3.patch` — see [shared patch rules](#regenerating-or-merging-a-patch-while-other-worktrees-are-live).

### React Native upgrade notes still relevant
Current stack: RN 0.84.1, React 19, New Architecture, reanimated 4.3 + `react-native-worklets`, `@react-navigation/*` v7, mmkv 3.
- RN ≥ 0.82 forces the New Architecture (`newArchEnabled=false` is silently overridden); keep `newArchEnabled=true` explicitly — MMKV 3 needs it for codegen.
- RN 0.82 needs the `appmodules` library: `android/app/src/main/cpp/CMakeLists.txt` is `project(appmodules)` + `ReactNative-application.cmake`, with the custom `gainalytics_native` lib built separately from `native/` (so the `*.cpp` glob doesn't pull it into appmodules) — missing it → `couldn't find DSO to load: libappmodules.so`.
- Reanimated ≥ 4 requires `@react-navigation/drawer` v7 (v6 throws "useLegacyImplementation … not available with Reanimated 3") and a `react-native-worklets` jest mock (see [unit-testing](unit-testing.md#native-module-and-animation-mocks)).
- react-navigation v7 throws on an `initialRouteName` that names no registered screen.
- React 19 ignores `defaultProps` on function components (see [react-native-ui](react-native-ui.md#react-19-ignores-defaultprops-on-function-components)).
- `edgeToEdgeEnabled=true` in `android/gradle.properties` (see [edge-to-edge](react-native-ui.md#non-edge-to-edge-android-double-counts-the-status-bar-inset)).
(seen in GH-124, GH-135, GH-139, GH-356)
