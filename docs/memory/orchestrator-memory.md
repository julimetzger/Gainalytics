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

### 13. Restarted runs can have a live worker and a stale terminal status.json at the same time

Problem:
- The orchestrator reuses the same `run_dir` when a ticket is restarted.
- If the previous round already wrote `status.json`, that file stays in place until the new round exits.

Symptoms:
- `.codex-orchestrator/state.json` says `running`
- the worker PID is alive and `worker.stderr.log` keeps changing
- `runs/<ticket-id>/status.json` still says `blocked` or `ready_for_review` from the previous round

Working solution:
- Treat `status.json` as the terminal truth for the previous completed round, not automatically for the currently running restarted round.
- When a ticket has been relaunched, check all three before reporting status:
  - current worker process still exists
  - `worker.stderr.log` or fresh check artifacts are still updating
  - `status.json` timestamp predates the new worker activity
- Operationally, report this as "old terminal status is stale; new round is live".

Relevant files:
- [launch_feature_job.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/launch_feature_job.py)
- [read_run_status.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/read_run_status.py)

### 14. Review feedback written into state.json is not delivered live to an already-running worker

Problem:
- Appending `review_feedback` in `.codex-orchestrator/state.json` does not update the prompt of a worker that is already running.

Symptoms:
- state contains the new feedback
- the live worker behavior does not change
- the feedback only appears after a restart or a new worker round

Working solution:
- Treat feedback as next-round input.
- If the user needs the worker to react to that feedback immediately, restart the ticket in the same worktree and on the same device.

Relevant files:
- [launch_feature_job.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/launch_feature_job.py)
- [runtime_state.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/runtime_state.py)

### 15. Restarting a worker does not resume the old Codex conversation

Problem:
- A restarted ticket launches a new external `codex exec` process instead of reconnecting to the previous session.

Symptoms:
- a new job id appears for the same ticket
- the old session context is not conversationally resumed
- `worker.stdout.log` and `worker.stderr.log` are reopened and overwritten for the new round

Working solution:
- Describe restarts as "new worker round in the same worktree", not as session resume.
- Preserve context through:
  - the existing worktree
  - the run directory artifacts
  - `review_feedback`
- Do not promise live session continuity to the user.

Relevant files:
- [launch_feature_job.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/launch_feature_job.py)

### 16. Validator requires exact backtick-matching in acceptance criteria text

Problem:
- The validate_review_bundle.py validator matches acceptance criteria strings literally. Workers often strip backticks (e.g. `repSegments` → repSegments) which causes false "missing acceptance evidence" failures.

Symptoms:
- Validator reports "missing acceptance evidence for criterion" even though the worker wrote matching evidence entries
- The criterion text in status.json differs only by missing backticks

Working solution:
- Orchestrator manually fixes backticks in status.json when the only mismatch is formatting.
- Long-term: normalize both sides (strip backticks) before matching in the validator.

Relevant files:
- [validate_review_bundle.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/validate_review_bundle.py)

### 17. Validator requires specific check names: `test` and a name containing `maestro`/`e2e`/`smoke`

Problem:
- Workers name their checks freely (e.g. `jest-focused`, `emulator-state-export-proof`) but the validator requires exactly `test` and a check name containing `maestro`, `e2e`, or `smoke`.

Symptoms:
- Validator reports "missing required check: test" or "missing e2e or maestro check" even though equivalent checks passed

Working solution:
- Orchestrator renames checks in status.json to match validator expectations.
- Workers should be instructed to use `test` for Jest and include `maestro`/`e2e` in e2e check names.

Relevant files:
- [validate_review_bundle.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/validate_review_bundle.py)

### 18. Workers crash from `pkill -f maestro` killing their own process

Problem:
- Worker prompts contain the word "maestro" multiple times. When a worker runs `pkill -f maestro`, it matches its own claude process and kills itself.

Symptoms:
- Worker exits with code 144 (signal 16) immediately after running pkill
- worker.stdout.log shows the pkill command as the last action
- status.json is never written

Working solution:
- Never use `pkill -f maestro` in worker feedback. Use a more specific pattern: `ps aux | grep maestro | grep java | grep -v grep | awk '{print $2}' | xargs kill 2>/dev/null || true`

Relevant files:
- [launch_feature_job.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/launch_feature_job.py)

### 19. Workers crash from screenshot dimension limit (>2000px)

Problem:
- Claude's multi-image context has a 2000px dimension limit. Emulator screenshots are typically larger and crash the worker when read.

Symptoms:
- Worker result: "An image in the conversation exceeds the dimension limit for many-image requests (2000px)"
- status.json is never updated
- Worker exits without completing

Working solution:
- Instruct workers to resize all screenshots immediately after capture: `convert file.png -resize 800x800\> file.png`
- Or capture with inline resize: `adb exec-out screencap -p | convert - -resize 800x800\> file.png`

### 20. `$memory` skill call does not work in non-interactive `claude -p` mode

