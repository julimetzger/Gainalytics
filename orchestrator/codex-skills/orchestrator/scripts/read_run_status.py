#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path


def read_json(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def main() -> None:
    parser = argparse.ArgumentParser(description="Read a feature run status directory.")
    parser.add_argument("--run-dir", required=True)
    args = parser.parse_args()

    run_dir = Path(args.run_dir).resolve()
    status_path = run_dir / "status.json"
    summary_path = run_dir / "summary.md"

    payload = {"run_dir": str(run_dir), "status": None, "summary_md": None}
    if status_path.exists():
        payload["status"] = read_json(status_path)
    if summary_path.exists():
        payload["summary_md"] = summary_path.read_text(encoding="utf-8")

    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
