from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from orchestrator.config import RuntimePaths
from orchestrator.graph.build import build_graph
from orchestrator.graph.nodes import NodeContext
from orchestrator.models.enums import TaskStatus
from orchestrator.models.result import CheckCommandResult, RunResult
from orchestrator.models.state import OrchestrationState
from orchestrator.policy.defaults import DefaultsLoader
from orchestrator.slots.manager import SlotManager
from orchestrator.storage.artifacts import create_run_artifacts
from orchestrator.storage.files import write_json_file, write_yaml_file


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_run_id() -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return f"run-{timestamp}-{uuid4().hex[:8]}"


def run_task_file(task_file: Path, runtime_paths: RuntimePaths | None = None) -> OrchestrationState:
    runtime_paths = runtime_paths or RuntimePaths.discover()
    runtime_paths.ensure_runtime_dirs()

    run_id = _new_run_id()
    artifacts = create_run_artifacts(runtime_paths.runs_dir, run_id)
    context = NodeContext(
        slot_manager=SlotManager(
            config_file=runtime_paths.config_dir / "slots.yaml",
            locks_dir=runtime_paths.logs_dir / "locks",
            repo_root=runtime_paths.repo_root,
        ),
        defaults_loader=DefaultsLoader(runtime_paths.config_dir),
        artifacts=artifacts,
        events_log_file=artifacts.run_dir / "events.jsonl",
        questions_dir=runtime_paths.inbox_questions_dir,
        answers_dir=runtime_paths.inbox_answers_dir,
    )

    now = _utc_now()
    state: dict[str, object] = {
        "run_id": run_id,
        "task_id": "",
        "task_file": str(task_file),
        "status": TaskStatus.RECEIVED.value,
        "slot_id": None,
        "worktree_path": None,
        "emulator_serial": None,
        "resolved_policy_file": None,
        "codex_log_file": None,
        "codex_exit_code": None,
        "changed_files": [],
        "check_results": {},
        "open_question_id": None,
        "human_answers": [],
        "codex_attempts": 0,
        "repair_attempts": 0,
        "latest_check_feedback": None,
        "codex_summary": None,
        "error_message": None,
        "started_at": now,
        "updated_at": now,
    }

    graph = build_graph(context)
    try:
        final_updates = graph.invoke(state)
        final_state_dict = state | final_updates
    except Exception as exc:  # noqa: BLE001
        final_state_dict = state | {
            "status": TaskStatus.FAILED_ENV.value,
            "error_message": f"Graph execution failed: {exc}",
            "updated_at": _utc_now(),
        }
    finally:
        if context.reserved_slot is not None:
            context.reserved_slot.release()

    validated_state = OrchestrationState.model_validate(final_state_dict)
    write_json_file(artifacts.run_dir / "final-state.json", validated_state.model_dump(mode="json"))

    check_rows: list[CheckCommandResult] = []
    for check_payload in final_state_dict.get("check_results", {}).values():
        check_rows.append(CheckCommandResult.model_validate(check_payload))

    if validated_state.status == TaskStatus.SUCCEEDED:
        summary = validated_state.codex_summary or validated_state.status.value
    else:
        summary = validated_state.error_message or validated_state.codex_summary or validated_state.status.value
    report = RunResult(
        run_id=validated_state.run_id,
        task_id=validated_state.task_id,
        status=validated_state.status,
        summary=summary,
        changed_files=validated_state.changed_files,
        checks=check_rows,
        artifacts_dir=str(artifacts.run_dir),
    )
    write_yaml_file(runtime_paths.results_dir / f"{validated_state.run_id}.yaml", report.model_dump(mode="json"))

    return validated_state
