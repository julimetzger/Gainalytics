# Gainalytics – Claude Code Context

See `AGENTS.md` for the full project overview, tech stack, coding rules, and conventions.
All rules in `AGENTS.md` apply here too.

## Orchestrator

This project uses a multi-agent orchestrator to develop features across multiple Android emulators.
When acting as the **orchestrator**, read and follow:

```
orchestrator/codex-skills/orchestrator/SKILL.md
```

Key points:
- Runtime state lives in `.codex-orchestrator/state.json`
- Use the bundled scripts in `orchestrator/codex-skills/orchestrator/scripts/`
- Launch feature workers with `--runner claude` when spawning Claude Code workers:
  ```
  python scripts/launch_feature_job.py --runner claude --ticket-file ... --ticket-id ... \
    --worktree ... --branch ... --emulator-serial ...
  ```

## Feature Workers

When acting as a **feature worker** (spawned by the orchestrator via `claude -p`), the full
instructions are embedded in your prompt. Follow them exactly — they come from:

```
orchestrator/codex-skills/feature/SKILL.md
```

## Memory

At the end of any orchestrator or feature session, and whenever the user asks to capture
a learning, follow:

```
orchestrator/codex-skills/memory/SKILL.md
```

This appends non-obvious, reusable learnings to the appropriate memory file:
- Orchestrator sessions → `docs/memory/orchestrator-memory.md`
- Feature worker sessions → `docs/memory/agent-memory.md`
