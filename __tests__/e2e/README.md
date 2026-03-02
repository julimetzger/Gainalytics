# Maestro E2E (WSL + Windows Emulator)

This E2E setup is intentionally under `__tests__`.

Environment split:

- Orchestration from WSL
- Emulator, `adb`, and `maestro` on Windows

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
- `maestro --host 172.18.240.1 test flow.yaml`

Default fixture source:

- `__tests__/testdata/1772318214222.gains`

The fixture is pushed to emulator as:

- `/sdcard/Download/baseline.gains`

Notes:
- `run-maestro-from-wsl.sh` auto-detects the WSL host IP from `/etc/resolv.conf` when `E2E_MAESTRO_HOST` is not set.
- `run-maestro-from-wsl.sh` configures `adb reverse tcp:8081 tcp:8081` (or `E2E_METRO_PORT`) before running flows.
