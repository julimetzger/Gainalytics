#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from runtime_state import load_state, save_state, update_run, state_file_path


def parse_json_payload(raw: str | None) -> dict:
    if not raw:
        return {}
    return json.loads(raw)


def main() -> None:
    parser = argparse.ArgumentParser(description="Patch one ticket entry in orchestrator state.")
    parser.add_argument("--ticket-id", required=True)
    parser.add_argument("--state-file", default=None)
    parser.add_argument("--payload", default="{}")
    args = parser.parse_args()

    state_path = Path(args.state_file).resolve() if args.state_file else state_file_path()
    state = load_state(state_path)
    run = update_run(state, args.ticket_id, parse_json_payload(args.payload))
    save_state(state, state_path)
    print(json.dumps(run, indent=2))


if __name__ == "__main__":
    main()
