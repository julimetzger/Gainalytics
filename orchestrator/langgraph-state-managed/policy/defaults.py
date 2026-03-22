from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from orchestrator.models.policy import ChecksConfig, RuntimePolicy
from orchestrator.storage.files import read_yaml_file


@dataclass(frozen=True)
class LoadedDefaults:
    checks: ChecksConfig
    policy: RuntimePolicy


class DefaultsLoader:
    def __init__(self, config_dir: Path) -> None:
        self._config_dir = config_dir

    def load(self) -> LoadedDefaults:
        checks = ChecksConfig.model_validate(read_yaml_file(self._config_dir / "checks.yaml"))
        policy = RuntimePolicy.model_validate(read_yaml_file(self._config_dir / "policy.yaml"))
        return LoadedDefaults(checks=checks, policy=policy)
