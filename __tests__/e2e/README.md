# Maestro E2E (WSL + Windows Android Device)

This E2E setup is intentionally under `__tests__`.

Environment split:

- Orchestration from WSL
- Android device, `adb`, and `maestro` on Windows

## Windows

run to start adb server, which can be reached form wsl

```bash
adb -a -P 5037 nodaemon server
```

## WSL

add to .bashrc `export ADB_SERVER_SOCKET="tcp:$(ip route show | grep default | awk '{print $3}'):5037"` to tell adb to
connect to the windows adb server.
This seems not to work for gradle. Therefore, for gradle a proxy with port-forward for localhost is used with
`socat TCP-LISTEN:5037,fork TCP:172.18.240.1:5037`

Start metro server with (to bind windows -> wsl):
```
npm start -- --host 0.0.0.0 --port 8081
```

Run commands:

- `npm run e2e:android:build`
- `npm run e2e:android:bootstrap`
- `npm run e2e:android`
- `npm run e2e:android:smoke`
- `maestro --host 172.18.240.1 --device <serial> test __tests__/e2e/maestro/flows/<flow>.yaml`

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

Notes:
- `run-maestro-from-wsl.sh` auto-detects the WSL host IP from `/etc/resolv.conf` when `E2E_MAESTRO_HOST` is not set.
- `run-maestro-from-wsl.sh` configures `adb reverse tcp:8081 tcp:8081` (or `E2E_METRO_PORT`) before running flows.
