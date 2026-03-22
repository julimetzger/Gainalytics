from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class RuntimePaths:
    repo_root: Path
    runtime_root: Path
    config_dir: Path
    tasks_inbox_dir: Path
    tasks_processing_dir: Path
    tasks_done_dir: Path
    tasks_failed_dir: Path
    inbox_questions_dir: Path
    inbox_answers_dir: Path
    runs_dir: Path
    results_dir: Path
    logs_dir: Path

    @classmethod
    def discover(cls) -> "RuntimePaths":
        repo_root = Path(__file__).resolve().parents[1]
        runtime_root = repo_root / ".orchestrator"
        return cls(
            repo_root=repo_root,
            runtime_root=runtime_root,
            config_dir=runtime_root / "config",
            tasks_inbox_dir=runtime_root / "tasks" / "inbox",
            tasks_processing_dir=runtime_root / "tasks" / "processing",
            tasks_done_dir=runtime_root / "tasks" / "done",
            tasks_failed_dir=runtime_root / "tasks" / "failed",
            inbox_questions_dir=runtime_root / "inbox" / "questions",
            inbox_answers_dir=runtime_root / "inbox" / "answers",
            runs_dir=runtime_root / "runs",
            results_dir=runtime_root / "results",
            logs_dir=runtime_root / "logs",
        )

    def ensure_runtime_dirs(self) -> None:
        for directory in (
            self.runtime_root,
            self.config_dir,
            self.tasks_inbox_dir,
            self.tasks_processing_dir,
            self.tasks_done_dir,
            self.tasks_failed_dir,
            self.inbox_questions_dir,
            self.inbox_answers_dir,
            self.runs_dir,
            self.results_dir,
            self.logs_dir,
        ):
            directory.mkdir(parents=True, exist_ok=True)
