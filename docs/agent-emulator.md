# Emulator agent in GitHub Actions (GH-545)

Workflow: `.github/workflows/agent-emulator.yml`, helper scripts in `.github/agent-emulator/`.
A GitHub-hosted `ubuntu-latest` runner builds the debug APK, boots an Android emulator (KVM),
runs a Maestro smoke flow and then lets Claude Code work on a ticket inside that emulator.

## Triggering

Only users with write access (owner/collaborators) can start it; forks never run it.

- **Label:** add the label `agent:emulator` to an issue. The issue author must be owner/member/collaborator.
- **Manually:** Actions → *Agent emulator* → *Run workflow* (only works once the workflow is on `master`), or via REST:

  ```bash
  gh api -X POST repos/julimetzger/gainalytics/actions/workflows/agent-emulator.yml/dispatches \
    -f ref=master -f 'inputs[issue_number]=123' -f 'inputs[task]=optional extra instructions' \
    -f 'inputs[smoke_only]=false'
  ```

  Inputs: `issue_number` (optional), `task` (free text, optional — one of the two is required),
  `smoke_only` (emulator + app + Maestro flow, no agent, no secret needed).
- **Pipeline test:** dispatch with `task=dummy` runs a harmless built-in task
  (`.github/agent-emulator/test-task.md`: add one empty-state Maestro flow + screenshot, no app code).
  The resulting draft PR must not be merged.

During development of GH-545 a temporary `push` trigger on `feature/GH-545` was used (dispatch only works
from the default branch); it has been removed.

## Secret and environment

- The job runs in the GitHub environment **`gainalytics`** and reads the secret
  **`CLAUDE_CODE_OAUTH_TOKEN`** (OAuth token of the Claude subscription).
- Create the token locally with `claude setup-token`, then Settings → Environments → `gainalytics` →
  *Add environment secret* → name `CLAUDE_CODE_OAUTH_TOKEN`. An API key would work too
  (`anthropic_api_key` input of the action, secret `ANTHROPIC_API_KEY`), but is billed per token.
- Do not add *Required reviewers* to the environment, otherwise every run waits for approval.
- **Required repo setting for the draft PR:** Settings → Actions → General → Workflow permissions →
  enable *Allow GitHub Actions to create and approve pull requests*. Without it the publish job still pushes
  the `agent/emulator-*` branch but fails with `GitHub Actions is not permitted to create or approve pull
  requests (HTTP 403)`; the error annotation contains a compare link to open the PR by hand.
- The workflow only logs whether the secret is non-empty, never its value.

## What happens in a run

1. `emulator` job (read-only token, `timeout-minutes: 110`):
   checkout → KVM → JDK 17 / Node 22 → `npm ci` → `assembleDebug -PreactNativeArchitectures=x86_64`
   (the debug APK embeds the JS bundle because `debuggableVariants = []`, so no Metro is needed) →
   Maestro CLI (pinned version + SHA-256) → AVD (API 34, google_apis, x86_64, cached snapshot) →
   smoke phase (`smoke.sh`: install, cold start, `__tests__/e2e/maestro/flows/smoke.yaml`, screenshots, logcat).
2. Agent phase (not in smoke mode): the task (issue text + optional text, or the dummy task) is written to
   `.agent-run/task.md`; the emulator is booted again and the APK installed; Claude Code
   (`anthropics/claude-code-action/base-action`) runs with the prompt `.github/agent-emulator/agent-prompt.md`,
   which makes the agent follow the local feature-worker skill `orchestrator/codex-skills/feature/SKILL.md`
   and lists only the CI-specific overrides (no run dir/status.json, no push/gh, `tool.sh` instead of WSL scripts).
   Allowed tools: file read/edit, web search and page fetch (`WebSearch`/`WebFetch`, e.g. for library docs),
   `npm install`/`npm ci`/`npm uninstall` (adding or removing dependencies), `adb`, `maestro`, `tool.sh`,
   jest/tsc/lint, local git (status/diff/log/add/commit). Note: `npm install` runs package install scripts,
   which execute with the agent's environment — review any new dependency in the resulting PR.
   Denied: `git push`, `gh`, `curl`/`wget`, `env`/`printenv` — raw shell network access and reading the
   environment stay blocked so the OAuth token cannot be exfiltrated via a prompt-injected task.
   For JS changes the agent starts Metro (`tool.sh metro-start`, reached by the emulator via `10.0.2.2:8081`)
   or rebuilds (`tool.sh rebuild`).
