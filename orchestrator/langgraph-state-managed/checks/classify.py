from __future__ import annotations

from orchestrator.models.enums import FailureKind

_ENV_PATTERNS = (
    "not found",
    "command not found",
    "enoent",
    "no such file or directory",
    "device offline",
    "no devices/emulators found",
    "more than one device/emulator",
    "more than one device",
    "failed to install",
    "is not installed for",
    "cannot find adb",
    "unable to locate adb",
    "adb",
    "failed to connect",
    "timeout",
    "timed out",
    "permission denied",
)


def classify_failure(command_name: str, output: str) -> FailureKind:
    lowered = output.lower()
    if any(pattern in lowered for pattern in _ENV_PATTERNS):
        return FailureKind.ENV

    if command_name == "e2e" and "emulator" in lowered:
        return FailureKind.ENV

    return FailureKind.CODE
