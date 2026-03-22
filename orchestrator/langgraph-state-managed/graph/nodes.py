from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from orchestrator.checks.feedback import build_check_feedback, summarize_check_failure
from orchestrator.checks.runner import build_check_plan, run_required_checks
from orchestrator.codex.runner import run_codex
from orchestrator.graph.transitions import next_status, utc_now
from orchestrator.inbox.answers import wait_for_answer
from orchestrator.inbox.questions import create_human_question
from orchestrator.models.enums import QuestionReason, TaskStatus
from orchestrator.models.task import TaskSpec
from orchestrator.policy.defaults import DefaultsLoader, LoadedDefaults
from orchestrator.policy.merge import EffectiveTask
from orchestrator.slots.manager import ReservedSlot, SlotManager
from orchestrator.storage.artifacts import RunArtifacts
from orchestrator.storage.files import read_yaml_file, write_json_file, write_yaml_file


@dataclass
class NodeContext:
    slot_manager: SlotManager
    defaults_loader: DefaultsLoader
    artifacts: RunArtifacts
    events_log_file: Path
    questions_dir: Path
    answers_dir: Path
    task_spec: TaskSpec | None = None
    defaults: LoadedDefaults | None = None
    effective_task: EffectiveTask | None = None
    reserved_slot: ReservedSlot | None = None


def _set_status(state: dict[str, Any], status: TaskStatus) -> dict[str, Any]:
    current = TaskStatus(state["status"])
    return {
        "status": next_status(current, status).value,
        "updated_at": utc_now(),
    }


def _snapshot_state(context: NodeContext, node_name: str, state: dict[str, Any]) -> None:
    snapshot_path = context.artifacts.state_dir / f"{node_name}.json"
    write_json_file(snapshot_path, state)


def load_task_node(context: NodeContext, state: dict[str, Any]) -> dict[str, Any]:
    task_file = Path(state["task_file"])
    raw_task = read_yaml_file(task_file)
    task_id = raw_task.get("task_id", "")
    updates = {
        "task_id": task_id,
        "updated_at": utc_now(),
        "raw_task": raw_task,
    }
    _snapshot_state(context, "01_load_task", state | updates)
    return updates


def validate_task_node(context: NodeContext, state: dict[str, Any]) -> dict[str, Any]:
    try:
        context.task_spec = TaskSpec.model_validate(state["raw_task"])
    except Exception as exc:  # noqa: BLE001
        updates = {
            **_set_status(state, TaskStatus.FAILED_VALIDATION),
            "error_message": f"Task schema validation failed: {exc}",
        }
        _snapshot_state(context, "02_validate_task_failed", state | updates)
        return updates

    updates = _set_status(state, TaskStatus.VALIDATED)
    updates["task_id"] = context.task_spec.task_id
    _snapshot_state(context, "02_validate_task", state | updates)
    return updates


def resolve_defaults_node(context: NodeContext, state: dict[str, Any]) -> dict[str, Any]:
    if context.task_spec is None:
        raise ValueError("task_spec missing before resolve_defaults")

    context.defaults = context.defaults_loader.load()
    context.effective_task = EffectiveTask(
        task=context.task_spec,
        checks=context.defaults.checks,
        policy=context.defaults.policy,
    )

    resolved_snapshot = {
        "task": context.task_spec.model_dump(mode="json"),
        "checks": context.defaults.checks.model_dump(mode="json"),
        "policy": context.defaults.policy.model_dump(mode="json"),
    }
    resolved_path = context.artifacts.run_dir / "resolved-task.yaml"
    write_yaml_file(resolved_path, resolved_snapshot)
    updates = {
        "resolved_policy_file": str(resolved_path),
        "updated_at": utc_now(),
    }
    _snapshot_state(context, "03_resolve_defaults", state | updates)
    return updates


