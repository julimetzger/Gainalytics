# adb server, device routing & emulator health

The shared Windows adb server, WSL access to it, per-worker device isolation, installs, and recovering sick emulators.
Back to the [index](../agent-memory.md). Device serials named here are examples — always use your assigned `$ANDROID_SERIAL`.

### WSL talks to the shared Windows adb server
**Setup:** emulators and the USB phone hang off ONE adb server on Windows. WSL reaches it via the gateway: `ADB_SERVER_SOCKET=tcp:<gateway>:5037` (gateway = `awk '/^nameserver/{print $2; exit}' /etc/resolv.conf`, e.g. `172.18.240.1`) or `adb -H <gateway> -P 5037`. The server must be started with `-a` to be reachable from WSL.
**Rules:**
- NEVER `adb kill-server` from WSL — it kills the shared server for every worker (and `start-server` then fails "cannot start server on remote host").
- If WSL gets `Connection refused` but you suspect the server is fine, call Windows adb directly: `/mnt/c/Users/<user>/AppData/Local/Android/Sdk/platform-tools/adb.exe -s <serial> <cmd>` — no restart, no disruption of siblings.
- A WSL adb client v36 against a Windows server v34 can list nothing over `127.0.0.1:5037`; use the gateway or `adb.exe`.
- Don't casually probe `adb -H 127.0.0.1 …`: it auto-spawns an empty WSL-local server that blinds Maestro (see [stale local server](#a-stale-local-adb-server-on-127001-5037-hides-every-device)).
- If adb is unreachable in a pure-code round, don't burn the round on it: note the infra problem in `summary.md`.

