---
name: feature
description: Implement exactly one ready ticket in a real local git worktree with an assigned Android device, local commits, screenshots, and validation artifacts. Use when a worker is started by the orchestrator to modify code directly in the target worktree, run tests and device checks, and write `needs_input`, `ready_for_review`, or `blocked` status back to the matching `.codex-orchestrator/runs/` ticket directory.
---

# Feature

## Overview

Implement one ticket end-to-end inside the assigned local worktree. Use the assigned
Android device for verification, create local commits on the feature branch, and write the
result contract back to the run directory before exiting.

## Required Inputs

Expect the orchestrator prompt to provide:

- `ticket_id`
- `title`
- `description`
- `acceptanceCriteria`
- optional `constraints`, `components`, `priority`
- optional `screens` — paths to app screenshots under `orchestrator/AppStruktur/` that show the UI area affected by the ticket
- `worktree_path`
- `branch`
- `device_serial` (or legacy `emulator_serial`)
- `run_dir`
- prior review feedback, if this is a resumed round

If any of these are missing, write `needs_input` instead of guessing.

## Worker Rules

- Work only inside the assigned worktree.
- Use the assigned branch.
- Export `ANDROID_SERIAL` for the assigned device serial, but do not rely on adb default device selection.
- In every direct adb command, pass `-s "$ANDROID_SERIAL"` explicitly.
- In every direct Maestro command, pass `--device "$ANDROID_SERIAL"` explicitly.
- Never target a different Android device than the one assigned by the orchestrator.
- Reuse existing adb host or socket environment when it is already configured by the orchestrator.
- If the orchestrator already provided a host Metro process or `E2E_METRO_PORT`, reuse it and do not start another packager.
- Before running Metro-dependent app or Maestro checks, ensure Metro is reachable. Only if no host Metro was provided should you start `npm start -- --host 0.0.0.0 --port 8081`.
- For the full WSL, adb, and Maestro setup, read `__tests__/e2e/README.md` instead of re-deriving the environment details.
- Do not ask the user questions directly.
- Do not finish without writing `status.json` and `summary.md` in `run_dir`.
- Store screenshots and check logs under `run_dir`.
- Before starting, check `run_dir` for existing artifacts (logs, screenshots, commits). If a previous round was interrupted, reuse what is already there instead of repeating completed work.

## App Structure Screenshots

Screenshots of the most common app screens are stored under `orchestrator/AppStruktur/`:

- `orchestrator/AppStruktur/analyse/` — Analyse tab screens (Analyse, ExerciseGraphs, History, MetricsOverview, Records, VideoAnalysisDetail, videoAnalysis)
- `orchestrator/AppStruktur/exercises/` — Exercise tab screens (ExerciseHome, ExerciseTab, ExerciseHistory, Exercisestats)
- `orchestrator/AppStruktur/training/` — Training tab screens (TrainingHome, TrainingOverview, TrainingActive, TrainingWorkouts, MicroOverviewTraining, PlanTraining, PlanSuggestion, EditTraining, addTraining)

If the ticket provides a `screens` list, read those images before starting implementation to understand the visual context and UI patterns of the area you are changing.
Even without an explicit `screens` list, consult the relevant screenshots in `orchestrator/AppStruktur/` when implementing UI changes.

## Workflow

1. Confirm the branch and worktree state.
2. Read `docs/memory/agent-memory.md` to learn from previous agent runs.
3. Read the ticket, current code, relevant app screenshots, and any prior feedback.
4. Implement the feature directly in the assigned worktree.
5. Run the smallest relevant checks while iterating.
6. Before review, run the final checks relevant to the change:
   - `npm test`
   - Android device verification
   - for UI or flow changes, run Maestro smoke or a relevant flow against the assigned device
   - workspace-wide `typecheck` and `lint` are optional health checks; record them if you run them, but they are not required for `ready_for_review`
7. Capture at least one screenshot that shows the implemented result.
8. Produce review evidence for every acceptance criterion:
   - map each criterion to the specific code change, screenshot, and check or e2e result that proves it
9. Create one or more local commits on the assigned feature branch.
10. Write `status.json` and `summary.md`.
11. Append new learnings to `docs/memory/agent-memory.md` (see Memory section), then exit.

## Emulator And Artifact Commands

Use commands like these when they fit the ticket:

```bash
adb -s "$ANDROID_SERIAL" exec-out screencap -p > "<run_dir>/screenshots/final.png"
bash ./__tests__/e2e/scripts/run-maestro-from-wsl.sh --mode smoke --device "$ANDROID_SERIAL" > "<run_dir>/checks/maestro-smoke.log" 2>&1
npm run typecheck > "<run_dir>/checks/typecheck.log" 2>&1
npm test > "<run_dir>/checks/test.log" 2>&1
npm run lint > "<run_dir>/checks/lint.log" 2>&1
```

