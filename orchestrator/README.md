# Orchestrator Approaches

This directory now separates the two orchestration approaches that were previously
spread across the repository:

- `orchestrator/codex-skills/`
- `orchestrator/langgraph-state-managed/`

## Codex Skills

The skill-based approach lives under `orchestrator/codex-skills/`.

Use this approach when you want:

- chat-driven orchestration through `/orchestrator`
- one external `codex exec` worker per feature ticket
- one local worktree and one emulator per worker
- review bundles with screenshots and e2e evidence

Start here:

- `orchestrator/codex-skills/README.md`
- `orchestrator/codex-skills/orchestrator/SKILL.md`
- `orchestrator/codex-skills/feature/SKILL.md`

## LangGraph State Managed

The Python state-machine approach is documented under
`orchestrator/langgraph-state-managed/`.

Use this approach when you want:

- a file- and queue-driven runtime under `.orchestrator/`
- fixed slots with reserved worktrees and emulator serials
- automated checks and self-repair loops in a state-managed graph
- a scheduler that claims queued task files

Start here:

- `orchestrator/langgraph-state-managed/README.md`

## Compatibility Note

The runnable Python package for the LangGraph state-managed approach now lives
physically under `orchestrator/langgraph-state-managed/`.

The parent `orchestrator/` package only keeps:

- this overview README
- `orchestrator/codex-skills/`
- `orchestrator/langgraph-state-managed/`
- a tiny `__init__.py` shim that extends the package path

That shim keeps existing module commands working:

```bash
python3 -m pip install -r orchestrator/langgraph-state-managed/requirements.txt
python3 -m orchestrator.cli init
python3 -m orchestrator.cli scheduler --once
```

The new subdirectories are for clearer separation of the two approaches and for
approach-specific documentation and assets.
