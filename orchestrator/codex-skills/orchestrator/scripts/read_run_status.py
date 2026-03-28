#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path


def read_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


RATE_LIMIT_MARKERS = [
    "You've hit your limit",
    "rate limit",
    "Rate limit",
]


def detect_rate_limit(run_dir: Path) -> bool:
    """Return True if the worker stdout log contains a rate-limit message."""
    for log_name in ("worker.stdout.log", "worker.stderr.log"):
        log_path = run_dir / log_name
        if not log_path.exists():
            continue
        try:
            text = log_path.read_text(encoding="utf-8", errors="replace")
            if any(marker in text for marker in RATE_LIMIT_MARKERS):
                return True
        except OSError:
            pass
    return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Read a feature run status directory.")
    parser.add_argument("--run-dir", required=True)
    args = parser.parse_args()

    run_dir = Path(args.run_dir).resolve()
    status_path = run_dir / "status.json"
    summary_path = run_dir / "summary.md"

    payload: dict = {"run_dir": str(run_dir), "status": None, "summary_md": None, "worker_status": None}
    if status_path.exists():
        payload["status"] = read_json(status_path)
    if summary_path.exists():
        payload["summary_md"] = summary_path.read_text(encoding="utf-8")

    if payload["status"] is None and detect_rate_limit(run_dir):
        payload["worker_status"] = "rate_limited"

    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
