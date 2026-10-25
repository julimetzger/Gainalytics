# GH-496 Strong CSV fixtures

- `strong_sample_export.csv`: a real Strong 6.x export (`;`-separated, `Workout #`, `Weight (kg)`,
  `Rest Timer`/`Note`/`W` set orders), taken from the public test resource
  https://github.com/LordRaydenMK/Bybon/blob/main/app/src/test/resources/strong-backup-sample.csv
- `gh496_invalid.csv`: a valid first row and a broken date in line 3 — must be rejected as a whole.

- `gh496_new_record.csv`: one "Legs" session on 2026-10-05 with Squat 200 kg × 5 @ RPE 9 (1RM 240,
  above the baseline Squat record 225) and a failed 260 kg × 0 attempt. Imported on top of the
  baseline by `data_strong_import_records.yaml`: the failed attempt is skipped and the 240 kg record
  shows under Analyse → Records with +15 kg to the previous baseline record.
- `gh496_invalid_weight.csv`: a Bench Press row with reps but a broken weight (`1OO.0`) in line 3 —
  must be rejected as a whole with the line number, not imported as 0 kg. The empty weight of the
  reps-only Pull Up (as Strong writes it) is fine on its own.

Used by `data_strong_export_roundtrip.yaml` (`gh496_invalid*.csv`) and
`data_strong_import_records.yaml` (`gh496_new_record.csv`, `strong_sample_export.csv`). All four
files must be in `/sdcard/Download/`; `run-maestro-from-wsl.sh` pushes them during bootstrap.
