from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class RunArtifacts:
    run_id: str
    run_dir: Path
    logs_dir: Path
    state_dir: Path


def create_run_artifacts(runs_dir: Path, run_id: str) -> RunArtifacts:
    run_dir = runs_dir / run_id
    logs_dir = run_dir / "logs"
    state_dir = run_dir / "state"
    logs_dir.mkdir(parents=True, exist_ok=True)
    state_dir.mkdir(parents=True, exist_ok=True)
    return RunArtifacts(run_id=run_id, run_dir=run_dir, logs_dir=logs_dir, state_dir=state_dir)
