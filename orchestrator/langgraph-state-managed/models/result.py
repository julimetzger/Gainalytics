from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from orchestrator.models.enums import FailureKind, TaskStatus


class CheckCommandResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1)
    command: str = Field(min_length=1)
    exit_code: int
    started_at: str = Field(min_length=1)
    finished_at: str = Field(min_length=1)
    log_file: str = Field(min_length=1)
    failure_kind: FailureKind | None = None


class RunResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    run_id: str = Field(min_length=1)
    task_id: str = Field(min_length=1)
    status: TaskStatus
    summary: str = Field(min_length=1)
    changed_files: list[str]
    checks: list[CheckCommandResult]
    artifacts_dir: str = Field(min_length=1)
