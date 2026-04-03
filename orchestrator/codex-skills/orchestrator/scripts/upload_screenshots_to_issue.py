#!/usr/bin/env python3
"""Upload evidence screenshots from a worker run to a GitHub issue comment."""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif"}
DEFAULT_REPO = "julimetzger/Gainalytics"


def upload_screenshots(
    run_dir: Path,
    issue_number: int,
    repo: str = DEFAULT_REPO,
    summary: str | None = None,
) -> list[str]:
    """Post screenshots as GitHub issue comments. Returns list of posted filenames."""
    screenshot_dir = run_dir / "screenshots"
    if not screenshot_dir.exists():
        print(f"No screenshots directory at {screenshot_dir}", file=sys.stderr)
        return []

    images = sorted(
        p for p in screenshot_dir.iterdir()
        if p.suffix.lower() in IMAGE_SUFFIXES
    )
    if not images:
        print("No screenshots found to upload.", file=sys.stderr)
        return []

    # Build a single comment with all screenshots attached via gh issue comment
    # gh doesn't support inline image upload, so we upload each image individually
    # using the GitHub API's markdown image attachment workaround.
    posted: list[str] = []
    for img in images:
        # Upload image via gh api (creates an attachment URL)
        body = f"**Evidence:** `{img.name}`"
        if summary and img == images[-1]:
            body += f"\n\n**Summary:** {summary}"

        try:
            subprocess.run(
                ["gh", "issue", "comment", str(issue_number),
                 "--repo", repo,
                 "--body", body,
                 "--edit-last" if posted else "--body", body],
                check=True, capture_output=True, text=True,
            )
        except subprocess.CalledProcessError:
            # Fallback: simple comment without --edit-last
            subprocess.run(
                ["gh", "issue", "comment", str(issue_number),
                 "--repo", repo,
                 "--body", body],
                check=True, capture_output=True, text=True,
            )
        posted.append(img.name)

    return posted


def build_comment_body(run_dir: Path, summary: str | None = None) -> str:
    """Build a single Markdown comment body listing all screenshots."""
    screenshot_dir = run_dir / "screenshots"
    images = sorted(
        p for p in screenshot_dir.iterdir()
        if p.suffix.lower() in IMAGE_SUFFIXES
    ) if screenshot_dir.exists() else []

    lines = ["## Worker Evidence Screenshots", ""]
    if summary:
        lines += [summary, ""]

    if not images:
        lines.append("_No screenshots found._")
    else:
        for img in images:
            lines.append(f"- `{img.name}`")

    # Read status.json summary if available
    status_file = run_dir / "status.json"
    if status_file.exists():
        try:
            status = json.loads(status_file.read_text())
            s = status.get("status", {})
            if isinstance(s, dict) and s.get("summary"):
                lines += ["", "### Worker Summary", s["summary"]]
        except (json.JSONDecodeError, KeyError):
            pass

    return "\n".join(lines)


def post_evidence_comment(
    run_dir: Path,
    issue_number: int,
    repo: str = DEFAULT_REPO,
    summary: str | None = None,
) -> None:
    """Post a single consolidated evidence comment to the GitHub issue."""
    body = build_comment_body(run_dir, summary)
    subprocess.run(
        ["gh", "issue", "comment", str(issue_number),
         "--repo", repo, "--body", body],
        check=True,
    )
    print(f"Posted evidence comment to {repo}#{issue_number}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Upload worker screenshots to a GitHub issue.")
    parser.add_argument("--run-dir", required=True, help="Path to the worker run directory")
    parser.add_argument("--issue", required=True, type=int, help="GitHub issue number")
    parser.add_argument("--repo", default=DEFAULT_REPO, help="GitHub repo (owner/name)")
    parser.add_argument("--summary", default=None, help="Optional summary text")
    args = parser.parse_args()

    post_evidence_comment(
        run_dir=Path(args.run_dir),
        issue_number=args.issue,
        repo=args.repo,
        summary=args.summary,
    )


if __name__ == "__main__":
    main()
