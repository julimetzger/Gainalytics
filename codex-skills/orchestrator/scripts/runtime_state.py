#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def detect_repo_root() -> Path:
    completed = subprocess.run(
        ["git", "rev-parse", "--show-toplevel"],
        check=True,
        capture_output=True,
        text=True,
    )
    return Path(completed.stdout.strip()).resolve()


def state_root(repo_root: Path | None = None) -> Path:
    root = repo_root or detect_repo_root()
    return root / ".codex-orchestrator"


def state_file_path(repo_root: Path | None = None) -> Path:
    return state_root(repo_root) / "state.json"


def ensure_runtime_dirs(repo_root: Path | None = None, ticket_id: str | None = None) -> None:
    root = state_root(repo_root)
    (root / "runs").mkdir(parents=True, exist_ok=True)
    if ticket_id:
        run_dir(repo_root, ticket_id).mkdir(parents=True, exist_ok=True)


def run_dir(repo_root: Path | None, ticket_id: str) -> Path:
    return state_root(repo_root) / "runs" / ticket_id


def default_state() -> dict[str, Any]:
    return {
        "version": 1,
        "runs": {},
        "reservations": {},
        "updated_at": utc_now(),
    }


def load_state(path: Path | None = None) -> dict[str, Any]:
    state_path = path or state_file_path()
    if not state_path.exists():
        return default_state()
    with state_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def save_state(state: dict[str, Any], path: Path | None = None) -> Path:
    state_path = path or state_file_path()
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state["updated_at"] = utc_now()
    tmp_path = state_path.with_suffix(".json.tmp")
    with tmp_path.open("w", encoding="utf-8") as handle:
        json.dump(state, handle, indent=2, sort_keys=True)
    tmp_path.replace(state_path)
    return state_path


def ensure_run(state: dict[str, Any], ticket_id: str) -> dict[str, Any]:
    runs = state.setdefault("runs", {})
    if ticket_id not in runs:
        runs[ticket_id] = {
            "status": "queued",
            "review_feedback": [],
            "commit_hashes": [],
            "artifacts": {},
            "started_at": utc_now(),
            "updated_at": utc_now(),
        }
    return runs[ticket_id]


def update_run(state: dict[str, Any], ticket_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    run = ensure_run(state, ticket_id)
    run.update(payload)
    run["updated_at"] = utc_now()
    return run


def reserve_emulator(state: dict[str, Any], ticket_id: str, emulator_serial: str) -> None:
    reservations = state.setdefault("reservations", {})
    reservations[emulator_serial] = {
        "ticket_id": ticket_id,
        "updated_at": utc_now(),
    }


def release_emulator(state: dict[str, Any], emulator_serial: str) -> None:
    state.setdefault("reservations", {}).pop(emulator_serial, None)