Adapt the exact verification to the ticket. Do not skip Android device verification when the
change affects UI or user flows.

## Maestro Test Quality Rules

Maestro flows MUST assert the **actual resulting value**, not just element visibility or
the absence of a previous screen. A flow that only checks `assertNotVisible: "Save"` and
`assertVisible: id: "button-text"` proves the modal closed — it does not prove the feature
worked correctly.

**Required: assert the specific text or value that changed.**

For UI elements that display computed or user-driven text (labels, date strings, counts,
formatted values), verify the content:

```yaml
# WRONG — only proves the element exists
- assertVisible:
    id: "button-text"

# CORRECT — proves the element shows the expected value
- assertVisible:
    text: "03/15/2026 to 03/27/2026"

# CORRECT — partial match when exact value contains dynamic parts
- assertVisible:
    text: "03/15/2026 to"   # start date is known; today is dynamic
```

For dynamic values (e.g. today's date) use `evalScript` to compute the expected string
and then assert against it:

```yaml
- evalScript: |
    var today = new Date();
    var mm = String(today.getMonth() + 1).padStart(2, '0');
    var dd = String(today.getDate()).padStart(2, '0');
    var yyyy = today.getFullYear();
    output.todayStr = mm + '/' + dd + '/' + yyyy;
- assertVisible:
    text: "03/15/2026 to ${todayStr}"
```

For numeric state (counters, record counts, list lengths), read the value with
`copyTextFrom` and assert it with `assertTrue`:

```yaml
- copyTextFrom:
    id: "record-count-label"
- evalScript: |
    output.valid = output.value === "3 Records";
- assertTrue: ${valid}
```

**Do not accept a Maestro flow as passing evidence unless it contains at least one
assertion on the actual resulting value of the changed UI element.**

## Status Contract

Write `status.json` with this shape:

```json
{
  "ticket_id": "TRN-104",
  "status": "ready_for_review",
  "summary": "Implemented the feature and verified it on the assigned Android device.",
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

Evidence path rule:

- Every entry in `acceptance_evidence[].evidence` MUST be a bare relative file path (e.g. `"checks/test.log"`).
- Do NOT append inline annotations or test names (e.g. `"checks/test.log (test: 'foo')"` is invalid).
- If you want to name a specific test, put that in `summary.md`, not in the evidence path.

Rules:

- Use `needs_input` for permission or business questions.
- Use `blocked` for technical blockers you cannot safely resolve.
- Use `ready_for_review` only after commits, screenshots, acceptance evidence, and review checks are in place.
- For `ready_for_review`, include at least one passed automated test check relevant to the change, typically `npm test` or a focused test command.
- For `ready_for_review`, include at least one passed e2e or Maestro check with a stored log or report.
- For `ready_for_review`, include at least one screenshot file that exists under `run_dir`.
- For `ready_for_review`, every acceptance criterion must have one `acceptance_evidence` entry with concrete artifact or check references.
- Do not block `ready_for_review` only because repo-wide `typecheck` or `lint` fail outside the ticket scope.
- Store artifact paths relative to `run_dir`.

## Memory

Before starting implementation, read `docs/memory/agent-memory.md` to avoid repeating
known pitfalls (adb, Metro, Maestro, React Native patterns, test quality).

After writing `status.json` and `summary.md`, review what you learned during this run
and append new entries directly to `docs/memory/agent-memory.md`. Focus on:

- Infrastructure issues (adb, Metro, Maestro, emulator, WSL, port problems)
- Code patterns that caused bugs or were non-obvious
- Test quality observations (what made a test weak or strong)
- Agent behavior patterns (what worked, what caused regressions)

Rules for writing memory entries:

1. Read `docs/memory/agent-memory.md` first — do NOT duplicate existing entries.
2. Only write entries that are genuinely new and non-obvious.
3. Follow the existing format (numbered `### N. Title`, with Problem/Symptoms/Working solution or Observation/Apply when sections).
4. Increment the entry number from the last existing entry.
5. If nothing new was learned, do not write anything.
6. Keep entries concise (max 10 lines per entry).
7. Do NOT use `$memory` — write directly to the file.

## Summary File

Write `summary.md` next to `status.json`.

Include:

- what changed
- why it satisfies the acceptance criteria
- what checks ran
- which screenshot(s) to review
- which e2e artifact(s) prove the feature works
- any known caveats
