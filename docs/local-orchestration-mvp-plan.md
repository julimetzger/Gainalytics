# Local Orchestration MVP v2

## Current Repo Status

This document tracks the Python and LangGraph-style state-managed orchestration
approach as it exists now in the repository.

Current location:

- `orchestrator/langgraph-state-managed/`

Compatibility shim:

- `orchestrator/__init__.py`

Sibling approach:

- `orchestrator/codex-skills/`

This means the repository now keeps both orchestration approaches under one common
`orchestrator/` umbrella, but in clearly separated subdirectories.

## Scope Of This Approach

The state-managed approach is the file- and queue-driven alternative. It is designed
for:

- business-only task YAML files under `.orchestrator/tasks/`
- explicit state transitions
- fixed worktree and emulator slots
- automated checks and self-repair rounds
- human inbox files for clarifications and approvals

It is not the primary basis for the newer skill-driven workflow. That newer workflow
is documented separately in `docs/skill-orchestrator-plan.md`.

## Current Structure

```text
orchestrator/
  README.md
  __init__.py
  codex-skills/
    README.md
    orchestrator/
      SKILL.md
      scripts/
    feature/
      SKILL.md
  langgraph-state-managed/
    README.md
    cli.py
    config.py
    constants.py
    pyproject.toml
    requirements.txt
    checks/
    codex/
    graph/
    inbox/
    models/
    policy/
    scheduler/
    slots/
    storage/
    tests/

.orchestrator/
  config/
    slots.yaml
    checks.yaml
    policy.yaml
  tasks/
    inbox/
    processing/
    done/
    failed/
  inbox/
    questions/
    answers/
  runs/
  results/
  logs/
```

## Runtime Command Surface

The implementation now lives physically under `orchestrator/langgraph-state-managed/`,
but the old Python entrypoint still works because `orchestrator/__init__.py` extends
the package path.

Install:

```bash
python3 -m pip install -r orchestrator/langgraph-state-managed/requirements.txt
```

Commands:

```bash
python3 -m orchestrator.cli init
python3 -m orchestrator.cli run-task --task .orchestrator/tasks/inbox/TASK-0001.yaml
python3 -m orchestrator.cli scheduler --once
python3 -m orchestrator.cli scheduler --loop --interval 10 --max-parallel 4
```

## Implemented Workflow

The implemented state-managed workflow is:

1. `init` creates runtime folders and default config in `.orchestrator/`.
2. A business-only task YAML is placed in `.orchestrator/tasks/inbox/`.
3. `run-task` or `scheduler` loads and validates the task.
4. Default execution policy is resolved from `.orchestrator/config/`.
5. A fixed slot is reserved with one worktree and one emulator serial.
6. Codex runs in that assigned worktree with the slot emulator in its environment.
7. The orchestrator runs the configured checks after Codex finishes.
8. If a code check fails, the orchestrator summarizes the failure and starts another
   Codex repair round up to the configured retry limit.
9. If Codex needs clarification, the run waits on question and answer files in the
   local inbox.
10. Final artifacts are written under `.orchestrator/runs/` and `.orchestrator/results/`.

## Current Design Notes

- Task YAML stays business-only.
- Technical policy lives in `.orchestrator/config/checks.yaml` and `policy.yaml`.
- Slot assignment stays static and file-backed.
- The default e2e runner stays the existing Maestro WSL script.
- The Python approach remains local-first and reproducible, but it is no longer the
  only orchestration concept in the repo.

## Verification Status

The current moved implementation was verified after the structure change with:

- `python3 -m orchestrator.cli --help`
- `python3 -m unittest discover -s orchestrator/langgraph-state-managed/tests -p 'test_*.py'`

The move keeps the old CLI surface working while making the state-managed approach
physically live under `orchestrator/langgraph-state-managed/`.

## Open Positioning

This approach should now be treated as the explicit "state-managed alternative".

Use it when you want:

- durable local queue files
- strict state transitions
- fixed slots and resumable runs

Use the sibling skill-based approach when you want:

- `/orchestrator` in chat
- ticket files under `tickets/`
- one `codex exec` worker per feature
- screenshot and e2e evidence bundles per ticket
