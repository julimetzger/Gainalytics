#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import subprocess
from pathlib import Path

from runtime_state import ensure_runtime_dirs, load_state, save_state, state_file_path, update_run


def build_prompt(ticket: dict, worktree_path: Path, branch: str, emulator_serial: str, run_dir: Path) -> str:
    acceptance = "\n".join(f"- {item}" for item in ticket.get("acceptanceCriteria", [])) or "- none"
    constraints = "\n".join(f"- {item}" for item in ticket.get("constraints", [])) or "- none"
    components = "\n".join(f"- {item}" for item in ticket.get("components", [])) or "- none"
    feedback = "\n".join(f"- {item}" for item in ticket.get("review_feedback", [])) or "- none"

    return f"""
Use $feature to implement this ticket in the assigned local worktree.

Ticket:
- id: {ticket["id"]}
- title: {ticket["title"]}
- description: {ticket["description"]}

Acceptance criteria:
{acceptance}

Constraints:
{constraints}

Components:
{components}

Assigned execution context:
- worktree_path: {worktree_path}
- branch: {branch}
- emulator_serial: {emulator_serial}
- run_dir: {run_dir}
- status_json: {run_dir / "status.json"}
- summary_md: {run_dir / "summary.md"}

Environment:
- honor ANDROID_SERIAL={emulator_serial}
- if adb host or socket variables are already present in the environment, keep using them

Prior review feedback:
{feedback}

Write all screenshots and check logs under the run_dir. Before exiting, write status.json and summary.md.
Do not report ready_for_review unless the run directory contains a complete review bundle:
- passed typecheck, test, lint, and e2e or Maestro evidence
- at least one screenshot
- acceptance_evidence entries covering every acceptance criterion
""".strip()


def main() -> None:
    parser = argparse.ArgumentParser(description="Launch one external codex exec feature worker.")
    parser.add_argument("--ticket-file", required=True)
    parser.add_argument("--ticket-id", required=True)
    parser.add_argument("--worktree", required=True)
    parser.add_argument("--branch", required=True)
    parser.add_argument("--emulator-serial", required=True)
    parser.add_argument("--state-file", default=None)
    args = parser.parse_args()

    state_path = Path(args.state_file).resolve() if args.state_file else state_file_path()
    state = load_state(state_path)
    ticket = json.loads(Path(args.ticket_file).read_text(encoding="utf-8"))

    ensure_runtime_dirs(ticket_id=args.ticket_id)
    run_dir = state_path.parent / "runs" / args.ticket_id
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "checks").mkdir(parents=True, exist_ok=True)
    (run_dir / "screenshots").mkdir(parents=True, exist_ok=True)

    worktree_path = Path(args.worktree).resolve()
    prompt = build_prompt(
        ticket=ticket,
        worktree_path=worktree_path,
        branch=args.branch,
        emulator_serial=args.emulator_serial,
        run_dir=run_dir,
    )
    prompt_path = run_dir / "prompt.txt"
    ticket_copy_path = run_dir / "ticket.json"
    stdout_log = run_dir / "worker.stdout.log"
    stderr_log = run_dir / "worker.stderr.log"
    prompt_path.write_text(prompt, encoding="utf-8")
    ticket_copy_path.write_text(json.dumps(ticket, indent=2), encoding="utf-8")

    env = os.environ.copy()
    env["ANDROID_SERIAL"] = args.emulator_serial

    with stdout_log.open("w", encoding="utf-8") as stdout_handle, stderr_log.open(
        "w", encoding="utf-8"
    ) as stderr_handle:
        process = subprocess.Popen(
            [
                "codex",
                "exec",
                "--full-auto",
                "--sandbox",
                "workspace-write",
                "--ask-for-approval",
                "on-request",
                "-C",
                str(worktree_path),
                prompt,
            ],
            stdout=stdout_handle,
            stderr=stderr_handle,
            start_new_session=True,
            env=env,
        )

    update_run(
        state,
        args.ticket_id,
        {
            "status": "running",
            "job_id": process.pid,
            "branch": args.branch,
            "worktree_path": str(worktree_path),
            "emulator_serial": args.emulator_serial,
            "run_dir": str(run_dir),
            "prompt_file": str(prompt_path),
            "ticket_file": str(ticket_copy_path),
            "stdout_log": str(stdout_log),
            "stderr_log": str(stderr_log),
            "ticket": ticket,
        },
    )
    save_state(state, state_path)

    print(
        json.dumps(
            {
                "ticket_id": args.ticket_id,
                "job_id": process.pid,
                "worktree_path": str(worktree_path),
                "run_dir": str(run_dir),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
