# Running Maestro (infra)

Invoking Maestro in this WSL + Windows-adb setup: the runner script, device routing, the driver, long runs and logs.
Flow authoring lives in [maestro-flows.md](maestro-flows.md); app-specific navigation in [app-screens.md](app-screens.md).
Back to the [index](../agent-memory.md).

### The run-maestro-from-wsl.sh modes and flags
`__tests__/e2e/scripts/run-maestro-from-wsl.sh` (Maestro 2.0.9-ports, run from WSL):
- `--mode bootstrap` only PUSHES `baseline.gains` + the two mp4s, sets the reverse, force-stops the app and exits 0 — it never imports. Import by running the FLOW `00_import_baseline.yaml` (e.g. a two-line suite `- runFlow: 00_import_baseline.yaml` / `- runFlow: <your flow>.yaml`, as `gh403_suite.yaml`/`gh417_suite.yaml` do).
- `--fixture <file>` likewise only pushes `<file>` as `/sdcard/Download/baseline.gains`. Import with `--suite __tests__/e2e/maestro/flows/00_import_baseline.yaml --fixture <file>`, then run assertion flows without the flag. `--suite` goes through `realpath` relative to your CWD, NOT the flows dir — a bare `00_import_baseline.yaml` from the worktree root fails with "Flow path does not exist" (seen in GH-504).
- `--mode smoke`/`full`/`bootstrap` push + `am force-stop` the app before the run, and `--suite` defaults to `flows/suite.yaml` in EVERY mode — `--mode smoke` alone runs the full, data-mutating suite. Always pass `--suite`.
- Any other `--mode` value (e.g. `--mode flow`) skips the push/force-stop preamble — use it to probe the app as it stands.
- On failure the script re-runs the WHOLE suite once (import included). Kill the retry by PID once "Flow Failed" appears, then check the device for leftover dialogs. A first-attempt failure followed by a pass hides real problems.
- Other flags: `--host`, `--adb-host`, `--adb-port`, `--metro-port`, `--device-metro-port`, `--driver-host-port`, `--report`. The report directory must exist (`mkdir -p`) or the script dies at `cd` with no Maestro output.
- If the push fails (`adb push … Permission denied`) and the data is already on the device, call `maestro` directly (see [direct invocation](#invoke-maestro-directly)).
(seen in GH-292, GH-356, GH-417, GH-428, GH-443, GH-466, GH-468)

### Invoke Maestro directly
`HOME="$E2E_MAESTRO_HOME" XDG_CACHE_HOME="$E2E_MAESTRO_HOME/.cache" MAESTRO_CLI_NO_ANALYTICS=1 maestro --host <adb host or proxy> --device "$ANDROID_SERIAL" --driver-host-port "$E2E_MAESTRO_DRIVER_PORT" test <ABSOLUTE flow path> --format junit --output <xml> --debug-output <dir>`
- `--host`, `--device` and `--driver-host-port` are GLOBAL options and must come BEFORE `test` (after it picocli prints usage and exits 2). `--host` does not appear in `maestro --help`, but runs confirm it selects the adb host; `--port` is ignored.
- Use it for flows that must start on an already-open screen (the wrapper force-stops the app) and when the wrapper's push fails.
- `cd` into the run dir's screenshot folder first (see [takeScreenshot location](#takescreenshot-writes-relative-to-the-maestro-cwd)) and pass the flow as an absolute path.

### Maestro drives the wrong device on a multi-device adb server
**Problem:** with more than one device on the Windows adb server, Maestro (dadb) uses the FIRST listed device — regardless of `--device`, `ANDROID_SERIAL`, `--driver-host-port`, or the log line `Selected device emulator-5556`. Seen repeatedly: flows "passed" while the assigned emulator sat at the launcher; `00_import_baseline` replaced the store of ANOTHER session's phone; Maestro's own driver install went to a full sibling emulator. Running without `--host` makes Maestro use `127.0.0.1:5037` (usually empty or a sibling's proxy).
**Fix:** always route Maestro through a filter proxy that exposes only `$ANDROID_SERIAL` — see [adb filter proxy](adb-and-emulators.md#use-an-adb-filter-proxy-that-exposes-only-your-device) — and start it BEFORE the first Maestro call, especially before any flow that writes (import, clearState, delete). The wrapper derives `--host`/`--adb-host` from `/etc/resolv.conf` when you omit them, which bypasses every local proxy — pass both explicitly.
(seen in GH-221, GH-240, GH-277, GH-340, GH-367, GH-393, GH-401, GH-442, GH-462)

### Verify which device Maestro actually drove
After EVERY run: `grep -oh "Width: [0-9]*" <debug-dir>/maestro.log` or `grep 'Got device info' …/maestro.log` and compare with `adb -s $ANDROID_SERIAL shell wm size` (emulators 1080x2400 / 1344x2992, the Samsung phone 720x1600). Other tells: the failure screenshot under `--debug-output` (3-button nav bar, status-bar apps, clock in local time vs UTC on emulators, a different app version/data), `adb -s <serial> shell dumpsys window | grep mCurrentFocus` on each device during the run. A flow failing on an element that "must be there" often ran elsewhere. Direct `adb -s "$ANDROID_SERIAL" exec-out screencap -p` is guaranteed to be your device. If `launchApp` reports COMPLETED but the hierarchy shows the launcher, cross-check with `adb -s $S shell monkey -p com.powerliftingworkoutplanner -c android.intent.category.LAUNCHER 1` — if that foregrounds the app, the Maestro session is on another device or wedged.

### Transient device not connected while a sibling runs Maestro
**Symptom:** `Device <serial> was requested, but it is not connected` for ~2 min while `adb devices` lists it, starting when a sibling launches its own Maestro run, clearing when it ends.
**Rule:** if you already use your own proxy, treat it as transient and retry in the FOREGROUND (`for i in $(seq 1 6); do <run> && break; done`). If the listener on the address you use belongs to a sibling (it exposes THEIR serial), the error is permanent — find yours with `ss -tlnp | grep :5037` + `ADB_SERVER_SOCKET=tcp:127.0.0.<n>:5037 adb devices`. Never `adb kill-server`. (seen in GH-417, GH-428)

### Maestro driver fails to start or install
- Each worker needs its own driver port (`--driver-host-port $E2E_MAESTRO_DRIVER_PORT`); two sessions on one port fail with `TcpForwarder.waitFor` TimeoutException.
- `Maestro Android driver did not start up in time … dadb.open(tcp:<port>)` on a loaded emulator is usually just slow (~20–28 s): `export MAESTRO_DRIVER_STARTUP_TIMEOUT=120000` (or 300000) FIRST.
- A previous (killed or finished) Maestro JVM can still hold `--driver-host-port` → `TimeoutException at dadb.forwarding.TcpForwarder.waitFor` or a timeout in the first swipe. `ss -ltnp | grep :<port>` → `kill <pid>` (the port is per-worker, safe); `adb -s <serial> forward --remove-all`.
- Do NOT `am force-stop dev.mobile.maestro` between runs — let Maestro manage its driver (it made every assertion fail). Older advice to force-stop `dev.mobile.maestro.android` is superseded.
- `Install failed: cmd: Can't find service: package` or `Requested internal only, but not enough space` while `adb -s <you> install` works = the driver install went to another device → filter proxy. If it is YOUR device that is full, see [emulator storage](adb-and-emulators.md#install-failed-insufficient-storage-on-an-emulator).
- SELinux `somaxconn` denial in logcat for `dev.mobile.maestro` → `adb reboot` (see [recover a wedged emulator](adb-and-emulators.md#recover-a-wedged-emulator-with-adb-reboot)).
- Hung at "Waiting for flows to complete..." for > 3 min, or driver bound but no log output after an emulator crash: kill the Maestro PIDs, force-stop the app, capture evidence via adb and say so in `summary.md`.
- A non-default `--driver-host-port` worked on the real device; one emulator round only came up on the default 7001 — try both before blaming the device.
(seen in GH-63, GH-316, GH-326, GH-339, GH-367, GH-394, GH-396, GH-443, GH-458)

### gRPC DEADLINE EXCEEDED and connection closed
**Causes seen, in order of likelihood:**
1. A continuously updating screen never lets the hierarchy idle — any ticking timer (a STARTED training's header timer also ticks on the Training HOME card), live chart or playing video. A stale running training left by a previous worker breaks the first command after launch: `adb shell pm clear com.powerliftingworkoutplanner` before the import (only on test devices!).
2. `clearState: true` followed by CPU-heavy work (analysis after `pm clear`) — reserve clearState for cold-start import flows.
3. A filter proxy with a socket timeout (see proxy pitfalls in [adb filter proxy](adb-and-emulators.md#use-an-adb-filter-proxy-that-exposes-only-your-device)).
4. A degraded emulator (memory pressure) — reboot between long sessions.
**Workaround for live screens:** use Maestro for navigation only and drive the live screen with `adb shell input` + `adb exec-out screencap -p`. See also [gRPC on WSL](#last-resort-windows-maestro-via-cmd).

### takeScreenshot writes relative to the Maestro CWD
**Observation:** `takeScreenshot: <bare-name>` writes `<name>.png` into the CWD of the `maestro` process — loose PNGs in the worktree root are leftovers of runs started there (even other tickets' flows), not crash debris. With an overridden `HOME` the same happens.
**Rule:** `cd "<run_dir>/screenshots/flow"` before invoking the runner or maestro; keep screenshot names bare. Under Windows `maestro.bat` with a UNC CWD the write fails with "Zugriff verweigert" (see [cmd.exe fallback](#last-resort-windows-maestro-via-cmd)).

### Maestro screenshots are illustrative capture evidence with adb
**Observation:** Maestro's `takeScreenshot` lagged a whole interaction block behind on an emulator (assertions read `Set 9`, PNG showed `Set 8`), came out black in some WSL2 setups, and on the Samsung phone (DRM) too. `adb exec-out screencap -p` at the same moment was correct.
**Rule:** capture evidence with `adb -s "$ANDROID_SERIAL" exec-out screencap -p > raw.png` (resize for viewing, e.g. `ffmpeg -y -i raw.png -vf scale=800:-1 out.png`), READ each image back to confirm it shows the claimed state, and re-shoot after further interaction (`screencap` can also return a stale frame). Maestro flows remain required as regression specs. See [evidence rules](evidence-and-process.md#evidence-must-prove-the-claimed-state).

### Long Maestro runs and the 600 s tool cap
**Problem:** a foreground Bash call is killed at 600 s; backgrounding with a trailing `&` inside the Bash tool orphans the JVM; a `run_in_background` task can report "completed" while the job it launched is still alive.
**Fix:** `setsid nohup bash <script> > log 2>&1 < /dev/null & disown`, have the script write a done-marker/exit code, then wait in the SAME turn with a background-able poll (`until grep -q <marker> <log>; do sleep 20; done`) or repeated foreground polls (`perl -e 'select(undef,undef,undef,5)'` as sleep where plain `sleep` is blocked). Confirm liveness via `pgrep -af java | grep maestro` and the log's mtime, not via the task notification. For multi-flow sweeps write one JSONL result line per flow and skip already-recorded flows on resume. Same pattern for gradle (see [long builds](builds-and-deps.md#long-builds-inside-the-tool-timeout)). (seen in GH-63, GH-316, GH-428, QA-MAESTRO-001)

### Where Maestro failures are explained
- Console/stdout logs of a backgrounded run can be truncated — the full trace is `~/.maestro/tests/<timestamp>/maestro.log` (or under the `--debug-output` dir / `$E2E_MAESTRO_HOME`).
- A failing `assertTrue` only says `false is true`; `commands-*.json` in the same folder has `metadata.status == FAILED` with the exact condition, `defineVariablesCommand` entries show variable values.
- The failure screenshot `screenshot-❌-*.png` shows which screen — and which DEVICE — the flow was on.
- A flow failing on its FIRST assertion is often an app bootstrap crash (red box), not a flow bug: `uiautomator dump` + grep for the stack trace, or look at the failure screenshot.
- Read Maestro's assertion wording as the predicate, not the command (`Assertion is false: "Test" is visible` can come from an `assertVisible` after a too-short scroll).

### Run Maestro and uiautomator never at the same time
**Problem:** only one UiAutomation client can be registered per device. A `uiautomator dump` poll loop during a Maestro run crashes with `UiAutomationService … already registered!` and can leave the driver broken.
**Rule:** while a flow runs, poll with `adb exec-out screencap -p` or the flow's own log; dump only when no Maestro process is alive. (seen in GH-401)

### Classify sweep failures carefully
- A changed app PID after a flow is not a crash if the flow contains `launchApp`/`clearState` — reserve CRASH for `FATAL EXCEPTION|SIGSEGV|RedBox|JavascriptException|runtime not ready` in logcat; use PID change only for flows without `launchApp`.
- A suite flow that `runFlow`s `00_import_baseline.yaml` fails as a whole when the import fails — verify component flows standalone first.
- Before calling a failure a regression, run the same flow against unmodified master (several shared flows were broken on master).
(seen in QA-MAESTRO-001, GH-437)

### Last resort Windows Maestro via cmd
When the WSL Maestro path keeps failing with `DEADLINE_EXCEEDED`/`Command failed (tcp:PORT): closed` on consecutive sessions (port-forward over the gateway dropping), running the Windows binary natively uses the stable Windows-local adb: `cmd.exe /c "cd C:\Users\%USERNAME%\AppData\Local\Temp && C:\Users\...\maestro.bat --device <serial> --driver-host-port <port> test \\wsl.localhost\<distro>\...\flow.yaml"`. The `cd` to a writable Windows dir is required, otherwise `takeScreenshot` fails with "Zugriff verweigert" in the UNC/system CWD. It does NOT solve multi-device routing — use the filter proxy for that. (seen in GH-153)
