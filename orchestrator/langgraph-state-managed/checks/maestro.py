from __future__ import annotations

from orchestrator.models.policy import E2ECheck


def resolve_maestro_command(check: E2ECheck, emulator_serial: str) -> str:
    return check.command.format(
        emulator_serial=emulator_serial,
        flow_path=check.flow_path,
    )
