from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from orchestrator.models.enums import TaskStatus


class OrchestrationState(BaseModel):
    model_config = ConfigDict(extra="allow")

    run_id: str = Field(min_length=1)
    task_id: str = ""
    task_file: str = Field(min_length=1)
    status: TaskStatus = TaskStatus.RECEIVED
    slot_id: str | None = None
    worktree_path: str | None = None
    emulator_serial: str | None = None
    resolved_policy_file: str | None = None
    codex_log_file: str | None = None
    codex_exit_code: int | None = None
    changed_files: list[str] = Field(default_factory=list)
    check_results: dict[str, dict[str, Any]] = Field(default_factory=dict)
    open_question_id: str | None = None
    human_answers: list[str] = Field(default_factory=list)
    codex_attempts: int = 0
    repair_attempts: int = 0
    latest_check_feedback: str | None = None
    codex_summary: str | None = None
    error_message: str | None = None
    started_at: str = Field(min_length=1)
    updated_at: str = Field(min_length=1)