def reserve_slot_node(context: NodeContext, state: dict[str, Any]) -> dict[str, Any]:
    reservation = context.slot_manager.reserve_available(timeout_seconds=1)
    if reservation is None:
        updates = {
            **_set_status(state, TaskStatus.FAILED_ENV),
            "error_message": "No free agent slot available.",
        }
        _snapshot_state(context, "04_reserve_slot_failed", state | updates)
        return updates

    context.reserved_slot = reservation
    slot = reservation.slot
    updates = {
        **_set_status(state, TaskStatus.ASSIGNED),
        "slot_id": slot.slot_id,
        "worktree_path": slot.worktree_path,
        "emulator_serial": slot.emulator_serial,
    }
    _snapshot_state(context, "04_reserve_slot", state | updates)
    return updates


def run_codex_node(context: NodeContext, state: dict[str, Any]) -> dict[str, Any]:
    if context.effective_task is None or context.reserved_slot is None:
        raise ValueError("effective task and reserved slot are required before codex run")

    working_state = state | _set_status(state, TaskStatus.RUNNING_CODEX)
    previous_answers = list(state.get("human_answers") or [])
    changed_files = list(state.get("changed_files") or [])
    codex_attempt = int(state.get("codex_attempts") or 0) + 1
    slot = context.reserved_slot.slot
    available_checks = [
        (planned_check.name, planned_check.command)
        for planned_check in build_check_plan(
            checks=context.effective_task.checks,
            emulator_serial=slot.emulator_serial,
        )
    ]

    try:
        result = run_codex(
            effective_task=context.effective_task,
            worktree_path=Path(slot.worktree_path),
            run_logs_dir=context.artifacts.logs_dir,
            previous_answers=previous_answers,
            slot_id=slot.slot_id,
            emulator_serial=slot.emulator_serial,
            available_checks=available_checks,
            codex_attempt=codex_attempt,
            check_feedback=state.get("latest_check_feedback"),
        )
    except Exception as exc:  # noqa: BLE001
        updates = {
            **_set_status(working_state, TaskStatus.FAILED_ENV),
            "error_message": f"Codex runner execution failed: {exc}",
        }
        _snapshot_state(context, "05_run_codex_exception", state | updates)
        return updates

    updates: dict[str, Any] = {
        "codex_attempts": codex_attempt,
        "codex_exit_code": result.exit_code,
        "codex_log_file": str(result.artifacts.command_log),
        "changed_files": list(dict.fromkeys(changed_files + result.outcome.changed_files)),
        "codex_summary": result.outcome.summary,
    }

    if result.outcome.status == "needs_human":
        updates |= _set_status(working_state | updates, TaskStatus.WAITING_HUMAN)
        updates["error_message"] = None
        updates["pending_question_reason"] = result.outcome.question_reason
        updates["pending_question"] = result.outcome.question or "Codex requested clarification."
    elif result.outcome.status == "completed":
        updates |= _set_status(working_state | updates, TaskStatus.RUNNING_CHECKS)
        updates["error_message"] = None
    else:
        fail_status = TaskStatus.FAILED_ENV if result.exit_code != 0 else TaskStatus.FAILED_CODE
        updates |= _set_status(working_state | updates, fail_status)
        updates["error_message"] = result.outcome.summary

    _snapshot_state(context, "05_run_codex", state | updates)
    return updates


def write_human_question_node(context: NodeContext, state: dict[str, Any]) -> dict[str, Any]:
    reason_raw = state.get("pending_question_reason") or "AMBIGUOUS_REQUIREMENT"
    prompt = state.get("pending_question") or "Please clarify the task requirements."

    question = create_human_question(
        questions_dir=context.questions_dir,
        run_id=state["run_id"],
        task_id=state["task_id"],
        reason=QuestionReason(reason_raw),
        prompt=prompt,
    )

    updates = {
        "open_question_id": question.question_id,
        "updated_at": utc_now(),
        "pending_question_reason": None,
        "pending_question": None,
    }
    _snapshot_state(context, "06_write_human_question", state | updates)
    return updates


