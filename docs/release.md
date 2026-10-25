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

The old scripts still work and additionally commit the bumped `versionName` to `master`:

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
