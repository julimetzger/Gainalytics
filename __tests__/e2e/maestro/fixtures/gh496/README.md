# GH-496 Strong CSV fixtures

- `strong_sample_export.csv`: a real Strong 6.x export (`;`-separated, `Workout #`, `Weight (kg)`,
  `Rest Timer`/`Note`/`W` set orders), taken from the public test resource
  https://github.com/LordRaydenMK/Bybon/blob/main/app/src/test/resources/strong-backup-sample.csv
- `gh496_invalid.csv`: a valid first row and a broken date in line 3 — must be rejected as a whole.

Push both to `/sdcard/Download/` before running `gh496_strong_import_roundtrip.yaml` / `gh496_strong_real_file.yaml`.
