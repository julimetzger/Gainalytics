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
- **Test trigger (temporary):** a push to `feature/GH-545` that touches the workflow or
  `.github/agent-emulator/` runs smoke mode; a commit message containing `[agent-emulator:agent]`
  runs the built-in dummy task (`.github/agent-emulator/test-task.md`). Remove the `push:` block
  before/after merging.

## Secret and environment

- The job runs in the GitHub environment **`gainalytics`** and reads the secret
  **`CLAUDE_CODE_OAUTH_TOKEN`** (OAuth token of the Claude subscription).
- Create the token locally with `claude setup-token`, then Settings → Environments → `gainalytics` →
  *Add environment secret* → name `CLAUDE_CODE_OAUTH_TOKEN`. An API key would work too
  (`anthropic_api_key` input of the action, secret `ANTHROPIC_API_KEY`), but is billed per token.
- Do not add *Required reviewers* to the environment, otherwise every run waits for approval.
- The workflow only logs whether the secret is non-empty, never its value.

## What happens in a run

1. `emulator` job (read-only token, `timeout-minutes: 110`):
   checkout → KVM → JDK 17 / Node 22 → `npm ci` → `assembleDebug -PreactNativeArchitectures=x86_64`
   (the debug APK embeds the JS bundle because `debuggableVariants = []`, so no Metro is needed) →
   Maestro CLI (pinned version + SHA-256) → AVD (API 34, google_apis, x86_64, cached snapshot) →
   smoke phase (`smoke.sh`: install, cold start, `__tests__/e2e/maestro/flows/smoke.yaml`, screenshots, logcat).
2. Agent phase (not in smoke mode): the task (issue text + optional text, or the dummy task) is written to
   `.agent-run/task.md`; the emulator is booted again and the APK installed; Claude Code
   (`anthropics/claude-code-action/base-action`) runs with the prompt `.github/agent-emulator/agent-prompt.md`.
   Allowed tools: file read/edit, `adb`, `maestro`, `tool.sh`, jest/tsc/lint, local git
   (status/diff/log/add/commit). Denied: `git push`, `gh`, `curl`/`wget`, web tools, `env`/`printenv`.
   For JS changes the agent starts Metro (`tool.sh metro-start`, reached by the emulator via `10.0.2.2:8081`)
   or rebuilds (`tool.sh rebuild`).
3. `publish` job (only if the agent committed): receives the commits as a git bundle, rejects changes to
   `.github/`, `.gains`, keystores or `.env`, pushes them to a new branch `agent/emulator-<ticket>-<run id>`
   and opens a **draft** PR against the branch the workflow ran on. It never pushes to `master`, never merges,
   never releases. For issue runs it comments the PR link on the issue.

The agent therefore never holds a token with write access; only the small publish job does.

## Data

The emulator starts with an empty store. The `.gains` fixtures contain real training data and are
neither pushed nor imported; screenshots show only the empty state. Synthetic test data will come with #535.
Flows that need imported data cannot run here yet.

## Where results land

- Run summary: timings and the agent's final message.
- Artifact `agent-emulator-evidence` (14 days): `screenshots/` (full size + `small/`), `maestro/<flow>/report.xml`
  and debug output, `logcat/`, `timings.txt`, `task.md`, PR text written by the agent.
- Artifact `agent-result` (7 days): git bundle with the agent's commits.
- Draft PR on `agent/emulator-*` with the evidence screenshots committed under `screenshots/<ticket>/`.

## Runtime and minutes

See the measured numbers in the PR of GH-545 (smoke and agent run). Rough budget per run on the
standard private runner (2 vCPU, 7 GB, 1× minute multiplier for Linux):

| Phase | Minutes (approx.) |
|---|---|
| Setup + `npm ci` | 3–4 |
| Gradle `assembleDebug` x86_64 (cold / warm cache) | 12–20 / 5–8 |
| AVD create + snapshot (first run only) | 4–6 |
| Emulator boot + install + Maestro smoke flow | 4–8 |
| Agent (depends on task, hard limit 45) | 10–45 |

- Smoke only: ~20–30 min per run. Agent run: ~35–80 min.
- Private repo, GitHub Free: 2,000 Linux minutes/month included → roughly 25–50 agent runs.
- Public repo: standard runners are free and have 4 vCPU / 16 GB, so the emulator and Gradle are noticeably faster.
- Claude usage counts against the subscription's limits (OAuth token), not against GitHub minutes.
