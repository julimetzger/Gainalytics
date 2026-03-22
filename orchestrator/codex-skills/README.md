# Codex Skills Usage

This directory contains the repo-local source for the two Codex skills used by the
skill-based feature orchestration workflow:

- `orchestrator`: main skill that dispatches ready tickets to free emulators and
  coordinates review, feedback, and acceptance
- `feature`: worker skill that implements exactly one ticket inside one local
  worktree and returns review evidence

The actual live Codex skill directory is `~/.codex/skills`. The files in this repo
are the versioned source of truth.

## Install

Copy the two skills into your local Codex skills directory:

```bash
mkdir -p ~/.codex/skills
cp -R orchestrator/codex-skills/orchestrator ~/.codex/skills/orchestrator
cp -R orchestrator/codex-skills/feature ~/.codex/skills/feature
```

If you update the repo version later, copy them again to refresh the installed
skills.

## Files

- `orchestrator/codex-skills/orchestrator/SKILL.md`: main orchestration behavior
- `orchestrator/codex-skills/feature/SKILL.md`: worker behavior
- `orchestrator/codex-skills/orchestrator/scripts/`: local helper scripts for emulator
  reservation, worktrees, run-state handling, and review-bundle validation

## Prerequisites

Before you use the skills, make sure these pieces are available:

- Codex CLI with `codex exec`
- Git worktree support
- At least one reachable Android emulator
- `adb` and `maestro` configured for the current WSL or Windows setup
- Metro available for app and Maestro-driven verification

For the concrete WSL, ADB, Maestro, and Metro setup, read
`__tests__/e2e/README.md`.

Important Metro command:

```bash
npm start -- --host 0.0.0.0 --port 8081
```

## Ticket Source

Keep rough ideas in `TODOS.md`, but promote truly ready work into separate ticket
files under `tickets/`.

Current examples:

- `tickets/TRN-001-training-overview-record-comparison.yaml`
- `tickets/TRN-002-linear-progression-from-last-training.yaml`
- `tickets/ANA-001-training-length-analysis-page.yaml`

Each ready ticket should contain at least:

- `id`
- `status`
- `title`
- `description`
- `acceptanceCriteria`
- optional `constraints`, `components`, `priority`

## Typical Workflow

### 1. Start the orchestrator

In Codex, invoke the main skill and point it to the ready tickets you want to start.
Use your client's normal skill invocation syntax, for example `/orchestrator`.

Example prompt:

```text
/orchestrator
Start these ready tickets and assign free emulators:
- tickets/TRN-001-training-overview-record-comparison.yaml
- tickets/ANA-001-training-length-analysis-page.yaml
Report back when a ticket is ready for review.
```

### 2. What the orchestrator does

For each startable ticket, the orchestrator should:

- inspect the current runtime state under `.codex-orchestrator/`
- find a free emulator
- create or reuse `.worktrees/feature-<ticket-id>`
- launch a `codex exec` worker in that worktree
- track evidence and review status under `.codex-orchestrator/runs/<ticket-id>/`

### 3. Review-ready output

When a worker reports `ready_for_review`, the orchestrator should only surface it
after the review bundle passes validation. The review bundle must include:

- commit hashes
- changed files
- passed `typecheck`, `test`, and `lint`
- at least one passed e2e or Maestro artifact
- at least one screenshot
- acceptance-evidence entries for every acceptance criterion

### 4. Answer worker questions

If the orchestrator reports `needs_input`, continue the same ticket with feedback.

Example:

```text
/orchestrator
feedback TRN-002: Use 2.5 kg rounding for progression and keep the existing button layout.
```

### 5. Accept a finished ticket

After review, explicitly accept the ticket:

```text
/orchestrator
accept TRN-001
```

This should close the ticket and release its emulator reservation.

## Role Of The Feature Skill

`feature` is usually not the skill you start manually. It is the worker contract used
by the orchestrator when it launches a ticket-specific `codex exec` job.

Use it directly only if you want to debug or manually run a single worker flow.

## Runtime Artifacts

The workflow writes local runtime data into:

- `.codex-orchestrator/state.json`
- `.codex-orchestrator/runs/<ticket-id>/`
- `.worktrees/feature-<ticket-id>`

Typical artifacts per run:

- `status.json`
- `summary.md`
- `checks/*.log`
- `screenshots/*.png`
- `ticket.json`
- `prompt.txt`

## Current Scope And Limitations

- The orchestrator is skill-driven, not a background daemon.
- Every `/orchestrator` invocation acts like one scheduler tick.
- Worker continuation happens as a new `codex exec` round in the same worktree.
- The repo contains the source for the skills; installation into `~/.codex/skills`
  is still a manual copy step.
