# Releasing Gainalytics (Android)

Releases are built and signed by GitHub Actions (`.github/workflows/release.yml`) and published
as a GitHub Release with `app-release.apk`, `app-release.aab` and `SHA256SUMS`. The job `zapstore`
then publishes the APK of that release to [Zapstore](https://zapstore.dev) (see [Zapstore](#zapstore)).

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
4. creates the GitHub Release with the three files attached,
5. publishes that release to Zapstore (skipped with a notice until the Zapstore secret is set).

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

## Zapstore

[Zapstore](https://zapstore.dev) is an app store built on Nostr. Apps are published with
[`zsp`](https://github.com/zapstore/zsp), the official CLI: it takes the APK from the GitHub Release,
signs Nostr events (app metadata, release, asset) with the publisher's Nostr key, uploads the APK
and icon to Zapstore's Blossom CDN and publishes the events to `wss://relay.zapstore.dev`.

- **Config:** [`zapstore.yaml`](../zapstore.yaml) in the repository root (name, summary,
  description, tags, license, icon = Android launcher icon, `match: '^app-release\.apk$'`). Keep it
  there under this name: the relay reads it from the default branch to whitelist the publisher.
- **CI:** job `zapstore` in `release.yml`, after `publish`, in the environment `release`. It
  installs a pinned `zsp` (SHA-256 checked), pins the release to the tag with a per-run
  `release_filter`, runs `zsp publish --check` (read-only) and then
  `zsp publish --quiet --skip-metadata`. Metadata, icon and description come from `zapstore.yaml` on
  the default branch, release notes from the GitHub Release.
- **No secret, no publish:** without `ZAPSTORE_SIGN_WITH` the job ends with a notice and the release
  is unaffected.
- **Idempotent:** if this version is already on the relay for the signing key, `zsp` exits 0
  without publishing. Re-running the job is safe.

### Signing: NIP-46 bunker (recommended) or nsec

`zsp` signs with whatever `SIGN_WITH` holds. Zapstore recommends a **NIP-46 bunker URL** for CI: the
private key (nsec) stays in a remote signer (e.g. [nsec.app](https://nsec.app), Amber on Android,
nsecBunker) and GitHub only stores a connection URL that the signer can revoke at any time. The
signer must be online and auto-approve the event kinds `zsp` signs during a release, otherwise the run
fails (each upload authorization expires after 30 seconds).

A NIP-46 connection is bound to the *client key* of the app that connects. `zsp` creates that key on
first use and keeps it in `~/.config/zsp/bunker-keys/<bunker pubkey>.key`; a fresh CI runner would
create a new one every time. That is why CI gets a fixed client key (`ZAPSTORE_BUNKER_CLIENT_KEY`)
which you pair once from your own machine.

Simpler alternative: the **nsec of a dedicated publisher key** (not your personal Nostr key) as
`ZAPSTORE_SIGN_WITH`. It is protected like the APK signing key (environment `release`, tags only),
but GitHub then holds the raw key.

### One-time setup (repo owner)

You need `zsp` locally (Linux/macOS binary from the
[zsp releases](https://github.com/zapstore/zsp/releases), or `go install github.com/zapstore/zsp@v0.4.17`;
on Windows use WSL) and the release keystore.

1. **Nostr identity.** Choose the key that publishes Gainalytics (whoever publishes a package first
   owns the listing). Put it into a NIP-46 signer and create a bunker connection for "zsp CI"
   (`bunker://<signer pubkey>?relay=wss://...&secret=...`). Allow, without prompting, the kinds
   `32267` (app), `30063` (release), `3063` (asset), `24242` (Blossom upload) and, for step 3,
   `30509` (certificate link).
2. **Publisher pubkey in `zapstore.yaml`.** Replace the `# pubkey: npub1...` comment at the end of
   `zapstore.yaml` with `pubkey: npub1...` (your **public** key) and merge it to `master`. The relay
   whitelists the key when it finds it there on the first publish.
3. **CI client key, pairing and certificate link** (Linux/WSL shell, from the repository root):

   ```bash
   export XDG_CONFIG_HOME="$(mktemp -d)"          # macOS: zsp uses ~/Library/Application Support instead
   read -rs -p 'Bunker URL: ' SIGN_WITH; echo; export SIGN_WITH
   bunker_pubkey="${SIGN_WITH#bunker://}"; bunker_pubkey="${bunker_pubkey%%\?*}"
   mkdir -p "$XDG_CONFIG_HOME/zsp/bunker-keys"
   openssl rand -hex 32 > "$XDG_CONFIG_HOME/zsp/bunker-keys/$bunker_pubkey.key"
   read -rs -p 'Keystore password: ' KEYSTORE_PASSWORD; echo; export KEYSTORE_PASSWORD
   zsp identity --link-key android/app/your_key_name.keystore --key-alias your_key_alias --link-key-expiry 5y
   cat "$XDG_CONFIG_HOME/zsp/bunker-keys/$bunker_pubkey.key"   # value for ZAPSTORE_BUNKER_CLIENT_KEY
   ```

   This pairs the CI client key with the bunker (approve the connection in the signer) and
   publishes a NIP-C1 proof that links the APK signing certificate to your Nostr identity, so
   Zapstore shows the app as verified. Without `--link-key-expiry` the link expires after one year;
   the job warns when it is missing or expired. With an nsec instead of a bunker, skip the client key
   lines and use `SIGN_WITH=nsec1...`. `zsp` reads `.keystore` files as JKS; if yours is PKCS12
   (`keytool -list -keystore <file>` shows the type), pass a copy named `*.p12` instead.
4. **Secrets** in the environment `release` (Settings → Environments → release):

   | Kind | Name | Value |
   |---|---|---|
   | Secret | `ZAPSTORE_SIGN_WITH` | the bunker URL **without** the `&secret=...` parameter (the secret is single-use and was consumed in step 3), or the publisher nsec |
   | Secret (bunker only) | `ZAPSTORE_BUNKER_CLIENT_KEY` | the 64-hex client key printed in step 3 |

   Then delete the temporary `$XDG_CONFIG_HOME` directory. Never commit or echo either value.
5. **First publish / test:** cut the next release as usual; its run ends with *Publish to Zapstore*.
   The app then appears at `https://zapstore.dev/apps/com.powerliftingworkoutplanner`.
   `zapstore_only` (below) does not work for tags created before the Zapstore job existed: a
   dispatch runs the workflow file *of the selected tag*, and the `release` environment only admits
   tag runs, so there is no CI path for them. To publish such an older release, run `zsp` locally
   (same shell as step 3, approve in the signer; replace `0\.186` with the version):

   ```bash
   cp zapstore.yaml .zapstore-release.yaml
   printf "\nrelease_filter: '^0\\.186$'\n" >> .zapstore-release.yaml
   zsp publish .zapstore-release.yaml   # shows a preview and asks before publishing
   rm .zapstore-release.yaml
   ```

### On each release

After the GitHub Release is created, `zapstore` publishes it: `zsp` fetches `app-release.apk` from
the release of this tag, checks that it supports arm64-v8a, reads package name, version and signing
certificate, uploads APK and icon, and publishes the app, release and asset events. The Zapstore app
verifies on install that the APK's certificate matches the published one; that is another reason the
release key must never change.

To publish a release later (for example after the secret was added, or when the job failed): re-run
the failed `Publish to Zapstore` job, or start *Run workflow* with *Use workflow from* → **Tags** →
the version and check **`zapstore_only`** (no build; only for tags that contain the Zapstore job,
older ones see step 5 above). `zsp` only looks at the 10 newest GitHub Releases. The job always uses
`zapstore.yaml` from `master`.

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
  skips its own import, and `ANALYSE_RESUME: 'true'` so the analyse flow resumes the app instead of
  cold-starting it (standalone it cold-starts: a resumed Dashboard keeps its scroll and radar selection).
- A smoke failure inside a flow is usually a real app bug: check the failure screenshot first. The
  first GH-588 "flake" (`"1 selected" is visible`) was the Analyse error boundary — a master
  dependency bump (react-native-gesture-handler 3) had removed the `Swipeable` that `DateRangePicker`
  imported, and `npm run typecheck` reported it (`has no exported member 'Swipeable'`).
- Docs-only changes skip the workflow (`paths-ignore`). A required check whose workflow is skipped
  by a path filter stays *pending*, so docs-only PRs then need an admin bypass of the ruleset (or
  drop the `paths-ignore` before making the check required).

Locally: `ANDROID_SERIAL=<serial> npm run e2e:android:smoke` (see `__tests__/e2e/README.md`).
