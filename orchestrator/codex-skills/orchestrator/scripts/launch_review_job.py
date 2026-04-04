#!/usr/bin/env python3
"""Launch a review worker that checks a feature branch against its GitHub ticket."""
from __future__ import annotations

import argparse
import json
import os
import subprocess
from pathlib import Path

from launch_feature_job import fetch_github_issue, load_skill_content
from runtime_state import (
    detect_repo_root,
    ensure_runtime_dirs,
    load_state,
    save_state,
    state_file_path,
    update_run,
)


def build_review_prompt(
    ticket: dict,
    branch: str,
    worktree_path: Path,
    run_dir: Path,
    skill_preamble: str | None = None,
) -> str:
    acceptance = "\n".join(f"- {item}" for item in ticket.get("acceptanceCriteria", [])) or "- none"
    preamble = skill_preamble or "Review the code changes on this feature branch against the ticket acceptance criteria."

    return f"""
{preamble}

Ticket:
- id: {ticket["id"]}
- title: {ticket["title"]}
- description: {ticket.get("description", "")}
- github_issue_number: {ticket.get("github_issue_number", "unknown")}

Acceptance criteria:
{acceptance}

Review context:
- branch: {branch}
- worktree_path: {worktree_path}
- run_dir: {run_dir}
- Write review.json and review.md to run_dir when done.
- If the ticket has a github_issue_number, post review.md as a comment to the issue.
- Do NOT modify any code. Read-only review.
""".strip()


def main() -> None:
    parser = argparse.ArgumentParser(description="Launch a code review worker.")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--ticket-file", help="Path to local YAML/JSON ticket")
    source.add_argument("--github-issue", type=int, help="GitHub issue number")
    parser.add_argument("--ticket-id", default=None)
    parser.add_argument("--branch", required=True)
    parser.add_argument("--worktree", required=True)
    parser.add_argument("--state-file", default=None)
    parser.add_argument(
        "--runner",
        choices=["codex", "claude"],
        default="claude",
        help="Which AI CLI to use (default: claude).",
    )
    args = parser.parse_args()

    state_path = Path(args.state_file).resolve() if args.state_file else state_file_path()
    state = load_state(state_path)

    if args.ticket_file:
        from launch_feature_job import load_ticket
        ticket = load_ticket(Path(args.ticket_file))
    else:
        ticket = fetch_github_issue(args.github_issue)

    ticket_id = args.ticket_id or ticket.get("id") or f"GH-{args.github_issue}"
    review_id = f"{ticket_id}-review"

    run_dir = state_path.parent / "runs" / review_id
    run_dir.mkdir(parents=True, exist_ok=True)

    worktree_path = Path(args.worktree).resolve()
    repo_root = detect_repo_root()

    skill_preamble = load_skill_content("review") if args.runner == "claude" else None
    prompt = build_review_prompt(
        ticket=ticket,
        branch=args.branch,
        worktree_path=worktree_path,
        run_dir=run_dir,
        skill_preamble=skill_preamble,
    )

    prompt_path = run_dir / "prompt.txt"
    stdout_log = run_dir / "worker.stdout.log"
    stderr_log = run_dir / "worker.stderr.log"
    prompt_path.write_text(prompt, encoding="utf-8")

    env = os.environ.copy()

    if args.runner == "claude":
        cmd = [
            "claude",
            "--model", "sonnet",
            "--allowedTools", "Bash,Read,Glob,Grep",
            "--output-format", "stream-json",
            "--verbose",
            "-p", prompt,
        ]
        popen_kwargs: dict = {"start_new_session": True, "env": env, "cwd": str(worktree_path)}
    else:
        state_root = str(state_path.parent.resolve())
        cmd = [
            "codex",
            "exec",
            "-c", "sandbox_workspace_write.network_access=true",
            "-c", "shell_environment_policy.inherit=all",
            "--full-auto",
            "--add-dir", state_root,
            "-C", str(worktree_path),
            prompt,
        ]
        popen_kwargs = {"start_new_session": True, "env": env}

    with stdout_log.open("w", encoding="utf-8") as stdout_handle, stderr_log.open(
        "w", encoding="utf-8"
    ) as stderr_handle:
        process = subprocess.Popen(
            cmd,
            stdout=stdout_handle,
            stderr=stderr_handle,
            **popen_kwargs,
        )

    update_run(
        state,
        review_id,
        {
            "status": "reviewing",
            "runner": args.runner,
            "worker_pid": process.pid,
            "job_id": process.pid,
            "branch": args.branch,
            "worktree_path": str(worktree_path),
            "run_dir": str(run_dir),
            "ticket_id": ticket_id,
            "github_issue_number": ticket.get("github_issue_number"),
            "ticket": ticket,
        },
    )
    save_state(state, state_path)

    print(
        json.dumps(
            {
                "review_id": review_id,
                "ticket_id": ticket_id,
                "runner": args.runner,
                "worker_pid": process.pid,
                "run_dir": str(run_dir),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
