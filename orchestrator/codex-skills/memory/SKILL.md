---
name: memory
description: Review the current session and append non-obvious, reusable learnings to the appropriate memory file. Call at the end of every orchestrator or feature worker session, and whenever the user explicitly asks to save a learning.
---

# Memory

## Purpose

Capture non-obvious learnings from this session so future orchestrators and agents
do not repeat the same discovery or debugging work. Write only what is not already
documented. Do not paraphrase the existing entries — read them first.

## Which File To Write To

- If running as **orchestrator** → write to `docs/memory/orchestrator-memory.md`
- If running as **feature worker** → write to `docs/memory/agent-memory.md`
- If unsure or the learning applies to both → write to both

`docs/memory/orchestrator-memory.md` covers: worker lifecycle, review gating, validator
behavior, rate-limit handling, script fixes, and orchestrator process learnings.

`docs/memory/agent-memory.md` covers: infrastructure inside the worker sandbox (adb, Metro,
Maestro), React Native code patterns, test quality, and feature agent behavior.

## When To Run

- At the end of every orchestrator session (before responding with the final summary).
- At the end of every feature worker run (after writing `status.json` and `summary.md`,
  before exiting).
- When the user explicitly asks to save a learning or calls this skill directly.

## Inputs

Read as much of the following as is available:

- `docs/memory/orchestrator-memory.md` — orchestrator learnings (read before writing if running as orchestrator)
- `docs/memory/agent-memory.md` — feature worker learnings (read before writing if running as feature worker)
- `.codex-orchestrator/runs/<ticket-id>/status.json` — what succeeded, what failed, what was blocked
- `.codex-orchestrator/runs/<ticket-id>/summary.md` — implementation notes and caveats
- `.codex-orchestrator/state.json` — ticket history and feedback rounds
- Current session context: errors encountered, fixes applied, feedback given and why

## What To Capture

Focus on learnings that are:

- **Non-obvious** — not derivable from reading the code or existing memory
- **Reusable** — applicable to future tickets, not specific to one data value
- **Actionable** — future agents or the orchestrator can act on the insight

Categories (use whichever apply):

| Category | Examples |
|----------|----------|
| Infrastructure | adb, Metro, Maestro, emulator, WSL, port issues |
| Code patterns | class-instance state bugs, Redux gotchas, library quirks |
| Test quality | what made a test weak, how to make it strong |
| Agent behavior | prompt patterns that caused regressions, feedback patterns that worked |
| Orchestrator process | validator false negatives, rate-limit handling, script fixes |

Do NOT capture:

- Learnings already documented in the relevant memory file
- Ticket-specific implementation details (those belong in `summary.md`)
- Temporary state or values that will change

## How To Write An Entry

Append new entries to the numbered list in the appropriate memory file.
Follow the existing format exactly:

```markdown
### N. Short title of the problem or learning

Problem:
- one-sentence description of what went wrong or what was discovered

Symptoms:
- observable sign 1
- observable sign 2

Working solution:
- concrete fix or pattern that resolved it

Relevant files:
- [filename](/absolute/path/to/file)
```

For learnings that are not problem/solution (e.g. a positive pattern that worked well),
use this shorter form:

```markdown
### N. Short title

Observation:
- what was learned

Apply when:
- situation where this applies

Relevant files:
- [filename](/absolute/path/to/file)
```

Also update the **Operational Guidance** section at the bottom of the relevant file
with one-line action bullets when the learning translates to a clear rule.

## Checklist Before Writing

1. Read the relevant memory file(s) fully.
2. For each candidate learning, check: is this already covered by an existing entry?
3. Only write entries that are genuinely new.
4. If nothing new was learned this session, write nothing (do not append empty or
   redundant content).
5. After writing, confirm the entry number is correct (increment from the last entry).

## Example Learnings Worth Capturing

- A script flag that caused silent failure (e.g. SKILL.md frontmatter breaking CLI option parsing)
- A React state pattern that broke `instanceof` checks (spread vs. constructor)
- A Maestro assertion that appeared to pass but did not verify the actual value
- A validator rule that produced false negatives (e.g. inline text in evidence paths)
- A rate-limit recovery pattern that worked (or didn't)
- A feedback phrasing that helped the agent converge faster
