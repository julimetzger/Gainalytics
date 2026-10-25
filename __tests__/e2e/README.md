# Maestro E2E (WSL + Windows Android Device)

This E2E setup is intentionally under `__tests__`.

Environment split:

- Orchestration from WSL
- Android device, `adb`, and `maestro` on Windows

Nothing machine-specific (home directories, device serials, host IPs) is committed. Device,
hosts and paths come from the environment variables below or from paths relative to the repo.

## Windows

run to start adb server, which can be reached form wsl

```bash
adb -a -P 5037 nodaemon server
```

## WSL

The Windows host is reachable from WSL via the default gateway, which is also the
`nameserver` in `/etc/resolv.conf`:

```bash
export WSL_GATEWAY="$(awk '/^nameserver / { print $2; exit }' /etc/resolv.conf)"
```

add to .bashrc `export ADB_SERVER_SOCKET="tcp:$(ip route show | grep default | awk '{print $3}'):5037"` to tell adb to
connect to the windows adb server.
This seems not to work for gradle. Therefore, for gradle a proxy with port-forward for localhost is used with
`socat TCP-LISTEN:5037,fork TCP:${WSL_GATEWAY}:5037`

Start metro server with (to bind windows -> wsl):
```
npm start -- --host 0.0.0.0 --port 8081
```

Run commands:

- `npm run e2e:android:build`
- `npm run e2e:android:bootstrap`
- `ANDROID_SERIAL=<serial> npm run e2e:android`
- `ANDROID_SERIAL=<serial> npm run e2e:android:smoke`
- `maestro --host "${WSL_GATEWAY}" --device <serial> test __tests__/e2e/maestro/flows/<flow>.yaml`

Flows live in `__tests__/e2e/maestro/flows/`: 2–3 target flows per feature, 10 shared helpers and
the entry points `smoke.yaml` / `suite.yaml`. See `maestro/FLOW_AUDIT.md` for the overview and the
rules for new flows; `maestro/flows/manual/` holds flows that need a real key/account/device.

Default fixture source (`--fixture` overrides it):

- `__tests__/e2e/maestro/fixtures/baseline.gains`

The bootstrap of `run-maestro-from-wsl.sh` (modes `bootstrap`, `smoke`, `full`) pushes to
`/sdcard/Download/`:

- `baseline.gains` (the fixture above), `squat-3reps.mp4`, `squat-1rep.mp4`
- `maestro/fixtures/gh496/*.csv`, `maestro/fixtures/gh393-compare-labels.gains`,
  `maestro/fixtures/gh415-workout-linked-analysis.gains`
- `__tests__/testdata/gh391_planned_fixture.gains`, `gh391_newplan_fixture.gains`,
  `gh508_chat_fixture.gains` (AI chat flows)

It never imports — the flows import with `00_import_baseline.yaml` / `import_fixture.yaml`.

## Smoke flow and the PR check

`smoke.yaml` imports `baseline.gains` itself (`00_import_baseline.yaml`), then runs
`home_dashboard.yaml`, `analyse_dashboard_drilldown.yaml` and `train_start_log_finish.yaml`
(last, it changes data). It only needs the file in `/sdcard/Download` — do not import before it.
It **replaces the app data on the device**. Takes ~6–8 min on the CI emulator.

The same flow runs as the required PR check **`Maestro smoke`**
(`.github/workflows/maestro-smoke.yml`, see `docs/release.md` › Continuous integration) and in
the agent workflow's `smoke_only` mode; both use `.github/agent-emulator/smoke.sh`
(`tool.sh push-baseline`, then `tool.sh flow smoke.yaml`).

Notes:
- `run-maestro-from-wsl.sh` auto-detects the WSL host IP from `/etc/resolv.conf` when `E2E_MAESTRO_HOST` is not set.
- `run-maestro-from-wsl.sh` configures `adb reverse tcp:8081 tcp:8081` (or `E2E_METRO_PORT`) before running flows.

## Environment variables

This is the single reference for the variables used by the E2E scripts in
`__tests__/e2e/scripts/`, the CI emulator agent in `.github/agent-emulator/`, the
orchestrator in `orchestrator/codex-skills/orchestrator/scripts/` and the PERF-003 tools in
`docs/perf/perf003/tools/`. All are optional unless marked required.

### Device and hosts

