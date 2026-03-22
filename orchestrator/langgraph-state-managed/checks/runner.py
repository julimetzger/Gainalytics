from __future__ import annotations

import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from orchestrator.checks.classify import classify_failure
from orchestrator.checks.maestro import resolve_maestro_command
from orchestrator.models.enums import FailureKind
from orchestrator.models.policy import ChecksConfig
from orchestrator.models.result import CheckCommandResult
from orchestrator.storage.files import write_text_file


@dataclass(frozen=True)
class ChecksRunResult:
    results: list[CheckCommandResult]
    final_status: str


@dataclass(frozen=True)
class PlannedCheckCommand:
    name: str
    command: str


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def build_check_plan(checks: ChecksConfig, emulator_serial: str) -> list[PlannedCheckCommand]:
    return [
        PlannedCheckCommand(name="lint", command=checks.lint.command),
        PlannedCheckCommand(name="typecheck", command=checks.typecheck.command),
        PlannedCheckCommand(name="tests", command=checks.tests.command),
        PlannedCheckCommand(
            name="e2e",
            command=resolve_maestro_command(checks.e2e, emulator_serial),
        ),
    ]


def _run_command(name: str, command: str, cwd: Path, log_file: Path) -> CheckCommandResult:
    started_at = _utc_now()
    completed = subprocess.run(
        command,
        shell=True,
        cwd=cwd,
        text=True,
        capture_output=True,
        check=False,
    )
    finished_at = _utc_now()
    output = "\n".join(
        [
            f"$ {command}",
            "=== STDOUT ===",
            completed.stdout,
            "=== STDERR ===",
            completed.stderr,
        ]
    )
    write_text_file(log_file, output)

    failure_kind: FailureKind | None = None
    if completed.returncode != 0:
        failure_kind = classify_failure(name, output)

    return CheckCommandResult(
        name=name,
        command=command,
        exit_code=completed.returncode,
        started_at=started_at,
        finished_at=finished_at,
        log_file=str(log_file),
        failure_kind=failure_kind,
    )


def run_required_checks(
    checks: ChecksConfig,
    worktree_path: Path,
    emulator_serial: str,
    logs_dir: Path,
) -> ChecksRunResult:
    plan = build_check_plan(checks=checks, emulator_serial=emulator_serial)

    results: list[CheckCommandResult] = []
    for index, planned_check in enumerate(plan, start=1):
        log_file = logs_dir / f"check-{index:02d}-{planned_check.name}.log"
        result = _run_command(
            name=planned_check.name,
            command=planned_check.command,
            cwd=worktree_path,
            log_file=log_file,
        )
        results.append(result)
        if result.exit_code != 0:
            if result.failure_kind == FailureKind.ENV:
                return ChecksRunResult(results=results, final_status="FAILED_ENV")
            return ChecksRunResult(results=results, final_status="FAILED_CODE")

    return ChecksRunResult(results=results, final_status="SUCCEEDED")
