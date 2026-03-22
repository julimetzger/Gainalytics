# Skill-Based Orchestrator

## Current Repo Status

This document tracks the implemented skill-based orchestration approach as it exists
now in the repository.

Current location:

- `orchestrator/codex-skills/`

Supporting ticket source:

- `tickets/`

Sibling alternative:

- `orchestrator/langgraph-state-managed/`

## Summary

The current skill-based approach uses:

- a main skill `orchestrator`
- a worker skill `feature`
- real local worktrees per feature
- one external `codex exec` worker process per ticket
- review bundles with screenshots, checks, and acceptance evidence

It does not use built-in Codex subagents as the actual feature execution surface.
Each feature worker edits code directly inside its assigned local worktree.

## Current Structure

```text
orchestrator/
  README.md
  codex-skills/
    README.md
    orchestrator/
      SKILL.md
      agents/openai.yaml
      scripts/
        reserve_emulators.py
        create_worktree.py
        launch_feature_job.py
        read_run_status.py
        validate_review_bundle.py
        update_state.py
        runtime_state.py
    feature/
      SKILL.md
      agents/openai.yaml

tickets/
  TRN-001-training-overview-record-comparison.yaml
  TRN-002-linear-progression-from-last-training.yaml
  ANA-001-training-length-analysis-page.yaml
```

## Install And Invocation Model

The repo now contains the versioned source of truth for the skills. The installed
Codex skills still live under `~/.codex/skills`.

Install:

```bash
mkdir -p ~/.codex/skills
cp -R orchestrator/codex-skills/orchestrator ~/.codex/skills/orchestrator
cp -R orchestrator/codex-skills/feature ~/.codex/skills/feature
```

Typical invocation:

```text
/orchestrator
Start these ready tickets:
- tickets/TRN-001-training-overview-record-comparison.yaml
- tickets/ANA-001-training-length-analysis-page.yaml
Assign free emulators and report back when a ticket is ready for review.
```

## Runtime Defaults

- Worker branch: `feature/<ticket-id>`
- Worker worktree: `.worktrees/feature-<ticket-id>`
- Skill runtime state: `.codex-orchestrator/state.json`
- Per-ticket run data: `.codex-orchestrator/runs/<ticket-id>/`
- Ticket source of truth for ready work: `tickets/*.yaml`

## Implemented Workflow

The implemented skill-driven workflow is:

1. The user keeps rough ideas in `TODOS.md` and promotes concrete ready work into
   `tickets/*.yaml`.
2. `/orchestrator` reads the active ticket request from chat and inspects the local
   runtime state.
3. Free emulators are discovered locally through `adb devices`.
4. For each startable ticket, the orchestrator creates or reuses a local feature
   worktree and launches one external `codex exec` worker.
5. The worker runs with the `feature` skill inside the assigned worktree and uses
   the assigned emulator through `ANDROID_SERIAL`.
6. The worker runs local checks, produces screenshots, writes `status.json` and
   `summary.md`, and creates local commits.
7. If the worker needs clarification, the orchestrator surfaces that question back
   to the user.
8. If the worker reports `ready_for_review`, the orchestrator validates the review
   bundle before surfacing it.
9. User feedback starts another `codex exec` round in the same worktree.
10. `accept <ticket-id>` closes the ticket and releases the emulator reservation.

## Implemented Review Gate

`ready_for_review` is now guarded by an explicit review-bundle validator:

- `orchestrator/codex-skills/orchestrator/scripts/validate_review_bundle.py`

The bundle must contain:

- commit hashes
- changed files
- passed `typecheck`, `test`, and `lint`
- at least one passed e2e or Maestro artifact
- at least one screenshot
- acceptance-evidence entries for every acceptance criterion

If the bundle is incomplete, the orchestrator should not present the ticket as
review-ready and should feed the missing evidence back into another worker round.

## Ticket Format Expectations

Ready tickets should contain at least:

- `id`
- `status`
- `title`
- `description`
- `acceptanceCriteria`
- optional `constraints`, `components`, `priority`

The current repo already contains three structured ready tickets under `tickets/`.

## Environment Dependencies

The skill-based approach currently depends on the existing local Android and E2E
setup. For the concrete WSL, ADB, Maestro, and Metro details, the relevant source is:

- `__tests__/e2e/README.md`

Important Metro command:

```bash
npm start -- --host 0.0.0.0 --port 8081
```

## Verification Status

The current skill-based approach was verified with:

- `quick_validate.py` for both skills at their repo-local paths
- syntax and smoke checks for the helper scripts
- a temporary git-repo smoke test for worktree creation and state updates
- a synthetic review-bundle test for missing and complete evidence cases

## Current Limitations

- Installation into `~/.codex/skills` is still a manual copy step.
- The orchestrator is not a background daemon; each `/orchestrator` call acts as one scheduler tick.
- Worker continuation is implemented as a new `codex exec` round in the same worktree.
- Emulator discovery still depends on the current local ADB setup being reachable.

## Positioning

Use this approach when you want:

- chat-first orchestration
- feature tickets under `tickets/`
- flexible feature worker loops with screenshots and e2e evidence

Use the sibling state-managed approach when you want:

- queue files under `.orchestrator/tasks/`
- explicit runtime states and file-backed scheduling
- a Python CLI and scheduler loop