| Variable | Used by | Default / meaning |
|---|---|---|
| `ANDROID_SERIAL` | `run-maestro-from-wsl.sh`, `run-gh341-records-flow.sh` (required), `gh*-verify-on-device.sh`, `gh204-r2-evidence.sh`, `.github/agent-emulator/tool.sh`, `docs/perf/perf003/tools/adb-wrapper.sh` (required) | Serial of the target device (`adb devices`). Maestro runs refuse to start without it, so they never hit "the first device". The Python helpers take the same value as `--serial`. |
| `E2E_MAESTRO_HOST` | `run-maestro-from-wsl.sh`, `run-gh341-records-flow.sh` | Host that runs the adb server Maestro talks to. Default: the `nameserver` from `/etc/resolv.conf` (WSL gateway), empty if that file is missing (local adb). |
| `E2E_ADB_HOST` / `E2E_ADB_PORT` | `run-maestro-from-wsl.sh` | adb server for the script's own `adb` calls. Default: `E2E_MAESTRO_HOST` / `5037`. |
| `ADB_SERVER_SOCKET` | adb itself, set by `run-maestro-from-wsl.sh` and the orchestrator | `tcp:<host>:<port>` of the adb server. |
| `ADB_HOST` / `ADB_PORT` | `orchestrator/.../reserve_emulators.py` | adb server used to list emulators (`--adb-host` / `--adb-port`). |
| `ORCHESTRATOR_ADB_PROXY_SOCKET` | `orchestrator/.../launch_feature_job.py` | `tcp:<host>:<port>` of a per-worker adb filter proxy. When set, the worker gets `ADB_SERVER_SOCKET`, `E2E_ADB_HOST`, `E2E_ADB_PORT` and `E2E_MAESTRO_HOST` derived from it. |
| `PERF_ADB_HOST` / `PERF_ADB_PORT` | `docs/perf/perf003/tools/adb-wrapper.sh` | adb server for the PERF-003 measurements. Default `127.0.0.1` / `5037`. |

### Ports

| Variable | Used by | Default |
|---|---|---|
| `E2E_METRO_PORT` | `run-maestro-from-wsl.sh`, `gh204-r2-evidence.sh` | `8081` (host Metro port) |
| `E2E_DEVICE_METRO_PORT` | `run-maestro-from-wsl.sh`, `gh204-r2-evidence.sh` | `8081` (device side of `adb reverse`) |
| `E2E_MAESTRO_DRIVER_PORT` | `run-maestro-from-wsl.sh`, `run-gh341-records-flow.sh`, `check-gh418-focused-field-above-keyboard.sh` | Maestro `--driver-host-port`; unset = Maestro default (script-specific defaults where noted in the script) |

### Paths

All default paths are relative to the repository checkout (`REPO_ROOT` is derived from the
script location), so nothing depends on a particular home directory.

| Variable | Used by | Default |
|---|---|---|
| `E2E_MAESTRO_HOME` | `run-maestro-from-wsl.sh`, `run-gh341-records-flow.sh`, `check-gh418-…sh` | `<repo>/__tests__/reports/.maestro-home` (Maestro's `HOME`/cache, isolated per run) |
| `AGENT_RUN_DIR` | `.github/agent-emulator/*.sh` | `<repo>/.agent-run` |
| `PERF003_WORKTREE` | `docs/perf/perf003/tools/*.sh` | The git checkout that contains the script, else `$PWD` |
| `PERF003_RUN_DIR` | `docs/perf/perf003/tools/*.sh` | `<main repo>/.codex-orchestrator/runs/PERF-003` |

The orchestrator itself takes no path variables: it locates the repo with
`git rev-parse --show-toplevel`, keeps its state in `<repo>/.codex-orchestrator/` and its
worktrees in `<repo>/.worktrees/` (or `--worktrees-root`), and generates each worker's Metro
config (`metro.worktree.config.cjs`) inside the run directory.

### Screenshots in Maestro flows

Flows must not use absolute `takeScreenshot` paths. Use a path relative to Maestro's working
directory or a flow parameter, e.g. `takeScreenshot: ${E2E_SCREENSHOT_DIR}/maestro-01-...`,
and pass it with `maestro test -e E2E_SCREENSHOT_DIR=<run_dir>/screenshots flow.yaml`.