Problem:
- The feature SKILL.md instructed workers to run `$memory` at the end of their run, but skill invocations are not available in `claude -p` (prompt) mode.

Symptoms:
- Workers never write to `docs/memory/agent-memory.md`
- No error — the instruction is simply ignored

Working solution:
- Replaced `$memory` skill reference with direct instructions to read and append to `docs/memory/agent-memory.md` in the feature SKILL.md.

Relevant files:
- [feature/SKILL.md](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/feature/SKILL.md)

### 21. Fix-Tickets für PRs müssen auf dem PR-Branch arbeiten, nicht auf master

Problem:
- Ein Fix-Ticket (z.B. ANA-005-fix) wurde auf einem frischen Branch von master erstellt. Der Fix-Agent implementierte die Änderungen von Grund auf, statt sie auf dem bestehenden PR-Branch aufzubauen. Cherry-pick/Merge auf den PR-Branch hatte massive Konflikte.

Symptoms:
- Cherry-pick zeigt Konflikte in fast allen Dateien
- Der Fix-Branch hat die gleichen Dateien nochmal von Grund auf geändert

Working solution:
- Fix-Worker immer direkt auf dem bestehenden PR-Branch/Worktree starten, nicht auf einem frischen Branch von master.
- `launch_feature_job.py` mit `--worktree <PR-worktree> --branch <PR-branch>` aufrufen.
- Ticket-File per absolutem Pfad übergeben, da es im älteren Worktree nicht existiert.

### 22. launch_feature_job.py muss vom Hauptrepo ausgeführt werden

Problem:
- `launch_feature_job.py` im Worktree-Kontext ausgeführt versucht verschachtelte Worktree-Pfade zu erstellen und scheitert mit FileNotFoundError.

Symptoms:
- `FileNotFoundError: '../../../../node_modules' -> '.worktrees/feature-X/.worktrees/feature-X/node_modules'`

Working solution:
- Immer `python3 /absolute/path/to/launch_feature_job.py` vom Hauptrepo-Root ausführen, nicht vom Worktree.
- Ticket-Files ebenfalls per absolutem Pfad übergeben.

### 23. Deploy auf echtes Gerät: Metro Worktree-Config mit unstable_enableSymlinks nötig

Problem:
- Debug-Builds laden JS von Metro. Metro ohne Worktree-Config scheitert an Symlinks im Worktree mit SHA-1 Fehlern.

Symptoms:
- Red screen: "Metro has encountered an error: SHA-1 for file ... is not computed"
- "You have symlinks in your project - watchman does not follow symlinks"

Working solution:
- Metro mit der Worktree-Config starten: `--config .codex-orchestrator/runs/<ticket>/metro.worktree.config.cjs`
- Diese Config setzt `unstable_enableSymlinks: true` und korrekte `projectRoot`/`watchFolders`.
- Alternativ: Einen Feature-Worker-Agent starten der die App-Deployment-Skills kennt.

## Operational Guidance For Future Agents

- Do not assume `state.json` is current if a run directory already has `status.json`.
- Do not classify a feature as broken just because repo-wide `typecheck` or `lint` is red.
- If a run must start clean, use `--worktree-mode fresh` and a known `--base-ref`.
- If concurrent emulator verification behaves strangely, check driver-port assignment before changing ticket code.
- If a worker reports the app works manually but Maestro is flaky, separate app/runtime problems from Maestro driver plumbing before changing the feature.
- Before accepting that a validator failure is real, check whether evidence paths contain inline annotations — the agent may have used the correct file with an annotation that broke path matching.
- When a worker dies with no status.json and no obvious error, check worker.stdout.log for rate-limit messages before assuming a code bug.
- When launching claude workers, always strip SKILL.md frontmatter before passing content as a CLI argument.
- After a ticket restart, do not report the old `status.json` without checking whether a new worker round is already live in the same `run_dir`.
- Feedback added in `state.json` is next-round context only; it does not hot-reload into a running worker.
- A worker restart reuses filesystem context, not the same Codex session.
- When validator reports missing criteria evidence, first check for backtick mismatches before relaunching workers.
- Worker check names must be exactly `test` for Jest and contain `maestro`/`e2e`/`smoke` for e2e checks.
- Never include `pkill -f maestro` in worker feedback — it kills the worker itself. Use `grep java` to target actual Maestro processes.
- Always instruct workers to resize screenshots to max 800x800 before reading them (2000px context limit).
- `$memory` and other skill calls do not work in `claude -p` mode — embed instructions directly in the prompt.
- Fix-Tickets für bestehende PRs: Worker direkt auf dem PR-Branch/Worktree starten, nicht auf frischem master-Branch.
- `launch_feature_job.py` immer vom Hauptrepo-Root ausführen, nicht vom Worktree. Ticket-Files per absolutem Pfad.
- Für App-Deploy auf echtem Gerät: Metro mit Worktree-Config starten oder den Feature-Agent deployen lassen.
- Codex-Review-Anmerkungen pro PR in ein einzelnes Ticket konsolidieren, nicht ein Ticket pro Anmerkung.
