#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path


def detect_repo_root() -> Path:
    completed = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        check=True,
        capture_output=True,
        text=True,
    )
    return Path(completed.stdout.strip()).resolve()


def default_worktrees_root(repo_root: Path) -> Path:
    if repo_root.parent.name == ".worktrees":
        return repo_root.parent
    return repo_root / ".worktrees"


def branch_exists(branch: str) -> bool:
    completed = subprocess.run(
        ["git", "show-ref", "--verify", "--quiet", f"refs/heads/{branch}"],
        check=False,
    )
    return completed.returncode == 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Create or reuse a feature worktree.")
    parser.add_argument("--ticket-id", required=True)
    parser.add_argument("--branch", default=None)
    parser.add_argument("--worktrees-root", default=None)
    args = parser.parse_args()

    repo_root = detect_repo_root()
    branch = args.branch or f"feature/{args.ticket_id}"
    worktrees_root = Path(args.worktrees_root).resolve() if args.worktrees_root else default_worktrees_root(repo_root)
    worktrees_root.mkdir(parents=True, exist_ok=True)
    worktree_path = (worktrees_root / f"feature-{args.ticket_id}").resolve()

    if not worktree_path.exists():
        if branch_exists(branch):
            subprocess.run(["git", "worktree", "add", str(worktree_path), branch], check=True)
        else:
            subprocess.run(["git", "worktree", "add", "-b", branch, str(worktree_path), "HEAD"], check=True)

    print(
        json.dumps(
            {
                "ticket_id": args.ticket_id,
                "branch": branch,
                "worktree_path": str(worktree_path),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
