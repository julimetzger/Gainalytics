---
name: orchestrator
description: Coordinate multiple ready feature tickets across free Android emulators and local git worktrees by launching one external `codex exec` worker per ticket. Use when the user wants to start, resume, review, accept, or summarize several implementation tickets from chat without maintaining a separate backlog queue. Keep runtime state under `.codex-orchestrator/` and route all worker questions back through the main chat.
---

# Orchestrator

## Overview

Coordinate `/feature` workers as external `codex exec` jobs running in real local
worktrees. Treat every invocation as one scheduler tick: refresh state, collect
worker results, handle user actions, and launch new work when free emulators exist.

## Runtime Contract

- Keep runtime state in `.codex-orchestrator/state.json`.
- Keep per-ticket artifacts in `.codex-orchestrator/runs/<ticket-id>/`.
- Use one local branch and one local worktree per ticket:
  - branch: `feature/<ticket-id>`
  - worktree: `.worktrees/feature-<ticket-id>`
- Feature code changes happen only inside the worker job's assigned worktree.
- Do not implement feature code in the main orchestrator flow unless the user explicitly asks.

## Use The Bundled Scripts

Always prefer the bundled scripts instead of re-implementing the mechanics in the prompt:

- `scripts/reserve_emulators.py`
- `scripts/create_worktree.py`
- `scripts/launch_feature_job.py`
- `scripts/read_run_status.py`
- `scripts/validate_review_bundle.py`
- `scripts/update_state.py`

Read `scripts/runtime_state.py` only when you need to patch or debug the state format.

## Supported User Intents

Handle these intents:

- Start or add tickets from the current prompt.
- Show status for running, queued, blocked, or review-ready tickets.
- Apply `feedback <ticket-id>: ...` to an existing ticket.
- Apply `accept <ticket-id>` to close a review-ready ticket and release its emulator.

If the prompt contains tickets plus a status or feedback request, handle the control action first,
then attempt to dispatch any newly startable tickets.

## Ticket Normalization

Normalize prompt tickets into this minimum shape:

- `id`
- `title`
- `description`
- `acceptanceCriteria`
- optional: `constraints`, `components`, `priority`

If any required field is missing, ask the user once before launching a worker.

## Scheduler Tick Workflow

1. Load `.codex-orchestrator/state.json`. Create an empty state if it does not exist.
2. Refresh the stored runs by reading each run directory with `scripts/read_run_status.py`.
   - if a worker reports `ready_for_review`, validate the review bundle with `scripts/validate_review_bundle.py` before surfacing it as review-ready
3. Apply user actions from the current prompt:
   - `accept <ticket-id>`:
     - mark the ticket `accepted`, then `closed`
     - release its emulator reservation
   - `feedback <ticket-id>: ...`:
     - append the feedback to the ticket history
     - mark the ticket `running`
     - launch a new worker round in the same worktree and on the same emulator
4. Normalize any new tickets from the current prompt.
5. Discover and reserve free emulators.
   - if emulator discovery returns an adb error, surface that error clearly and leave new tickets queued
6. For each startable ticket:
   - create or reuse the local feature worktree
   - create or reuse the run directory
   - launch one external `codex exec` worker
   - record `job_id`, branch, worktree, emulator, and status `running`
7. Summarize:
   - newly started tickets
   - tickets waiting for input
   - tickets ready for review
   - tickets still queued because no emulator was free

## Review And Question Handling

When a worker reports `needs_input`:

- surface the question in chat
- include ticket id, summary, and the exact blocker text
- do not restart the worker until the user replies

When a worker reports `ready_for_review`:

- first validate that the review bundle is complete:
  - `status.json` exists and still says `ready_for_review`
  - `summary.md` exists
  - commit hashes are present
  - changed files are present
  - required checks are present and passed
  - at least one screenshot file exists
  - at least one e2e or Maestro evidence file exists
  - every acceptance criterion has explicit evidence attached
- if validation fails:
  - do not present the ticket as review-ready
  - treat it as needing another worker round
  - send the missing evidence back as concrete feedback
- surface:
  - acceptance-criteria evidence
  - commit hashes
  - changed files
  - checks run and their status
  - screenshot paths
  - e2e report or log paths
  - short implementation summary
- do not close the ticket automatically

## Launch Contract For Workers

Launch workers through `scripts/launch_feature_job.py`.

Each worker must:

- use `$feature`
- work directly in the assigned local worktree
- use the assigned emulator through `ANDROID_SERIAL`
- write `status.json` and `summary.md` to the run directory before exiting

The worker lifecycle is resumable rounds, not one permanently attached process.

## Final Response Shape

Keep your chat response compact and grouped by ticket:

- `started`
- `waiting_for_input`
- `ready_for_review`
- `queued`
- `closed`

Always mention when no emulator was free, when a worker was resumed from feedback,
and when a ticket was closed by acceptance.
