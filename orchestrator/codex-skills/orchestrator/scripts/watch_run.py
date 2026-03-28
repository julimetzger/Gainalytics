#!/usr/bin/env python3
"""Pretty-print a claude --output-format stream-json worker log in real time.

Usage:
    # Follow a live run:
    python scripts/watch_run.py --run-dir .codex-orchestrator/runs/ANA-002

    # Replay a finished log:
    python scripts/watch_run.py --run-dir .codex-orchestrator/runs/ANA-002 --no-follow
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path


RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"
CYAN = "\033[36m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
RED = "\033[31m"
MAGENTA = "\033[35m"


def color(text: str, code: str) -> str:
    return f"{code}{text}{RESET}"


def format_event(event: dict) -> str | None:
    etype = event.get("type", "")

    if etype == "text":
        text = event.get("text", "").rstrip()
        if text:
            return color("[TEXT] ", CYAN) + text

    elif etype == "tool_use":
        name = event.get("name", "?")
        inp = event.get("input", {})
        if name == "Bash":
            cmd = inp.get("command", "")[:200]
            return color(f"[BASH] ", GREEN) + color(cmd, BOLD)
        desc = inp.get("description", "") or inp.get("file_path", "") or str(inp)[:120]
        return color(f"[{name.upper()}] ", GREEN) + color(desc, BOLD)

    elif etype == "tool_result":
        content = event.get("content", "")
        if isinstance(content, list):
            content = " ".join(c.get("text", "") for c in content if isinstance(c, dict))
        snippet = str(content).strip().replace("\n", " ")[:200]
        if snippet:
            return color("[RESULT] ", YELLOW) + snippet

    elif etype == "error":
        msg = event.get("error", {}).get("message", str(event))
        return color(f"[ERROR] {msg}", RED)

    elif etype in ("message_start", "message_stop", "message_delta"):
        usage = event.get("usage") or (event.get("message") or {}).get("usage")
        if usage:
            inp_tok = usage.get("input_tokens", "?")
            out_tok = usage.get("output_tokens", "?")
            return color(f"[USAGE] input={inp_tok} output={out_tok}", DIM)
        return None

    return None


def tail_file(path: Path, follow: bool) -> None:
    with path.open("r", encoding="utf-8", errors="replace") as fh:
        while True:
            line = fh.readline()
            if not line:
                if not follow:
                    break
                time.sleep(0.3)
                continue
            line = line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
                formatted = format_event(event)
                if formatted:
                    print(formatted, flush=True)
            except json.JSONDecodeError:
                # Non-JSON line (e.g. rate-limit message) — print as-is
                print(color(f"[RAW] {line}", MAGENTA), flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Watch a claude stream-json worker log.")
    parser.add_argument("--run-dir", required=True, help="Path to the run directory")
    parser.add_argument("--no-follow", action="store_true", help="Replay log without following")
    args = parser.parse_args()

    run_dir = Path(args.run_dir).resolve()
    log_path = run_dir / "worker.stdout.log"

    if not log_path.exists():
        print(f"Log not found: {log_path}", file=sys.stderr)
        sys.exit(1)

    follow = not args.no_follow
    print(color(f"Watching {log_path}" + (" (live)" if follow else " (replay)"), DIM))
    print(color("-" * 60, DIM))

    try:
        tail_file(log_path, follow=follow)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
