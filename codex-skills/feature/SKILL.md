---
name: feature
description: Implement exactly one ready ticket in a real local git worktree with an assigned Android emulator, local commits, screenshots, and validation artifacts. Use when a worker is started by the orchestrator to modify code directly in the target worktree, run tests, lint, and emulator checks, and write `needs_input`, `ready_for_review`, or `blocked` status back to the matching `.codex-orchestrator/runs/` ticket directory.
---

# Feature

## Overview

Implement one ticket end-to-end inside the assigned local worktree. Use the assigned
emulator for verification, create local commits on the feature branch, and write the
result contract back to the run directory before exiting.

## Required Inputs

Expect the orchestrator prompt to provide:

- `ticket_id`
- `title`
- `description`
- `acceptanceCriteria`
- optional `constraints`, `components`, `priority`
- `worktree_path`
- `branch`
- `emulator_serial`
- `run_dir`
- prior review feedback, if this is a resumed round

If any of these are missing, write `needs_input` instead of guessing.

## Worker Rules

- Work only inside the assigned worktree.
- Use the assigned branch.
- Export or honor `ANDROID_SERIAL=<emulator_serial>` for device commands.
- Reuse existing adb host or socket environment when it is already configured by the orchestrator.
- Before running Metro-dependent app or Maestro checks, ensure Metro is reachable. If it is not already running, start `npm start -- --host 0.0.0.0 --port 8081`.
- For the full WSL, adb, and Maestro setup, read `__tests__/e2e/README.md` instead of re-deriving the environment details.
- Do not ask the user questions directly.
- Do not finish without writing `status.json` and `summary.md` in `run_dir`.
- Store screenshots and check logs under `run_dir`.

## Workflow

1. Confirm the branch and worktree state.
2. Read the ticket, current code, and any prior feedback.
3. Implement the feature directly in the assigned worktree.
4. Run the smallest relevant checks while iterating.
5. Before review, run the final checks relevant to the change:
   - `npm run typecheck`
   - `npm test`
   - `npm run lint`
   - emulator verification
   - for UI or flow changes, run Maestro smoke or a relevant flow against the assigned emulator
6. Capture at least one screenshot that shows the implemented result.
7. Produce review evidence for every acceptance criterion:
   - map each criterion to the specific code change, screenshot, and check or e2e result that proves it
8. Create one or more local commits on the assigned feature branch.
9. Write `status.json` and `summary.md`, then exit.

## Emulator And Artifact Commands

Use commands like these when they fit the ticket:

```bash
adb exec-out screencap -p > "<run_dir>/screenshots/final.png"
bash ./__tests__/e2e/scripts/run-maestro-from-wsl.sh --mode smoke --device "$ANDROID_SERIAL" > "<run_dir>/checks/maestro-smoke.log" 2>&1
npm run typecheck > "<run_dir>/checks/typecheck.log" 2>&1
npm test > "<run_dir>/checks/test.log" 2>&1
npm run lint > "<run_dir>/checks/lint.log" 2>&1
```

Adapt the exact verification to the ticket. Do not skip emulator verification when the
change affects UI or user flows.

## Status Contract

Write `status.json` with this shape:

```json
{
  "ticket_id": "TRN-104",
  "status": "ready_for_review",
  "summary": "Implemented the feature and verified it on emulator-5554.",
  "commit_hashes": ["abc1234"],
  "changed_files": ["app/example.tsx"],
  "checks_run": [
    {
      "name": "typecheck",
      "status": "passed",
      "log_file": "checks/typecheck.log"
    }
  ],
  "acceptance_evidence": [
    {
      "criterion": "User can save the exercise",
      "status": "covered",
      "evidence": [
        "checks/maestro-smoke.log",
        "screenshots/final.png"
      ]
    }
  ],
  "artifacts": {
    "screenshots": ["screenshots/final.png"],
    "e2e_reports": ["checks/maestro-smoke.log"]
  },
  "question": null,
  "blocker": null
}
```

Valid `status` values:

- `needs_input`
- `ready_for_review`
- `blocked`

Rules:

- Use `needs_input` for permission or business questions.
- Use `blocked` for technical blockers you cannot safely resolve.
- Use `ready_for_review` only after commits, screenshots, acceptance evidence, and review checks are in place.
- For `ready_for_review`, include passed results for `typecheck`, `test`, and `lint`.
- For `ready_for_review`, include at least one passed e2e or Maestro check with a stored log or report.
- For `ready_for_review`, include at least one screenshot file that exists under `run_dir`.
- For `ready_for_review`, every acceptance criterion must have one `acceptance_evidence` entry with concrete artifact or check references.
- Store artifact paths relative to `run_dir`.

## Summary File

Write `summary.md` next to `status.json`.

Include:

- what changed
- why it satisfies the acceptance criteria
- what checks ran
- which screenshot(s) to review
- which e2e artifact(s) prove the feature works
- any known caveats
