# Maestro E2E (WSL + Windows Emulator)

This E2E setup is intentionally under `__tests__`.

Environment split:
- Orchestration from WSL
- Emulator, `adb`, and `maestro` on Windows

Run commands:
- `npm run e2e:android:build`
- `npm run e2e:android:bootstrap`
- `npm run e2e:android`
- `npm run e2e:android:smoke`

Default fixture source:
- `__tests__/testdata/1772318214222.gains`

The fixture is pushed to emulator as:
- `/sdcard/Download/baseline.gains`
