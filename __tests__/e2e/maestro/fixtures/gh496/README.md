# GH-496 Strong CSV fixtures

- `strong_sample_export.csv`: a real Strong 6.x export (`;`-separated, `Workout #`, `Weight (kg)`,
  `Rest Timer`/`Note`/`W` set orders), taken from the public test resource
  https://github.com/LordRaydenMK/Bybon/blob/main/app/src/test/resources/strong-backup-sample.csv
- `gh496_invalid.csv`: a valid first row and a broken date in line 3 — must be rejected as a whole.

Push both to `/sdcard/Download/` before running `gh496_strong_import_roundtrip.yaml` / `gh496_strong_real_file.yaml`.
- `gh496_new_record.csv`: one "Legs" session on 2026-10-05 with Squat 200 kg × 5 @ RPE 9 (1RM 240,
  above the baseline Squat record 225) and a failed 260 kg × 0 attempt. Imported on top of the
  baseline by `gh496_strong_new_record.yaml`: the failed attempt is skipped and the 240 kg record
  shows under Analyse → Records with +15 kg to the previous baseline record.
