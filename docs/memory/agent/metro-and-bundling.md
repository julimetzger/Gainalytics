# Metro & JS bundling

How JS reaches the device in this repo, and how to prove which code is actually running.
Back to the [index](../agent-memory.md).

### Reuse the orchestrator Metro and prove it serves your worktree
**Rule:** Never start a second packager when the orchestrator supplies `E2E_METRO_PORT`; expose it with `adb -s "$ANDROID_SERIAL" reverse tcp:${E2E_DEVICE_METRO_PORT:-8081} tcp:$E2E_METRO_PORT` (verify with `adb reverse --list`).
**Trap:** the "host Metro" port can belong to a SIBLING worktree (`/status` says running, logcat says `isMetroRunning(): Async result = true`, yet the old UI shows). Check the owner with `readlink /proc/<pid>/cwd` or `curl -s "http://127.0.0.1:$PORT/index.bundle?platform=android&dev=true" | grep -o '"/home[^"]*<ChangedFile>.tsx"'` — it must show YOUR worktree path.
**Fix:** start your own packager on a free port with a run-dir config (see [Metro watcher crashes](#metro-watcher-crashes-enospc-or-enoent)), reverse to it, and pass `--metro-port <port>` to `run-maestro-from-wsl.sh` (otherwise it resets the reverse to `E2E_METRO_PORT`). Note the committed `metro.worktree.config.cjs` is per-worktree generated and can point at a deleted worktree — check `projectRoot`.
(seen in GH-462, GH-358)

### Debug APK embeds a JS bundle; Metro is only preferred
**Observation:** `android/app/build.gradle` sets `react { debuggableVariants = [] }`, so `assembleDebug` runs `createBundleDebugJsAndAssets` and bakes `assets/index.android.bundle` into the debug APK. At launch the dev app probes Metro first and silently falls back to the embedded bundle when Metro is unreachable — the device then runs build-time JS with no error.
**Rule:** for every device round prove the source: logcat `isMetroRunning(): Async result = true` + a new `BUNDLE ./index.tsx` line in the Metro log = Metro; `Async result = false` / `The packager does not seem to be running … 10.0.2.2 (port 8081)` = embedded bundle.
**If Metro cannot be made reachable:** rebuild + `adb install -r` so the embedded bundle carries your code. Verify the APK: `unzip -p app-debug.apk assets/index.android.bundle | grep -ao <marker> | wc -l` (Hermes bytecode; `grep -c` is useless). To force a fresh bake delete `android/app/build/generated/assets/react/debug/index.android.bundle` and `.../intermediates/assets/debug/mergeDebugAssets/index.android.bundle` and watch the task EXECUTE (not UP-TO-DATE).
**Also:** a shared device may carry a RELEASE build (`dumpsys package <pkg>` has no `DEBUGGABLE` flag) — Metro does nothing until a debug APK is installed (`install -r` keeps data, same signature).
See also: [Emulator Metro host](#emulator-resolves-metro-at-10022-which-bypasses-adb-reverse), [JS-only changes](#js-only-changes-need-no-gradle-rebuild).

### Emulator resolves Metro at 10.0.2.2 which bypasses adb reverse
**Problem:** a stock emulator (fingerprint `google/sdk_gphone…`) fetches `http://10.0.2.2:8081/…` — the host alias, resolved at network level — so `adb reverse tcp:8081 …` never sees the traffic and the app falls back to the embedded bundle.
**Fix A (preferred):** point the dev host at the device loopback so the reverse tunnel carries it. The pref lives in `<pkg>_preferences.xml` (NOT `devtools_settings.xml`):
`adb -s $S shell "run-as $PKG sh -c 'cat > /data/data/$PKG/shared_prefs/${PKG}_preferences.xml'" <<< '<map><string name="debug_http_host">localhost:8081</string></map>'`
then `adb reverse tcp:8081 tcp:$E2E_METRO_PORT`, force-stop + `am start`. Alternatives: `printf … | adb shell "run-as $PKG tee …"`, or `adb push prefs.xml /data/local/tmp/` + `run-as $PKG sh -c 'cat /data/local/tmp/prefs.xml > …'` (a heredoc *inside* run-as fails with Permission denied). Never `printf "...\\n..."` inside quoted adb shell — literal `\n` makes the XML unparseable and is silently ignored.
**Fix B:** `debug_http_host=10.0.2.2:<E2E_METRO_PORT>` — WSL localhost forwarding already exposes the worktree Metro to the emulator; test from the device: `adb shell "printf 'GET /status HTTP/1.0\r\n\r\n' | toybox nc -w 5 10.0.2.2 <port>"` must answer `HTTP/1.1 200 OK`.
**Always:** `clearState: true` / `pm clear` wipes the pref — re-set it. Restore `127.0.0.1:8081` + the reverse before handing the device over. If the pref is already `127.0.0.1:8081`, a correct reverse alone works.
(seen in GH-302, GH-375, GH-414, GH-437, GH-460)

### Avoid socat relays for Metro
**Problem:** a `socat TCP-LISTEN:8081,fork,reuseaddr TCP:127.0.0.1:$PORT` bridge (or a node `net` pipe) has (a) corrupted large chunked bundles → `Compiling JS failed: … non-terminated string / ')' expected` with a line number that changes on every reload while `curl` of the same URL is clean, and (b) gone stale: it accepts the emulator's connection and forwards nothing, so the app hangs on "Loading from 10.0.2.2:8081…".
A shared Metro once also served a corrupt incremental DELTA after a fresh APK install (`non-terminated string at line 286044`, dev-menu reload didn't help) while the full bundle was clean — rebuilding the APK and letting the embedded bundle run worked.
**Rule:** prefer the `debug_http_host` approach above. If a relay is in place: diagnose from the device with the `toybox nc` probe; `pkill`-by-PID the relay and restart it, or remove it entirely. `reuseaddr` is mandatory if you must use one.
See also: [Emulator Metro host](#emulator-resolves-metro-at-10022-which-bypasses-adb-reverse).

### Dev Menu Change Bundle Location
**Use when:** you need a one-off switch of the running process. `adb shell input keyevent 82` → "Change Bundle Location" → clear the field (`KEYCODE_MOVE_END` then ~30× `KEYCODE_DEL`, otherwise you get `80810.0.2.2:PORT` and a port crash) → `adb shell input text "localhost:8081"` → APPLY CHANGES. Confirm the field via `uiautomator dump` before applying.
**Limits:** on this RN version the value does not reliably survive process death; the APPLY tap is flaky from adb; Maestro cannot open the dev menu (`pressKey: Menu` is not a valid key — drive it from a wrapper script before `maestro test`, e.g. `__tests__/e2e/scripts/gh204-r2-evidence.sh`).

### App stuck on splash because of a corrupted debug_http_host
**Symptom:** splash hangs forever after relaunch; logcat `Failed to connect to /127.0.0.1:1` (port 1) while Metro `/status` answers.
**Fix:** `adb shell run-as <pkg> cat /data/data/<pkg>/shared_prefs/<pkg>_preferences.xml`, fix the host (`run-as <pkg> sed -i 's#127.0.0.1:1<#127.0.0.1:8081<#' <file>`), force-stop + relaunch. Check this before suspecting Metro or the reverse. (seen in GH-346)

### adb reverse gets wiped
**Observation:** the reverse disappears whenever the adb server or device transport restarts: a `maestro test` run exit, an aborted Maestro run whose runner retry relaunches the app, a guest reboot, an adb server restart. The app then white-screens on "Loading from 127.0.0.1:8081…" (it never retries) or silently runs the embedded bundle.
**Rule:** re-add `adb -s "$ANDROID_SERIAL" reverse tcp:8081 tcp:$E2E_METRO_PORT` before EVERY Maestro invocation and every app relaunch, then force-stop + relaunch. A keep-alive loop (`while true; do adb reverse …; sleep 1; done`) helps on a direct adb host, but do NOT run it through an adb filter proxy — it starves Maestro's connections (`UNAVAILABLE: Network closed`). See [adb filter proxy](adb-and-emulators.md#use-an-adb-filter-proxy-that-exposes-only-your-device).
(seen in GH-394, GH-436, GH-391)

### Prove which JS the device runs before debugging the fix
**Rule:** when a change "does not show up" or behaviour is byte-identical to before, check in this order:
1. `curl -s "http://127.0.0.1:$PORT/index.bundle?platform=android&dev=true&minify=false" -o /tmp/b.js && grep -c <new identifier or fix comment> /tmp/b.js` (dev bundles keep comments). The curl also forces Metro to rebuild when its watcher missed the edit.
2. Metro log grows a `BUNDLE` block AFTER your edit's timestamp when the app cold-starts; a log with a single startup `BUNDLE` block = dead watcher.
3. logcat `isMetroRunning(): Async result = true`.
4. A UI marker that only the new code renders (`grep -c` on a uiautomator dump).
If the bundle provably contains the fix and behaviour is unchanged, the hypothesis is wrong, not the deployment. Multi-Edit sequences make Metro log transient TransformErrors — only the last build matters. If a new BUNDLE was logged but the served bundle is still old → restart Metro with `--reset-cache`.
(seen in GH-277, GH-367, GH-382, GH-468)

### JS-only changes need no Gradle rebuild
**Rule:** if the diff is `app/**` TS/TSX only (no `android/`, `patches/` native code, `package.json` deps, codegen), the installed debug APK + your Metro already run the branch — once Metro is proven reachable (see above). Reload with `adb shell am force-stop <pkg> && adb shell am start -n <pkg>/.MainActivity`.
**Faster reloads:** `adb shell input text "RR"` triggers a full reload from Metro. Fast Refresh/HMR deltas frequently do NOT apply in this WSL setup — batch edits, then force-stop + relaunch. If the app still loads an old bundle after force-stop, delete the bridgeless cache: `adb shell "run-as <pkg> rm -f files/BridgelessReactNativeDevBundle.js"`.
**Hook-count change:** swapping a file that adds/removes a hook throws `Should have a queue. You are likely calling Hooks conditionally` under Fast Refresh — force-stop + relaunch instead (store survives).
Still do one final build if the shipped APK's embedded bundle must carry the fix. See also: [Debug APK embeds a JS bundle](#debug-apk-embeds-a-js-bundle-metro-is-only-preferred).

### Metro watcher crashes ENOSPC or ENOENT
**Symptoms:** Metro exits with `ENOSPC: System limit for number of file watchers reached` (several workers watch the shared `node_modules`), or with `ENOENT: watch …/android/build/intermediates/…` / `.cxx/…` when ANY worktree's gradle build deletes transient dirs under the shared `node_modules` (the next reload then red-screens).
**Fix:** run Metro from a run-dir config with a `resolver.blockList` built as `new RegExp([...].join('|'))` covering `/node_modules/[^/]+/android/build/.*`, `.*/android/\.cxx/.*`, `.*/build/intermediates/.*`, `/android/app/build/.*`, `/\.gradle/.*`, `/\.git/.*` (the `metro-config/.../exclusionList` subpath is not exported). Start: `npx react-native start --config <run_dir>/metro.worktree.config.cjs --host 0.0.0.0 --port $E2E_METRO_PORT`. `CI=true npm start` also avoids watchers, but then Metro does NOT watch files — restart it after every JS edit (kill by PID from `ss -ltnp`, never `pkill -f`).
**Treat "Loading from …" hang as:** `curl -m 5 http://127.0.0.1:$E2E_METRO_PORT/status` first.
(seen in GH-340, GH-391, GH-394, GH-458)

### Metro serves stale modules or 404 or 500
**Symptoms:** red screen `Unable to resolve ./index` although the file exists; `Failed to get the SHA-1 for …/metro-runtime/…/require.js` + HTTP 500 on every bundle; edits never arrive.
**Cause:** a long-running packager's haste map/file map predates the worktree rewrite (or is shared across worktrees). `touch` does not help.
**Fix:** kill THAT packager by PID and restart it on the same port/config with `--reset-cache` (also once after creating a worktree). JS-only, no native rebuild needed.

### Last resort serve a prebuilt dev bundle
**Use when:** Metro cannot even watch the project root (ENOSPC on `<worktree>`), `watch:false` configs still crash, and the change is JS-only.
**How:** `npx react-native bundle --platform android --dev true --entry-file index.tsx --bundle-output <run_dir>/bundle/index.bundle --config <run_dir>/metro.worktree.config.cjs` (entry is `index.tsx`, not `index.js`). Serve it with a ~20-line python `http.server` on the Metro port that answers `/status` → `packager-status:running` (without it the app deems Metro not running) and any `*.bundle` path with the file. Set `debug_http_host` + `adb reverse`, confirm `isMetroRunning(): Async result = true` and grep a new testID in the bundle. Rebuild the bundle after every edit. (seen in GH-442, GH-460)

### APK and bundle from different RN versions
**Symptom:** `TurboModuleRegistry.getEnforcing(...): 'PlatformConstants' could not be found`, or a drawer `useLegacyImplementation` crash, right after loading a bundle.
**Cause:** the installed APK was built against a different `react-native`/reanimated than the `node_modules` the serving Metro uses.
**Fix:** compare `node -e "console.log(require('./node_modules/react-native/package.json').version)"` in the Metro's project with the APK's origin; install an APK built from the same `node_modules`. Worktree `node_modules` is a symlink to the repo root (see [shared node_modules](builds-and-deps.md#worktree-node_modules-is-a-symlink-to-the-shared-repo-node_modules)), so mismatches now mostly come from stale APKs.

### Cold start crashes with setImmediate or window does not exist
**Symptom:** `[runtime not ready]: ReferenceError: Property 'setImmediate' doesn't exist` (then `window`) from `LogBox.ignoreLogs` on cold start with the Metro dev bundle; the baked bundle is fine.
**Cause:** the RN 0.84 bridgeless dev bundle does not run `InitializeCore` before main.
**Rule:** `index.tsx` must keep `polyfillImmediate` (which `require('react-native/Libraries/Core/InitializeCore')`) as its FIRST import — check it is still there before suspecting feature code. Don't shim individual globals.

### Reading JS console output
**Observation:** RN 0.84 bridgeless routes `console.log` to React Native DevTools (Metro prints "JavaScript logs have moved!"); on the Samsung phone `adb logcat -s ReactNativeJS:V` stays empty. Some emulator runs did show `ReactNativeJS` lines, so a clean logcat grep is NOT evidence that a log is absent.
**Reliable:** `curl http://<metro>:<port>/json/list` → `webSocketDebuggerUrl`; connect with the `ws` package from `node_modules`, send `{"method":"Runtime.enable"}` and collect `Runtime.consoleAPICalled`. Alternatives: render the value in an on-screen `<Text>` badge, or write it somewhere the host can pull.
(seen in GH-313, GH-324, GH-414)