3. `publish` job (only if the agent committed): receives the commits as a git bundle, rejects changes to
   `.github/`, `.gains`, keystores or `.env`, pushes them to a new branch `agent/emulator-<ticket>-<run id>-<attempt>`
   and opens a **draft** PR against the branch the workflow ran on. It never pushes to `master`, never merges,
   never releases. For issue runs it comments the PR link on the issue.

The agent therefore never holds a token with write access; only the small publish job does.

## Data

The emulator starts with an empty store; the smoke phase runs against that empty store. The agent follows
the feature skill (`orchestrator/codex-skills/feature/SKILL.md`) and imports the baseline fixture with
`tool.sh import-baseline` before any evidence screenshot. The current fixtures contain real training data
(owner-approved while the repo is private), so evidence screenshots in agent PRs and run artifacts show
those values. Replace them with synthetic data (#535) before the repo goes public.

## Where results land

- Run summary: timings and the agent's final message.
- Artifact `agent-emulator-evidence` (14 days): `screenshots/` (full size + `small/`), `maestro/<flow>/report.xml`
  and debug output, `logcat/`, `timings.txt`, `task.md`, PR text written by the agent.
- Artifact `agent-result` (7 days): git bundle with the agent's commits.
- Draft PR on `agent/emulator-*` with the evidence screenshots committed under `screenshots/<ticket>/`.

## Runtime and minutes

Measured on the standard private runner (`ubuntu-latest`, 2 vCPU / 7 GB, Linux minute multiplier 1×):

| Phase | Run 1 (smoke, cold caches) | Run 2 (agent test) | Run 3 (agent test, pixel_6) |
|---|---|---|---|
| Setup + `npm ci` | 1:10 | ~1:30 | ~1:30 |
| Gradle `assembleDebug` x86_64 | 23:22 | 19:24 | 15:49 |
| AVD create + snapshot | 2:14 (first run only) | from cache | new cache key, ~2:30 |
| Emulator start until `boot_completed` | 81 s | 81 s | 44 s |
| Install + cold start + Maestro `smoke.yaml` | flow 63 s | flow ~60 s | flow 52 s |
| Second boot for the agent | – | 27 s | 36 s |
| Claude Code agent (dummy task) | – | 4:45 (24 turns) | 3:21 (22 turns) |
| **`emulator` job total** | **31 min** | **33 min** | **32 min** |

The `publish` job takes < 1 min.

- The Gradle build dominates: even with the Gradle cache warm it recompiles the native (CMake / New Architecture)
  parts. A real ticket will spend 10–40 min in the agent step, so expect **35–75 min per agent run** and
  ~30 min per smoke run.
- Private repo, GitHub Free: 2,000 Linux minutes/month → roughly 25–50 agent runs. GitHub Pro: 3,000.
- Public repo: standard runners are free and have 4 vCPU / 16 GB; the build should roughly halve.
- Claude usage counts against the subscription limits (OAuth token), not against GitHub minutes.
- Hard limits: `emulator` job 110 min (build step 45, smoke 30, agent boot 15, Claude 45), `publish` job 10 min.
- Ideas to cut minutes: cache `android/app/.cxx` + `android/app/build/intermediates` keyed on native deps,
  or reuse the APK artifact from CI (#539) when only JS changed and let the agent use Metro.