### Restart a wedged or loopback-only Windows adb server
**Symptoms:** WSL `adb` hangs for minutes, then `Connection refused` at `<gateway>:5037`, while `netstat -ano` still shows adb LISTENING (often with 100+ ESTABLISHED never-serviced client sockets = full backlog). Or the server was auto-spawned by a Windows client and listens on `127.0.0.1:5037` only.
**Fix (one Bash call):** find the listener PID — `netstat.exe -ano | grep ':5037 ' | awk '$3 ~ /^0\.0\.0\.0:0$/ {print $5}'` (don't grep the localized state string ABHÖREN/LISTENING, the console encoding mangles it) — `taskkill.exe /F /PID <pid>`, then immediately
`cd <platform-tools> && (env -u ADB_SERVER_SOCKET -u ANDROID_SERIAL setsid nohup ./adb.exe -a -P 5037 nodaemon server > /tmp/adbserver.out 2>&1 < /dev/null & disown)`
and re-check that netstat shows `0.0.0.0:5037`. Windows clients respawn a loopback-only server within seconds, so kill and start together. `adb.exe -a start-server` was seen to drop `-a` (comes up as `fork-server` on 127.0.0.1) — prefer the `nodaemon` form under `setsid`; plain `nohup … &` dies with the tool call. `cannot bind to 0.0.0.0:5037` in the out file = a loopback-only server must be killed first. `taskkill /F /IM adb.exe` fails on protected children — target the listening PID.
**After a restart:** device topology changed — see [topology changes](#device-topology-changes-invalidate-your-routing). A restart also briefly disrupts sibling workers; it recurs under multi-worker load, so keep it scripted.
(seen in GH-323, GH-351, GH-391, GH-396, GH-439, GH-443)

### The adb server saturates batch taps into one adb shell
**Problem:** the Windows server saturates at ~150 connections; a script of many separate `adb shell input …` calls dies halfway, and a single command can hang 8–30 min.
**Fix:** one connection per step: `adb -s $S shell 'input tap 943 2175; sleep 6; input tap 270 1922; sleep 5; echo STEP_DONE'` (device-side `sleep`). Wrap adb in `timeout ${ADB_TIMEOUT:-25} adb …`, but give legitimately long calls (e.g. `perfetto`) their own limit. Don't kill Maestro JVMs mid-run — their connections linger. (seen in GH-391, PERF-003)

### Use an adb filter proxy that exposes only your device
**Why:** Maestro (2.0.9-ports, dadb) talks to an adb server and picks the FIRST device it lists — `--device` is not reliably honoured (see [Maestro drives the wrong device](maestro-running.md#maestro-drives-the-wrong-device-on-a-multi-device-adb-server)). It also hardcodes `127.0.0.1:5037` unless given `--host`, and ignores `ADB_SERVER_SOCKET`.
**How:** if the orchestrator prompt lists `adb_proxy_host`/`adb_proxy_port` (env `ORCHESTRATOR_ADB_PROXY_SOCKET`, `E2E_MAESTRO_HOST`), use them. Otherwise start your own: `python3 .codex-orchestrator/proxies/adb_filter_proxy.py --serial $ANDROID_SERIAL --listen 127.0.0.<n>:5037 --upstream <gateway>:5037` (copies also live in older run dirs) and pass `--host 127.0.0.<n> --adb-host 127.0.0.<n>` to `run-maestro-from-wsl.sh` (or `maestro --host 127.0.0.<n> --device $ANDROID_SERIAL …`). Verify first: `adb -H 127.0.0.<n> -P 5037 devices` must list your serial and nothing else.
**Multiple workers:** each worker needs its own loopback ADDRESS on port 5037 (Linux routes all of 127.0.0.0/8; Maestro honours `--host` but ignores `--port`). `ss -tlnp | grep :5037` lists every proxy; `ps -o cmd -p <pid>` shows its `--serial`. Never kill a sibling's proxy — they restart it anyway.
**Proxy implementation pitfalls (when writing/reusing one):** call `settimeout(None)` on both sockets after connect (a 10 s timeout tears down Maestro's idle driver forward → `DEADLINE_EXCEEDED`); for one-shot `host:devices`/`host:devices-l` close the connection after replying (looping makes `adb devices` hang), keep `host:track-devices*` open; swallow `host:kill`. Test with a real `adb -H … devices`, not a raw socket.
**Don't:** run a reverse keep-alive loop through the proxy (backlog 5) — see [adb reverse gets wiped](metro-and-bundling.md#adb-reverse-gets-wiped).
(seen in GH-63, GH-316, GH-367, GH-393, GH-394, GH-401, GH-428, GH-442, GH-450, GH-458)

### A stale local adb server on 127.0.0.1 5037 hides every device
**Symptom:** Maestro reports `Device <serial> was requested, but it is not connected` / `0 devices` while `adb -H <gateway> devices` lists it.
**Cause:** a deviceless WSL-local adb server (auto-spawned by Maestro or by a stray `adb -H 127.0.0.1` probe) squats `127.0.0.1:5037` and answers `host:devices` with OKAY + an empty list — it looks healthy.
**Fix:** `ss -tlnp | grep :5037` FIRST; `kill <pid>` the local listener (never `adb kill-server`), start your filter proxy there, verify with `adb -H 127.0.0.1 -P 5037 devices`. A health check must require your serial IN the response, not just OKAY. (seen in GH-63, GH-394)

### Device topology changes invalidate your routing
**Observation:** an adb-server restart re-authorised a phone that had been `unauthorized` all session; an emulator reboot put a foreign phone FIRST in the device list; a phone plugged in mid-session took over Maestro on an unchanged command line. Each time the next Maestro call ran on the wrong device — including destructive imports.
**Rule:** after any adb restart, reboot, or `adb devices` change, re-run `adb devices` and (re)start your filter proxy BEFORE the next Maestro call. Check every run's device afterwards (see [verify which device Maestro drove](maestro-running.md#verify-which-device-maestro-actually-drove)). (seen in GH-415, GH-444, GH-462)

### A physical device missing from adb devices
**Check Windows PnP before touching the shared server:** `powershell.exe -Command "Get-PnpDevice -PresentOnly -Class AndroidUsbDeviceClass"` — an error ("keine übereinstimmenden … gefunden") means the phone is physically unplugged. Without `-PresentOnly`, an unplugged phone still lists as Status `Unknown`. `Get-PnpDevice -PresentOnly | Where-Object { $_.InstanceId -like 'USB*' }` showing `Error … Unbekanntes USB-Gerät (Fehler beim Anfordern einer Gerätebeschreibung)` = dead USB link; needs a re-plug (WSL interop is not elevated). Check once at run start and report "please re-plug the phone" instead of blocking vaguely. (seen in GH-403, GH-405)

### Install failures and their real causes
- `INSTALL_PARSE_FAILED_NO_CERTIFICATES … SHA-256 digest … did not verify` for a large APK over the WSL→Windows path is stream corruption, not signing: `adb install -r --no-streaming <apk>`.
- `adb install` may default to an INCREMENTAL install that leaves a non-launchable stub ("Activity class … does not exist") — use `--no-incremental`.
- `INSTALL_FAILED_VERSION_DOWNGRADE` after rebasing onto a newer `origin/master`: `-r` still enforces monotonic versionCode; `adb uninstall` + install (re-import the fixture afterwards).
- Uncommitted `pm install-create` sessions reserve space (`dumpsys package installs`, `vmdl*.tmp` in /data/app): `pm install-abandon <id>`.
- Storage: see [insufficient storage](#install-failed-insufficient-storage-on-an-emulator).

### INSTALL FAILED INSUFFICIENT STORAGE on an emulator
**Context:** the emulators have a cramped ~5.8–6 GB `/data`; Android reserves `min(10 %, 500 MB)`, and a debug APK needs ~3× its size for staging + dexopt. Check `adb shell df /data` first.
**Do, in order:** `adb uninstall com.powerliftingworkoutplanner` (only if data may be lost — re-import afterwards); `pm uninstall com.google.android.youtube` (~400 MB; may be a no-op system app); shrink the APK to the device ABI (see [shrink the debug APK](builds-and-deps.md#shrink-the-debug-apk-to-the-device-abi)).
**Don't:** `pm clear com.google.android.gms`/`com.android.vending` (crashed System UI and rebooted the emulator; one round reported success clearing a long list of Google app caches — risky, last resort only); lower `sys_storage_threshold_*` (NPE in StorageManagerService → system_server crash-loop, `cmd: Can't find service: package`; recovered by `adb reboot`); `pm trim-caches` (killed system_server); `cmd package compile -a -f -m speed` (uses more disk).
**Maestro's driver APK** can fail to install with `Requested internal only, but not enough space` even when the app installs — on a multi-device host that usually means it targeted ANOTHER (full) device (see [Maestro driver failures](maestro-running.md#maestro-driver-fails-to-start-or-install)).
(seen in GH-326, GH-339, GH-361, GH-393, GH-396)

### Recover a wedged emulator with adb reboot
**Symptoms:** "System UI isn't responding" loops that come back without app interaction (Maestro's first assertion fails because `mCurrentFocus` is the ANR window); `Maestro Android driver did not start up in time` with logcat `avc: denied { read } for name="somaxconn" … app=dev.mobile.maestro`; boot logo for 30+ min with `/sdcard` unmounted; `pm list packages` timing out; lowmemorykiller at ~250 MB free; app launches taking minutes.
**Fix:** `adb -s $ANDROID_SERIAL reboot` — device-scoped, safe for siblings, ~45–90 s. Poll `adb -s $S shell getprop sys.boot_completed` or `adb -s $S shell ls /sdcard/` (`init.svc.bootanim` stays `running` on these AVDs). App data and imported fixtures survive. Afterwards re-add `adb reverse`, check device order (see [topology changes](#device-topology-changes-invalidate-your-routing)), and verify the store still has data. `adb root`/`setenforce 0` are refused on these images; `am force-stop com.android.systemui` does nothing. Single ANR dialogs: tap "Close app" (not "Wait") or `adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS`.
Reboot between long Maestro sessions on a degraded emulator. (seen in GH-391, GH-393, GH-401, GH-443, GH-458)

### Emulator stays offline or halted after a reboot
**Symptom:** after `adb reboot` the device is `offline` or vanished for 20+ min while `qemu-system-x86_64.exe` stays alive with zero CPU growth (`wmic process where "ProcessId=<pid>" get UserModeTime` twice).
**Fix:** restart the AVD from Windows: read the AVD name from the qemu command line (`wmic … get CommandLine` → `-avd Pixel_7_3`), `powershell.exe Stop-Process` on `emulator.exe` + `qemu-system-x86_64.exe` (or `taskkill /F /PID`), then `Start-Process emulator.exe -ArgumentList '-avd <name> -port <port> -no-snapshot-load -no-window -no-audio'` from a backgrounded Bash task (plain `nohup`/`cmd /c start` die with the interop parent). Back in ~2 min with data intact; redo `adb reverse` and Maestro forwards. (seen in GH-396, GH-458)

### A loaded emulator delivers taps late
**Observation:** with 3 emulators the guest load hits 20–40 (`artd`/`system_server` at 150–200 % sys CPU in `adb shell top`); taps are delivered tens of seconds late, so a screenshot right after a tap shows the PRE-tap state and the tap lands on whatever screen appears later — looks like random miscalibrated coordinates.
**Rule:** check `/proc/loadavg` ON THE GUEST (WSL's loadavg reads ~0). After a tap with no visible effect, wait 3–5 s (up to 30–45 s under heavy load) and re-screenshot before changing coordinates; avoid extra dumps/taps that add load; avoid repeated force-stop cycles (they add load). Many no-effect taps in a row → suspect a backlog; force-stop + relaunch to flush, or reboot. (seen in GH-323, GH-346, GH-401)

### Emulator limitations
- `adb shell date …` is refused on `ro.build.type=user` images (no root, `TIME_SET` broadcast doesn't work) — create "today" data in-app instead (see [stale fixture dates](state-and-data.md#the-baseline-fixture-is-months-old-recency-windows-are-empty)).
- With a hardware keyboard attached the IME shows as a small floating toolbar, not a QWERTY panel; use `dumpsys input_method | grep mInputShown` as the authoritative "keyboard shown" signal.
- `KeyboardType: 2` under `Device -1: Virtual` is normal on every device — not a hardware keyboard. Check with `dumpsys input | grep -B8 "KeyboardType: 2"`; only a non-virtual device id counts.
- Edge-to-edge is always on for API 35+, so inset bugs of Android ≤ 14 cannot reproduce on the emulators (see [edge-to-edge](react-native-ui.md#non-edge-to-edge-android-double-counts-the-status-bar-inset)).
