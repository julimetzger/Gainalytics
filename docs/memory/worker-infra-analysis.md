# Worker Infrastructure Time Analysis

This document tracks how much time workers spend on infrastructure vs. feature work,
which problems recur, and which workers are affected. Use this to identify systemic
issues and prevent agents from re-discovering known solutions.

Last updated: 2026-04-02

## Per-Worker Breakdown

| Ticket | Driver-Port | gRPC Crash | Wrong Device | ADB Reverse | Metro | Red Screen | Build | Screenshot | Feedback Rounds | Final Status |
|--------|-------------|------------|-------------|-------------|-------|------------|-------|------------|----------------|-------------|
| ANA-001 | 34 | 0 | 7 | 15 | 4 | 14 | 16 | 0 | 10 | closed |
| ANA-002 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 4 | closed |
| ANA-003 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 7 | closed |
| ANA-003-fix | 3 | 0 | 0 | 2 | 0 | 0 | 2 | 0 | 4 | review |
| ANA-004 | 35 | 24 | 6 | 8 | 4 | 47 | 48 | 1 | 5 | review |
| ANA-005 | 9 | 4 | 0 | 2 | 1 | 43 | 16 | 6 | 0 | review |
| TRN-002 | 6 | 0 | 2 | 2 | 2 | 14 | 3 | 12 | 6 | review |
| TRN-003 | 24 | 6 | 4 | 16 | 8 | 24 | 10 | 0 | 0 | review |
| ANA-001-fix | 10 | 7 | 4 | 22 | 23 | 27 | 16 | 2 | 0 | review |
| ANA-004-fix | 8 | 8 | 2 | 5 | 7 | 21 | 13 | 0 | 0 | review |
| ANA-005-fix | 13 | 1 | 3 | 6 | 2 | 4 | 6 | 0 | 0 | review |
| ANA-003-fix2 | 2 | 15 | 0 | 0 | 0 | 0 | 0 | 12 | 8 | ready_for_review (r8) |

Numbers = log line counts mentioning that problem category. Higher = more time wasted.

## Key Findings

### 1. Every worker with emulator verification hits infra issues

ANA-002 is the only worker with zero infra problems — it was a pure logic/UI fix
with no Maestro or emulator interaction. Every other worker spent significant time
on infrastructure.

### 2. Top time sinks (by frequency across workers)

1. **Maestro driver port conflicts** — affects 9/10 workers. Agents spend time
   killing stale Maestro processes, trying different ports, debugging
   `TcpForwarder` errors. The orchestrator assigns ports but agents still fight
   with stale processes from previous runs.

2. **Red screen / app not loading** — affects 8/10 workers. Metro bundle errors,
   app crashes on fresh state, or video analysis overloading the app at startup.
   Agents cycle through reload attempts before finding the actual cause.

3. **Build issues** — affects 8/10 workers. Often `JAVA_TOOL_OPTIONS` leak from
   Maestro setup breaking Gradle, or agents running unnecessary rebuilds.

4. **gRPC DEADLINE_EXCEEDED** — affects 6/10 workers. Maestro driver times out
   on `viewHierarchy` calls, especially with video analysis (CPU-intensive) or
   when `clearState:true` triggers a heavy app restart.

5. **Wrong device targeting** — affects 7/10 workers. Maestro connects to a
   different device than assigned. Happens when stale drivers from other workers
   are still bound to the wrong device.

6. **ADB reverse setup** — affects 8/10 workers. WSL→Windows→Emulator port
   forwarding chain is fragile. Agents spend time debugging why Metro is
   unreachable from the emulator.

### 3. Infra problems cause cascading time loss

A single Maestro driver-port conflict leads to: debug port → kill stale process →
retry Maestro → wrong device attached → re-debug → finally works (or doesn't).
This cascade can consume 30+ agent turns.

### 4. Workers without Maestro verification finish faster

ANA-002 (pure logic fix) and TRN-003 (simple guard addition) had the least infra
overhead. The more device interaction a ticket needs, the more time is lost to
infrastructure.

## What's Already Covered in agent-memory.md

The following infra patterns are already documented in `docs/memory/agent-memory.md`:
- Entry #1: Worker sandbox network access
- Entry #2: Metro must run on host
- Entry #6: Parallel Maestro needs unique driver ports
- Entry #10: Real-device failures can be app bootstrap crashes
- Entry #14: clearState:true + CPU-intensive work = gRPC crash

## Gaps — Not Yet Solved

1. ~~**No automated Maestro cleanup between runs.**~~ **FIXED** (2026-03-30):
   `cleanup_stale_maestro()` in `launch_feature_job.py` kills stale Maestro Java
   processes for the assigned device/port before each worker launch.

2. **No Metro health verification before worker starts.** Workers discover
   Metro is unreachable mid-run and spend time debugging. The launch script
   should verify Metro is reachable from the device before handing off.

3. **JAVA_TOOL_OPTIONS pollutes Gradle.** Maestro setup sets a custom
   `-Duser.home` that breaks subsequent Gradle builds. Workers should unset
   `JAVA_TOOL_OPTIONS` before Gradle or the orchestrator should isolate it.

4. **No preflight device check.** Workers discover the wrong device is attached
   to a stale Maestro session mid-flow. A preflight `adb devices` + Maestro
   driver health check would catch this early.

5. **Agents re-derive WSL/adb/Metro setup.** Despite `__tests__/e2e/README.md`
   and agent-memory.md, agents still try to figure out the networking setup
   from scratch. The feature SKILL.md should include a concrete "Emulator
   Preflight Checklist" with exact commands.
