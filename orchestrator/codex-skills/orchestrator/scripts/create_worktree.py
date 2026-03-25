#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

from metro_host import ensure_worktree_node_modules


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


def remove_worktree_if_exists(worktree_path: Path) -> None:
    if not worktree_path.exists():
        return
    subprocess.run(["git", "worktree", "remove", "--force", str(worktree_path)], check=True)


def resolve_worktree_mode(worktree_mode: str, fresh_flag: bool) -> str:
    if fresh_flag:
        return "fresh"
    return worktree_mode


def main() -> None:
    parser = argparse.ArgumentParser(description="Create or reuse a feature worktree.")
    parser.add_argument("--ticket-id", required=True)
    parser.add_argument("--branch", default=None)
    parser.add_argument("--worktrees-root", default=None)
    parser.add_argument("--base-ref", default="HEAD")
    parser.add_argument("--worktree-mode", choices=("resume", "fresh"), default="resume")
    parser.add_argument("--fresh", action="store_true", help="Deprecated alias for --worktree-mode fresh.")
    args = parser.parse_args()

    repo_root = detect_repo_root()
    branch = args.branch or f"feature/{args.ticket_id}"
    worktrees_root = Path(args.worktrees_root).resolve() if args.worktrees_root else default_worktrees_root(repo_root)
    worktrees_root.mkdir(parents=True, exist_ok=True)
    worktree_path = (worktrees_root / f"feature-{args.ticket_id}").resolve()
    worktree_mode = resolve_worktree_mode(args.worktree_mode, args.fresh)
    fresh = worktree_mode == "fresh"

    if fresh:
        remove_worktree_if_exists(worktree_path)
        if branch_exists(branch):
            subprocess.run(["git", "branch", "-f", branch, args.base_ref], check=True)

    if not worktree_path.exists():
        if branch_exists(branch):
            subprocess.run(["git", "worktree", "add", str(worktree_path), branch], check=True)
        else:
            subprocess.run(["git", "worktree", "add", "-b", branch, str(worktree_path), args.base_ref], check=True)

    ensure_worktree_node_modules(worktree_path, repo_root)

    print(
        json.dumps(
            {
                "ticket_id": args.ticket_id,
                "branch": branch,
                "base_ref": args.base_ref,
                "worktree_mode": worktree_mode,
                "fresh": fresh,
                "worktree_path": str(worktree_path),
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
