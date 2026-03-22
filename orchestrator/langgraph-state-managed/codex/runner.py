from __future__ import annotations

import os
import shlex
import subprocess
from dataclasses import dataclass
from pathlib import Path

from orchestrator.codex.parse_outcome import CodexOutcome, parse_codex_outcome
from orchestrator.codex.prompt_builder import build_codex_prompt
from orchestrator.policy.merge import EffectiveTask
from orchestrator.storage.files import read_text_file, write_text_file


@dataclass(frozen=True)
class CodexRunArtifacts:
    command_log: Path
    prompt_file: Path
    output_last_message_file: Path


@dataclass(frozen=True)
class CodexRunResult:
    exit_code: int
    outcome: CodexOutcome
    artifacts: CodexRunArtifacts


def run_codex(
    effective_task: EffectiveTask,
    worktree_path: Path,
    run_logs_dir: Path,
    previous_answers: list[str],
    slot_id: str,
    emulator_serial: str,
    available_checks: list[tuple[str, str]],
    codex_attempt: int,
    check_feedback: str | None,
) -> CodexRunResult:
    prompt = build_codex_prompt(
        effective_task=effective_task,
        worktree_path=str(worktree_path),
        previous_answers=previous_answers,
        slot_id=slot_id,
        emulator_serial=emulator_serial,
        available_checks=available_checks,
        codex_attempt=codex_attempt,
        check_feedback=check_feedback,
    )
    prompt_file = run_logs_dir / "codex-prompt.txt"
    output_file = run_logs_dir / effective_task.policy.codex.output_last_message_file
    command_log = run_logs_dir / "codex-command.log"

    write_text_file(prompt_file, prompt)

    command_template = effective_task.policy.codex.command
    command = command_template.format(
        prompt_file=shlex.quote(str(prompt_file)),
        output_file=shlex.quote(str(output_file)),
        worktree_path=shlex.quote(str(worktree_path)),
        task_id=effective_task.task.task_id,
    )
    env = os.environ.copy()
    env.update(
        {
            "ANDROID_SERIAL": emulator_serial,
            "ORCHESTRATOR_EMULATOR_SERIAL": emulator_serial,
            "ORCHESTRATOR_SLOT_ID": slot_id,
            "ORCHESTRATOR_CODEX_ATTEMPT": str(codex_attempt),
        }
    )

    completed = subprocess.run(
        command,
        cwd=worktree_path,
        env=env,
        shell=True,
        text=True,
        capture_output=True,
        timeout=effective_task.policy.codex.timeout_seconds,
        check=False,
    )

    combined_output = "\n".join(
        [
            "=== STDOUT ===",
            completed.stdout,
            "=== STDERR ===",
            completed.stderr,
        ]
    )
    write_text_file(command_log, combined_output)

    raw_message = completed.stdout
    if output_file.exists():
        raw_message = read_text_file(output_file)

    outcome = parse_codex_outcome(raw_message)

    return CodexRunResult(
        exit_code=completed.returncode,
        outcome=outcome,
        artifacts=CodexRunArtifacts(
            command_log=command_log,
            prompt_file=prompt_file,
            output_last_message_file=output_file,
        ),
    )
