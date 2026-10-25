# Releasing Gainalytics (Android)

Releases are built and signed by GitHub Actions (`.github/workflows/release.yml`) and published
as a GitHub Release with `app-release.apk`, `app-release.aab` and `SHA256SUMS`. Zapstore (#521)
picks the APK up from there.

## Cutting a release

```bash
./releaseNewAndroidVersion.sh          # Linux/macOS/WSL
.\releaseNewAndroidVersion.ps1         # Windows PowerShell
```

The script bumps `versionName` in `android/app/build.gradle`, commits
`release android version <x.y>`, tags `<x.y>` and pushes `master` plus the tag. The tag push
starts `release.yml`, which

1. checks that the tag equals `versionName`,
2. runs `npm ci`, decodes the keystore from the secrets and runs
   `./gradlew assembleRelease bundleRelease`,
3. verifies the APK/AAB signature (and, if configured, the certificate fingerprint),
4. creates the GitHub Release with the three files attached.

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

Recommended: put the secrets into a `release` environment restricted to tags, so pull-request
workflows can never read them.

## Dry run (test keystore)

Actions → Release → *Run workflow* with **test_keystore** checked (default) builds and signs with a
throw-away keystore generated inside the job, verifies the signature and uploads the files as a
workflow artifact (3 days). No release is created and no secret is used. Unchecking
**test_keystore** builds with the real key but still does not publish (only tag pushes publish).

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
