# Releasing Gainalytics (Android)

Releases are built and signed by GitHub Actions (`.github/workflows/release.yml`) and published
as a GitHub Release with `app-release.apk`, `app-release.aab` and `SHA256SUMS`. Zapstore (#521)
picks the APK up from there.

## Cutting a release

The tag is the version. No version commit or PR is needed; CI builds with
`versionName` = tag name (`versionCode` stays as in `android/app/build.gradle`). Either

- **Run workflow:** Actions → Release → *Run workflow* on `master`, enter `version` (e.g. `0.183`).
  The `tag` job creates the tag on the current `master` commit and starts the release run on it, or
- **push a tag:** `git tag 0.183 && git push origin 0.183`.

The release run on the tag

1. sets `versionName` to the tag name for this build,
2. runs `npm ci`, decodes the keystore from the secrets and runs
   `./gradlew assembleRelease bundleRelease`,
3. verifies the APK/AAB signature (and, if configured, the certificate fingerprint),
4. creates the GitHub Release with the three files attached.

To rebuild an existing tag (e.g. after a failed run), start *Run workflow* with
*Use workflow from* → **Tags** → the version; leave `version` empty.

The old scripts still work: they continue from the higher of `versionName` and the latest version tag
and additionally commit the bumped `versionName` to `master`:

```bash
./releaseNewAndroidVersion.sh          # Linux/macOS/WSL
.\releaseNewAndroidVersion.ps1         # Windows PowerShell
```

`--local-build` (`-LocalBuild` in PowerShell) keeps the old behavior of also building and signing
locally before tagging. It needs the local keystore at `android/app/<store file>` and
`ANDROID_RELEASE_PASSWORD` (prompted for, never passed as an argument).

## Signing key

The release key **must never change**: Android refuses updates signed with a different key, and
Zapstore pins the signing certificate. CI uses the *same* keystore as local builds, supplied via
secrets. `android/app/build.gradle` reads:

| Environment variable | Default (local builds) | Set by CI from |
|---|---|---|
| `ANDROID_RELEASE_STORE_FILE` | `your_key_name.keystore` (relative to `android/app/`) | decoded `ANDROID_RELEASE_KEYSTORE_BASE64` |
| `ANDROID_RELEASE_PASSWORD` | – (required) | secret `ANDROID_RELEASE_PASSWORD` |
| `ANDROID_RELEASE_KEY_ALIAS` | `your_key_alias` | secret `ANDROID_RELEASE_KEY_ALIAS` (optional) |
| `ANDROID_RELEASE_KEY_PASSWORD` | `ANDROID_RELEASE_PASSWORD` | secret `ANDROID_RELEASE_KEY_PASSWORD` (optional) |

Keystores (`*.keystore`, except `debug.keystore`) are git-ignored. Never commit one.

### GitHub configuration (one-time, by the repo owner)

Settings → Secrets and variables → Actions:

| Kind | Name | Value |
|---|---|---|
| Secret | `ANDROID_RELEASE_KEYSTORE_BASE64` | `base64 -w0 android/app/your_key_name.keystore` (PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("android\app\your_key_name.keystore"))`) |
| Secret | `ANDROID_RELEASE_PASSWORD` | keystore password |
| Secret (optional) | `ANDROID_RELEASE_KEY_ALIAS` | only if the alias differs from the default |
| Secret (optional) | `ANDROID_RELEASE_KEY_PASSWORD` | only if the key password differs from the store password |
| Variable (recommended) | `ANDROID_RELEASE_CERT_SHA256` | SHA-256 of the signing certificate, e.g. from `keytool -list -v -keystore <file>` or `apksigner verify --print-certs app-release.apk`; the workflow fails if a build is signed with any other certificate |

Put the secrets (and the variable) into the GitHub **environment `release`**
(Settings → Environments → release) and restrict it under *Deployment branches and tags* to
**selected tags** with the rule `[0-9]*` (the version tags look like `0.183`, not `v…`). The release
job only enters this environment for runs on a tag ref, so no branch run, PR, other workflow or agent
can read the signing key. Do not keep a second copy as repository secret.

## Dry run (test keystore)

Actions → Release → *Run workflow* on a branch with an **empty** `version` builds and signs with a
throw-away keystore generated inside the job, verifies the signature and uploads the files as a
workflow artifact (3 days). No tag or release is created and no secret is used.

## Continuous integration

`.github/workflows/ci.yml` runs on pull requests and pushes to `master`: ESLint, `tsc`, Jest and
`./gradlew assembleDebug` (x86_64 only). ESLint and `tsc` still report errors in existing code;
CI compares them per file and rule with `scripts/ci/eslint-baseline.json` /
`scripts/ci/tsc-baseline.json` and fails on any increase. When you fix errors, shrink the baseline:

```bash
npx eslint . -f json -o /tmp/eslint.json; node scripts/ci/check-baseline.js eslint /tmp/eslint.json --update
npx tsc -p tsconfig.json --noEmit --pretty false > /tmp/tsc.txt; node scripts/ci/check-baseline.js tsc /tmp/tsc.txt --update
```

Node version for CI and local work: `.nvmrc`. JDK 17.

### Maestro smoke on an emulator

`.github/workflows/maestro-smoke.yml` (check name **`Maestro smoke`**, the one to add as required
status check in the `master` ruleset) runs on pull requests and pushes to `master`, except for
changes that only touch `**/*.md`, `docs/**`, `screenshots/**` or `tickets/**`. It builds the debug
APK (x86_64, embedded JS bundle), boots an API 34 emulator, pushes `baseline.gains` and runs
`__tests__/e2e/maestro/flows/smoke.yaml`: baseline import, Training home values
(`home_dashboard.yaml`), Analyse drill-down (`analyse_dashboard_drilldown.yaml`) and start / log /
finish a training (`train_start_log_finish.yaml`, last because it changes data).

- Safe for fork PRs: `permissions: contents: read`, no secrets, no environment.
- Shares the Gradle and AVD caches with `agent-emulator.yml` (same keys). A failed emulator
  *boot* is retried once with a cold boot; a failing flow is not retried.
- On failure the **Smoke result** step fails with an annotation naming the failing flow and step;
  the job summary shows the same plus the Maestro console tail and timings. Artifact
  `maestro-smoke-evidence` (14 days): JUnit `maestro/smoke/report.xml`, Maestro debug output
  (failure screenshot, commands JSON), screenshots, logcat, `timings.txt`.
- Runtime (public 4-vCPU runner): goal < 30 min with warm caches; the Gradle build dominates.
  The flows took 17 min in the first PR run; after the GH-588 speed-up they take 5.5–6 min on the
  agent emulator (was 10 min there), so expect well under 17 min on the PR runner too
  (`timings.txt` / job summary list each phase).
- Keep the smoke fast: on a running training the rest-timer ring animates nonstop and every Maestro
  tap/erase/input then waits 11–23 s for the screen to settle — `train_start_log_finish.yaml` skips
  the rest right after logging the set. `smoke.yaml` passes `BASELINE_IMPORTED: 'true'` so that flow
  skips its own import.
- Docs-only changes skip the workflow (`paths-ignore`). A required check whose workflow is skipped
  by a path filter stays *pending*, so docs-only PRs then need an admin bypass of the ruleset (or
  drop the `paths-ignore` before making the check required).

Locally: `ANDROID_SERIAL=<serial> npm run e2e:android:smoke` (see `__tests__/e2e/README.md`).
