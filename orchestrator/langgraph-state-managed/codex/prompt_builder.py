from __future__ import annotations

from orchestrator.policy.merge import EffectiveTask


def build_codex_prompt(
    effective_task: EffectiveTask,
    worktree_path: str,
    previous_answers: list[str],
    slot_id: str,
    emulator_serial: str,
    available_checks: list[tuple[str, str]],
    codex_attempt: int,
    check_feedback: str | None,
) -> str:
    business_req_lines = "\n".join(
        f"- {item.id}: {item.text}" for item in effective_task.task.business_requirements
    )
    acceptance_lines = "\n".join(
        f"- {item.id}: {item.text}" for item in effective_task.task.acceptance_criteria
    )
    answers_block = "\n".join(f"- {answer}" for answer in previous_answers) or "- none"
    checks_block = "\n".join(f"- {name}: {command}" for name, command in available_checks) or "- none"
    feedback_block = check_feedback or "- none"

    return f"""
You are Codex running under orchestration for Gainalytics.

Task ID: {effective_task.task.task_id}
Codex attempt: {codex_attempt}
Title: {effective_task.task.title}
Description:
{effective_task.task.description}

Business requirements:
{business_req_lines}

Acceptance criteria:
{acceptance_lines}

Previous human answers:
{answers_block}

Assigned runtime context:
- You can modify any files in this worktree: {worktree_path}
- Assigned slot: {slot_id}
- Assigned emulator serial: {emulator_serial}
- Commands spawned in your session inherit:
  - ANDROID_SERIAL={emulator_serial}
  - ORCHESTRATOR_EMULATOR_SERIAL={emulator_serial}
  - ORCHESTRATOR_SLOT_ID={slot_id}
- Use the assigned emulator while developing to verify how app changes behave.
- `adb` commands can target the assigned emulator directly through `ANDROID_SERIAL`.

Validation commands you may run yourself during development:
{checks_block}

Automated feedback from the previous check run:
{feedback_block}

Execution constraints:
- If requirements are ambiguous, do not guess. Request human clarification.
- If you need any resource outside this worktree path, request human approval first.
- Run the smallest relevant checks while iterating, then run the relevant final checks before returning `completed`.
- If your change affects app behavior or UI, inspect the result on the assigned emulator before returning `completed`.

Output contract:
Return ONLY a JSON object with this schema:
{{
  "status": "completed" | "needs_human" | "failed",
  "summary": "string",
  "changed_files": ["relative/path"],
  "question_reason": "AMBIGUOUS_REQUIREMENT" | "EXTERNAL_RESOURCE_ACCESS" | null,
  "question": "string | null"
}}
""".strip()
