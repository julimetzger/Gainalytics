# LangGraph State Managed Orchestrator

This directory contains the Python and LangGraph-style state-managed orchestration
implementation and its approach-specific documentation.

## What This Approach Is

Local-first orchestration MVP for 4 fixed Codex CLI coding agents.

This approach uses:

- a persistent runtime under `.orchestrator/`
- a Python CLI entry point via `python -m orchestrator.cli`
- fixed slots that map one worktree to one emulator
- explicit run states, automated checks, and self-repair retries

## Structure

The actual implementation now lives in this directory:

- `orchestrator/langgraph-state-managed/cli.py`
- `orchestrator/langgraph-state-managed/graph/`
- `orchestrator/langgraph-state-managed/checks/`
- `orchestrator/langgraph-state-managed/models/`
- `orchestrator/langgraph-state-managed/scheduler/`

The parent `orchestrator/__init__.py` extends the package path so the existing
Python command surface still works:

- `python -m orchestrator.cli`

## Install

```bash
python3 -m pip install -r orchestrator/langgraph-state-managed/requirements.txt
```

## Commands

- `python -m orchestrator.cli init`
- `python -m orchestrator.cli run-task --task .orchestrator/tasks/inbox/TASK-0001.yaml`
- `python -m orchestrator.cli scheduler --once`
- `python -m orchestrator.cli scheduler --loop --interval 10 --max-parallel 4`

## Typical Usage

1. Install dependencies:

   ```bash
   python3 -m pip install -r orchestrator/langgraph-state-managed/requirements.txt
   ```

2. Initialize runtime folders and default config:

   ```bash
   python3 -m orchestrator.cli init
   ```

3. Review and adjust the generated config files if needed:
   - `.orchestrator/config/slots.yaml`
   - `.orchestrator/config/checks.yaml`
   - `.orchestrator/config/policy.yaml`

4. Create a business-only task file in `.orchestrator/tasks/inbox/`.

5. Run one task directly:

   ```bash
   python3 -m orchestrator.cli run-task --task .orchestrator/tasks/inbox/TASK-0001.yaml
   ```

6. Or let the scheduler process queued tasks:

   ```bash
   python3 -m orchestrator.cli scheduler --loop --interval 10 --max-parallel 4
   ```

## Runtime Layout

The orchestrator stores runtime state under `.orchestrator/` at the repository root.
Default E2E execution uses the existing repo script:
`bash ./__tests__/e2e/scripts/run-maestro-from-wsl.sh ... --device <slot emulator serial>`.

Important runtime folders:

- `.orchestrator/tasks/inbox`: new tasks waiting to be claimed
- `.orchestrator/tasks/processing`: tasks currently running
- `.orchestrator/tasks/done`: successfully completed tasks
- `.orchestrator/tasks/failed`: failed tasks
- `.orchestrator/inbox/questions`: clarification or approval requests from Codex
- `.orchestrator/inbox/answers`: human answers that unblock waiting runs
- `.orchestrator/runs/<run_id>`: logs, state snapshots, resolved config snapshot
- `.orchestrator/results/<run_id>.yaml`: final run summary

## Workflow

The orchestrator workflow is:

1. `init` creates the runtime folders and default slot/check/policy config.
2. A task YAML is placed into `.orchestrator/tasks/inbox/`.
3. `run-task` executes that file directly, or `scheduler` claims queued task files and moves them from `inbox` to `processing`.
4. The task is schema-validated. Only business fields are allowed in the task file.
5. The orchestrator resolves execution defaults from `.orchestrator/config/`.
6. A free fixed slot is reserved. A slot maps one Codex worktree to one emulator serial.
7. Codex runs inside that assigned worktree.
8. Codex receives:
   - the business requirements and acceptance criteria
   - the assigned slot id
   - the assigned emulator serial
   - the resolved validation commands (`lint`, `typecheck`, `tests`, `e2e`)
   - the latest failed-check feedback, if this is a retry
9. The Codex process inherits:
   - `ANDROID_SERIAL`
   - `ORCHESTRATOR_EMULATOR_SERIAL`
   - `ORCHESTRATOR_SLOT_ID`
10. That means Codex can use the assigned emulator while implementing and can run normal validation commands itself during development.
11. If Codex needs clarification or approval, the orchestrator writes a question file to `.orchestrator/inbox/questions/` and waits for the matching answer file in `.orchestrator/inbox/answers/`.
12. When Codex returns `completed`, the orchestrator runs the configured checks automatically.
13. If checks pass, the run finishes as `SUCCEEDED`.
14. If a check fails with a code failure, the orchestrator summarizes the failing check output and sends that feedback into another Codex round.
15. This self-repair loop continues up to `policy.codex.self_repair_max_rounds`.
16. If a check fails with an environment problem, or the retry budget is exhausted, the run finishes as failed.
17. The task file is moved from `processing` to `done` or `failed`, and the final summary is written to `.orchestrator/results/`.

## Codex Development Loop

During `run_codex`, the assigned slot emulator is passed into the Codex session through:

- `ANDROID_SERIAL`
- `ORCHESTRATOR_EMULATOR_SERIAL`
- `ORCHESTRATOR_SLOT_ID`

The Codex prompt also includes the resolved `lint`, `typecheck`, `tests`, and `e2e`
commands for the assigned slot so Codex can run them directly while developing.

After a successful Codex pass, the orchestrator runs the configured checks. If a
check fails with a code failure, the failing check feedback is summarized and fed
back into a new Codex attempt automatically up to `policy.codex.self_repair_max_rounds`.
Environment failures still stop the run immediately.

## Status Model

The main lifecycle is:

- `RECEIVED`
- `VALIDATED`
- `ASSIGNED`
- `RUNNING_CODEX`
- `WAITING_HUMAN`
- `RUNNING_CHECKS`
- `SUCCEEDED`
- `FAILED_CODE`
- `FAILED_ENV`
- `FAILED_VALIDATION`

## Task YAML (business-only)

```yaml
schema_version: "1.0"
task_id: "TASK-0001"
title: "Implement feature X"
description: "Business context and expected behavior"
business_requirements:
  - id: "BR-1"
    text: "User can trigger flow X from screen Y"
acceptance_criteria:
  - id: "AC-1"
    text: "Given A when B then C"
```

## Human Inbox

- Questions are written to `.orchestrator/inbox/questions/<question_id>.yaml`.
- Human answers should be written to `.orchestrator/inbox/answers/<question_id>.yaml`:

```yaml
question_id: "Q-1234567890"
answer: "Approved. Use /tmp/mock-data for this task."
answered_at: "2026-03-15T12:30:00Z"
```
