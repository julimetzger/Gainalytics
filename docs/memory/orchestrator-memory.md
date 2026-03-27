# Orchestrator Memory

This document captures operational lessons for the orchestrator — covering worker lifecycle,
review gating, validator behavior, rate-limit handling, and infrastructure plumbing.

Use this as the first reference for future orchestrator fixes instead of rediscovering the
same issues.

## Current Working Model

- Start one host-side Metro process per worktree.
- Give each worktree its own host Metro port.
- Reuse that host Metro from the worker instead of starting Metro inside the worker.
- Give each concurrent Maestro session its own driver host port.
- Treat `.codex-orchestrator/runs/<ticket-id>/status.json` as the source of truth for terminal worker results.

## Problems And Working Solutions

### 7. Use status.json as the terminal truth, not stale state.json

Problem:
- `.codex-orchestrator/state.json` can become stale if workers finish but the orchestrator has not refreshed yet.

Symptoms:
- state still said `running` even though the worker had already written a terminal `status.json`

Working solution:
- Use `runs/<ticket-id>/status.json` as the terminal source of truth.
- Sync terminal `status.json` payloads back into `state.json`.
- Use the monitor script for periodic summaries and stale-state healing.

Relevant files:
- [read_run_status.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/read_run_status.py)
- [monitor_feedback.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/monitor_feedback.py)
- [runtime_state.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/runtime_state.py)

### 8. Review gating should not confuse repo-wide health with ticket quality

Problem:
- Repo-wide `typecheck` and `lint` failures blocked otherwise valid ticket review bundles.

Symptoms:
- a ticket had passing tests, emulator evidence, and correct UI changes, but still landed in `blocked`

Working solution:
- For orchestrated worker review bundles, require:
  - passed relevant automated tests
  - passed emulator/Maestro evidence
  - screenshot evidence
  - acceptance evidence for every criterion
- Keep `typecheck` and `lint` as optional health checks that can still be logged.

Relevant files:
- [launch_feature_job.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/launch_feature_job.py)
- [validate_review_bundle.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/validate_review_bundle.py)
- [feature/SKILL.md](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/feature/SKILL.md)

### 9. Acceptance criteria must be normalized before validation

Problem:
- The review validator previously matched criteria literally, including trailing newlines from ticket files.

Symptoms:
- a bundle could have correct `acceptance_evidence` and still fail validation with "missing acceptance evidence"

Working solution:
- Normalize criteria strings with `.strip()` before matching them in the validator.

Relevant files:
- [validate_review_bundle.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/validate_review_bundle.py)

### 10. Evidence paths in acceptance_evidence must be bare file paths

Problem:
- Agents wrote evidence entries with inline annotations like `"checks/test.log (test: 'foo')"`. The review validator did strict path matching and could not find the file, causing false validation failures.

Symptoms:
- validate_review_bundle.py reported "acceptance criterion lacks concrete screenshot or test evidence" even though the log file existed and the test passed.

Working solution:
- Updated validate_review_bundle.py to strip inline annotations (everything from the first space or parenthesis) before checking if the file exists.
- Updated feature/SKILL.md to explicitly require bare paths in evidence entries.

Relevant files:
- [validate_review_bundle.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/validate_review_bundle.py)
- [feature/SKILL.md](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/feature/SKILL.md)

### 11. SKILL.md frontmatter breaks claude CLI option parsing

Problem:
- The feature SKILL.md starts with YAML frontmatter (---). When the content was passed as the -p argument to claude CLI, the leading --- was interpreted as an unknown CLI option and the worker process exited immediately.

Symptoms:
- worker.stderr.log started with: `error: unknown option '---`
- worker.stdout.log was empty (0 bytes)
- Worker PID died immediately after launch

Working solution:
- Strip YAML frontmatter in load_skill_content() before embedding the skill content in the prompt.
- Pattern: if content starts with ---, find the closing --- and take everything after it.

Relevant files:
- [launch_feature_job.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/launch_feature_job.py)

### 12. Rate-limited workers die silently without writing status.json

Problem:
- When a claude worker hits its API rate limit mid-run, it exits without writing status.json. The orchestrator cannot distinguish this from a crash.

Symptoms:
- worker.stdout.log contains "You've hit your limit · resets 2pm"
- No status.json in run_dir
- read_run_status.py returned status: null with no explanation

Working solution:
- Updated read_run_status.py to detect rate-limit markers in worker logs and return worker_status: "rate_limited" when status.json is absent.
- When this is detected, wait for the limit to reset and relaunch with the same worktree (resume mode).

Relevant files:
- [read_run_status.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/read_run_status.py)

## Operational Guidance For Future Agents

- Do not assume `state.json` is current if a run directory already has `status.json`.
- Do not classify a feature as broken just because repo-wide `typecheck` or `lint` is red.
- If a run must start clean, use `--worktree-mode fresh` and a known `--base-ref`.
- If concurrent emulator verification behaves strangely, check driver-port assignment before changing ticket code.
- If a worker reports the app works manually but Maestro is flaky, separate app/runtime problems from Maestro driver plumbing before changing the feature.
- Before accepting that a validator failure is real, check whether evidence paths contain inline annotations — the agent may have used the correct file with an annotation that broke path matching.
- When a worker dies with no status.json and no obvious error, check worker.stdout.log for rate-limit messages before assuming a code bug.
- When launching claude workers, always strip SKILL.md frontmatter before passing content as a CLI argument.
