from __future__ import annotations

from pathlib import Path

from orchestrator.models.result import CheckCommandResult
from orchestrator.storage.files import read_text_file


def summarize_check_failure(results: list[CheckCommandResult]) -> str:
    for result in results:
        if result.exit_code != 0:
            return (
                f"Automated check '{result.name}' failed with exit code {result.exit_code}."
            )

    return "Automated checks failed."


def build_check_feedback(results: list[CheckCommandResult], tail_lines: int) -> str:
    if not results:
        return "No automated checks were executed."

    sections: list[str] = []
    for result in results:
        status = "PASS" if result.exit_code == 0 else "FAIL"
        failure_kind = f", failure_kind={result.failure_kind.value}" if result.failure_kind else ""
        header = (
            f"- {result.name}: {status}, exit_code={result.exit_code}{failure_kind}\n"
            f"  command: {result.command}"
        )
        sections.append(header)

        if result.exit_code == 0:
            continue

        try:
            log_content = read_text_file(Path(result.log_file))
        except OSError as exc:
            sections.append(f"  log_tail_unavailable: {exc}")
            continue

        excerpt = _tail_lines(log_content, tail_lines)
        sections.append("  log_tail:")
        sections.append(_indent_block(excerpt or "(empty log)"))

    return "\n".join(sections)


def _tail_lines(content: str, tail_lines: int) -> str:
    lines = content.splitlines()
    if len(lines) <= tail_lines:
        return "\n".join(lines).strip()
    return "\n".join(lines[-tail_lines:]).strip()


def _indent_block(content: str) -> str:
    return "\n".join(f"    {line}" for line in content.splitlines())
