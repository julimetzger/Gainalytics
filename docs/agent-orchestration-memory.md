# Agent Orchestration Memory

This document captures the important operational lessons from getting local
`codex exec` workers, Metro, adb, and Maestro stable in this repository.

Use this as the first reference for future orchestrator and worker fixes instead
of rediscovering the same environment issues.

## Current Working Model

- Start one host-side Metro process per worktree.
- Give each worktree its own host Metro port.
- Reuse that host Metro from the worker instead of starting Metro inside the worker.
- Give each concurrent Maestro session its own driver host port.
- Treat `.codex-orchestrator/runs/<ticket-id>/status.json` as the source of truth for terminal worker results.

## Problems And Working Solutions

### 1. Worker sandbox could not reach adb or localhost services

Problem:
- `codex exec --full-auto` workers in `workspace-write` could not talk to adb, Maestro, or local TCP ports by default.

Symptoms:
- `Operation not permitted`
- adb could see emulators on the host, but the worker could not
- inner worker commands showed `network_access:false`

Working solution:
- Launch workers with:
  - `-c sandbox_workspace_write.network_access=true`
  - `-c shell_environment_policy.inherit=all`
- Keep passing explicit adb and Maestro host settings from the orchestrator environment.

Relevant files:
- [launch_feature_job.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/launch_feature_job.py)

### 2. Metro must run on the host, not inside the worker

Problem:
- Metro started inside the worker sandbox was not a reliable host service for emulator verification.

Symptoms:
- Emulator could launch the app but bundle loading failed or behaved inconsistently.
- Metro from the worker behaved differently from a normal host-side packager.

Working solution:
- Start or reuse Metro on the host for each assigned worktree.
- Pass the host Metro port into the worker.
- Use adb reverse so the emulator sees device port `8081` while each worktree still uses its own host Metro port.
- The worker should reuse provided `E2E_METRO_PORT` and not start another packager.

Relevant files:
- [metro_host.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/metro_host.py)
- [launch_feature_job.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/launch_feature_job.py)
- [run-maestro-from-wsl.sh](/home/jmetzger/projects/PowerliftingWorkoutPlanner/__tests__/e2e/scripts/run-maestro-from-wsl.sh)
- [feature/SKILL.md](/home/jmetzger/.codex/skills/feature/SKILL.md)

### 3. Metro resolver must not force everything through root node_modules

Problem:
- A Metro config that forced package resolution through root `node_modules` broke nested dependency resolution.

Symptoms:
- `react-redux` crashed at runtime
- `Provider` became `undefined`
- wrong `@babel/runtime` helper got bundled

Working solution:
- Do not force `extraNodeModules` or `disableHierarchicalLookup` for this repo.
- Use symlink-friendly Metro config with `unstable_enableSymlinks` and ordered `nodeModulesPaths`.
- Let packages like `react-redux` resolve their nested runtime dependencies correctly.

Relevant files:
- [metro_host.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/metro_host.py)

### 4. Worktrees need shared dependencies

Problem:
- Fresh worker worktrees did not always have usable dependencies on their own.

Symptoms:
- missing Jest binary in a worktree
- module resolution failures inside a fresh worktree

Working solution:
- Ensure each worktree has `node_modules` symlinked to the root repository `node_modules`.
- Ignore the symlink locally so fresh worktrees stay clean.

Relevant files:
- [create_worktree.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/create_worktree.py)
- [metro_host.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/metro_host.py)

### 5. Fresh runs need explicit fresh worktrees

Problem:
- Reusing long-lived ticket worktrees caused drift, stale artifacts, and confusion about what code a worker was actually running.

Symptoms:
- restarted tickets inherited old local state
- old run artifacts and worktree dirt confused review and status reporting

Working solution:
- Recreate ticket worktrees explicitly when a fresh round is required.
- Use:
  - `create_worktree.py --worktree-mode fresh`
  - `create_worktree.py --base-ref <snapshot-ref>`
- If current root fixes must be included, snapshot them first and branch fresh worktrees from that snapshot.
- Normal orchestrator behavior should stay `resume`; fresh should be an explicit opt-in.

Relevant files:
- [create_worktree.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/create_worktree.py)

### 6. Parallel Maestro needs unique driver host ports

Problem:
- Upstream Maestro was flaky when two Android sessions ran in parallel on the same machine.

Symptoms:
- whichever session started second often failed in the driver forwarder
- `dadb.forwarding.TcpForwarder.waitFor`
- failures around driver port `7001`

Working solution:
- Use one unique `--driver-host-port` per concurrent worker.
- Pass that port through the orchestrator and the Maestro wrapper.
- In this environment, the installed Maestro fork with driver-host-port support was materially better than the default behavior.

Relevant files:
- [launch_feature_job.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/launch_feature_job.py)
- [run-maestro-from-wsl.sh](/home/jmetzger/projects/PowerliftingWorkoutPlanner/__tests__/e2e/scripts/run-maestro-from-wsl.sh)

Environment note:
- The live Maestro install was switched to the `2.0.9-ports` fork in the user’s Windows Maestro location, with a backup created beforehand.

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
- [feature/SKILL.md](/home/jmetzger/.codex/skills/feature/SKILL.md)

### 9. Acceptance criteria must be normalized before validation

Problem:
- The review validator previously matched criteria literally, including trailing newlines from ticket files.

Symptoms:
- a bundle could have correct `acceptance_evidence` and still fail validation with “missing acceptance evidence”

Working solution:
- Normalize criteria strings with `.strip()` before matching them in the validator.

Relevant files:
- [validate_review_bundle.py](/home/jmetzger/projects/PowerliftingWorkoutPlanner/orchestrator/codex-skills/orchestrator/scripts/validate_review_bundle.py)

### 10. The repository currently depends on react-dom for this environment

Problem:
- In this setup, `react-redux` resolution and runtime behavior were broken without `react-dom`.

Working solution:
- Keep `react-dom@18.2.0` present in the root dependency set unless the underlying resolution issue is removed in a cleaner way later.

Relevant files:
- [package.json](/home/jmetzger/projects/PowerliftingWorkoutPlanner/package.json)
- [package-lock.json](/home/jmetzger/projects/PowerliftingWorkoutPlanner/package-lock.json)

## Operational Guidance For Future Agents

- Do not spend time re-debugging host-vs-worker Metro. Reuse host Metro.
- Do not assume `state.json` is current if a run directory already has `status.json`.
- Do not classify a feature as broken just because repo-wide `typecheck` or `lint` is red.
- If a run must start clean, use `--worktree-mode fresh` and a known `--base-ref`.
- If concurrent emulator verification behaves strangely, check driver-port assignment before changing ticket code.
- If a worker reports the app works manually but Maestro is flaky, separate app/runtime problems from Maestro driver plumbing before changing the feature.
