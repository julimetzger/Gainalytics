from __future__ import annotations

from datetime import datetime, timezone

from orchestrator.models.enums import TaskStatus

_ALLOWED_TRANSITIONS: dict[TaskStatus, set[TaskStatus]] = {
    TaskStatus.RECEIVED: {TaskStatus.VALIDATED, TaskStatus.FAILED_VALIDATION},
    TaskStatus.VALIDATED: {TaskStatus.ASSIGNED, TaskStatus.FAILED_ENV},
    TaskStatus.ASSIGNED: {TaskStatus.RUNNING_CODEX, TaskStatus.FAILED_ENV},
    TaskStatus.RUNNING_CODEX: {
        TaskStatus.WAITING_HUMAN,
        TaskStatus.RUNNING_CHECKS,
        TaskStatus.FAILED_CODE,
        TaskStatus.FAILED_ENV,
    },
    TaskStatus.WAITING_HUMAN: {TaskStatus.RUNNING_CODEX, TaskStatus.FAILED_ENV, TaskStatus.CANCELLED},
    TaskStatus.RUNNING_CHECKS: {
        TaskStatus.RUNNING_CODEX,
        TaskStatus.SUCCEEDED,
        TaskStatus.FAILED_CODE,
        TaskStatus.FAILED_ENV,
    },
    TaskStatus.SUCCEEDED: set(),
    TaskStatus.FAILED_CODE: set(),
    TaskStatus.FAILED_ENV: set(),
    TaskStatus.FAILED_VALIDATION: set(),
    TaskStatus.CANCELLED: set(),
}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def next_status(current: TaskStatus, new_status: TaskStatus) -> TaskStatus:
    if new_status == current:
        return current
    if new_status not in _ALLOWED_TRANSITIONS[current]:
        raise ValueError(f"Illegal transition {current.value} -> {new_status.value}")
    return new_status
