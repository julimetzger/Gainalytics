from __future__ import annotations

from dataclasses import dataclass

from orchestrator.models.policy import ChecksConfig, RuntimePolicy
from orchestrator.models.task import TaskSpec


@dataclass(frozen=True)
class EffectiveTask:
    task: TaskSpec
    checks: ChecksConfig
    policy: RuntimePolicy