def wait_for_human_answer_node(context: NodeContext, state: dict[str, Any]) -> dict[str, Any]:
    if context.effective_task is None:
        raise ValueError("effective task missing for wait_for_human_answer")

    question_id = state.get("open_question_id")
    if not question_id:
        updates = {
            **_set_status(state, TaskStatus.FAILED_ENV),
            "error_message": "Question id missing while waiting for human answer.",
        }
        _snapshot_state(context, "07_wait_for_answer_failed", state | updates)
        return updates

    answer = wait_for_answer(
        answers_dir=context.answers_dir,
        question_id=question_id,
        timeout_seconds=context.effective_task.policy.human_inbox.answer_timeout_seconds,
        poll_interval_seconds=context.effective_task.policy.human_inbox.poll_interval_seconds,
    )

    if answer is None:
        updates = {
            **_set_status(state, TaskStatus.FAILED_ENV),
            "error_message": f"Timed out waiting for answer to question {question_id}.",
        }
        _snapshot_state(context, "07_wait_for_answer_timeout", state | updates)
        return updates

    answers = list(state.get("human_answers") or [])
    answers.append(answer.answer)
    updates = {
        **_set_status(state, TaskStatus.RUNNING_CODEX),
        "open_question_id": None,
        "human_answers": answers,
    }
    _snapshot_state(context, "07_wait_for_answer", state | updates)
    return updates


def run_checks_node(context: NodeContext, state: dict[str, Any]) -> dict[str, Any]:
    if context.effective_task is None:
        raise ValueError("effective task missing for run_checks")
    if context.reserved_slot is None:
        raise ValueError("reserved slot missing for run_checks")

    try:
        checks_result = run_required_checks(
            checks=context.effective_task.checks,
            worktree_path=Path(context.reserved_slot.slot.worktree_path),
            emulator_serial=context.reserved_slot.slot.emulator_serial,
            logs_dir=context.artifacts.logs_dir,
        )
    except Exception as exc:  # noqa: BLE001
        updates = {
            **_set_status(state, TaskStatus.FAILED_ENV),
            "error_message": f"Check runner failed before completion: {exc}",
        }
        _snapshot_state(context, "08_run_checks_exception", state | updates)
        return updates

    updates: dict[str, Any] = {
        "check_results": {
            result.name: result.model_dump(mode="json") for result in checks_result.results
        },
    }
    if checks_result.final_status == TaskStatus.SUCCEEDED.value:
        updates["latest_check_feedback"] = None
        updates["error_message"] = None
        updates |= _set_status(state, TaskStatus.SUCCEEDED)
        _snapshot_state(context, "08_run_checks", state | updates)
        return updates

    feedback = build_check_feedback(
        results=checks_result.results,
        tail_lines=context.effective_task.policy.codex.check_feedback_tail_lines,
    )
    updates["latest_check_feedback"] = feedback

    if checks_result.final_status == TaskStatus.FAILED_ENV.value:
        updates["error_message"] = summarize_check_failure(checks_result.results)
        updates |= _set_status(state, TaskStatus.FAILED_ENV)
        _snapshot_state(context, "08_run_checks", state | updates)
        return updates

    repair_attempts = int(state.get("repair_attempts") or 0)
    max_repair_rounds = context.effective_task.policy.codex.self_repair_max_rounds
    if repair_attempts < max_repair_rounds:
        updates["repair_attempts"] = repair_attempts + 1
        updates["error_message"] = None
        updates |= _set_status(state, TaskStatus.RUNNING_CODEX)
        _snapshot_state(context, "08_run_checks", state | updates)
        return updates

    updates["error_message"] = summarize_check_failure(checks_result.results)
    updates |= _set_status(state, TaskStatus.FAILED_CODE)
    _snapshot_state(context, "08_run_checks", state | updates)
    return updates


def finalize_node(context: NodeContext, state: dict[str, Any]) -> dict[str, Any]:
    _snapshot_state(context, "09_finalize", state)
    return {"updated_at": utc_now()}
