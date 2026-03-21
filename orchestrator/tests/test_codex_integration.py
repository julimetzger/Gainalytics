from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

from orchestrator.checks.runner import ChecksRunResult
from orchestrator.codex.prompt_builder import build_codex_prompt
from orchestrator.codex.runner import run_codex
from orchestrator.graph.nodes import NodeContext, run_checks_node
from orchestrator.models.enums import FailureKind, TaskStatus
from orchestrator.models.policy import ChecksConfig, RuntimePolicy
from orchestrator.models.result import CheckCommandResult
from orchestrator.models.slot import SlotConfig
from orchestrator.models.task import TaskSpec
from orchestrator.policy.merge import EffectiveTask
from orchestrator.slots.locks import SlotLock
from orchestrator.slots.manager import ReservedSlot
from orchestrator.storage.artifacts import create_run_artifacts
from orchestrator.storage.files import write_text_file


def make_effective_task(
    *,
    self_repair_max_rounds: int = 2,
    check_feedback_tail_lines: int = 80,
) -> EffectiveTask:
    task = TaskSpec.model_validate(
        {
            "schema_version": "1.0",
            "task_id": "TASK-1000",
            "title": "Improve the analysis screen",
            "description": "Make changes and validate them locally.",
            "business_requirements": [
                {"id": "BR-1", "text": "User can open the analysis screen."},
            ],
            "acceptance_criteria": [
                {"id": "AC-1", "text": "The analysis screen loads without regressions."},
            ],
        }
    )
    checks = ChecksConfig.model_validate(
        {
            "lint": {"command": "npm run lint"},
            "typecheck": {"command": "npm run typecheck"},
            "tests": {"command": "npm test -- --runInBand"},
            "e2e": {
                "framework": "maestro",
                "command": (
                    "bash ./__tests__/e2e/scripts/run-maestro-from-wsl.sh --mode smoke "
                    "--suite {flow_path} --report ./__tests__/reports/maestro-{emulator_serial}.xml "
                    "--device {emulator_serial}"
                ),
                "flow_path": "./__tests__/e2e/maestro/flows/smoke.yaml",
            },
        }
    )
    policy = RuntimePolicy.model_validate(
        {
            "escalation": {
                "ambiguous_requirements": "ask_human",
                "external_resource_access": "ask_human",
            },
            "metadata_defaults": {"priority": "normal"},
            "codex": {
                "command": "codex exec --output-last-message {output_file} - < {prompt_file}",
                "output_last_message_file": "codex-last-message.txt",
                "timeout_seconds": 30,
                "self_repair_max_rounds": self_repair_max_rounds,
                "check_feedback_tail_lines": check_feedback_tail_lines,
            },
            "human_inbox": {
                "poll_interval_seconds": 1,
                "answer_timeout_seconds": 10,
            },
        }
    )
    return EffectiveTask(task=task, checks=checks, policy=policy)


class CodexIntegrationTests(unittest.TestCase):
    def test_build_codex_prompt_includes_emulator_context_and_feedback(self) -> None:
        prompt = build_codex_prompt(
            effective_task=make_effective_task(),
            worktree_path="/tmp/agent-1",
            previous_answers=["Use the smoke flow before finishing."],
            slot_id="agent-1",
            emulator_serial="emulator-5554",
            available_checks=[
                ("lint", "npm run lint"),
                ("e2e", "bash ./__tests__/e2e/scripts/run-maestro-from-wsl.sh --device emulator-5554"),
            ],
            codex_attempt=2,
            check_feedback="- typecheck: FAIL\n  command: npm run typecheck",
        )

        self.assertIn("Codex attempt: 2", prompt)
        self.assertIn("Assigned emulator serial: emulator-5554", prompt)
        self.assertIn("ANDROID_SERIAL=emulator-5554", prompt)
        self.assertIn("Validation commands you may run yourself during development", prompt)
        self.assertIn("npm run lint", prompt)
        self.assertIn("typecheck: FAIL", prompt)
        self.assertIn("inspect the result on the assigned emulator", prompt)

    def test_run_codex_passes_slot_environment_into_subprocess(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            temp_root = Path(tmp_dir)
            worktree_path = temp_root / "agent-1"
            run_logs_dir = temp_root / "run-logs"
            worktree_path.mkdir()
            run_logs_dir.mkdir()

            completed_process = SimpleNamespace(
                stdout=(
                    '{"status":"completed","summary":"done","changed_files":["app/file.ts"],'
                    '"question_reason":null,"question":null}'
                ),
                stderr="",
                returncode=0,
            )

            with patch("orchestrator.codex.runner.subprocess.run", return_value=completed_process) as run_mock:
                result = run_codex(
                    effective_task=make_effective_task(),
                    worktree_path=worktree_path,
                    run_logs_dir=run_logs_dir,
                    previous_answers=[],
                    slot_id="agent-1",
                    emulator_serial="emulator-5554",
                    available_checks=[("tests", "npm test -- --runInBand")],
                    codex_attempt=1,
                    check_feedback=None,
                )

            run_kwargs = run_mock.call_args.kwargs
            self.assertEqual(run_kwargs["cwd"], worktree_path)
            self.assertEqual(run_kwargs["env"]["ANDROID_SERIAL"], "emulator-5554")
            self.assertEqual(run_kwargs["env"]["ORCHESTRATOR_EMULATOR_SERIAL"], "emulator-5554")
            self.assertEqual(run_kwargs["env"]["ORCHESTRATOR_SLOT_ID"], "agent-1")
            self.assertEqual(run_kwargs["env"]["ORCHESTRATOR_CODEX_ATTEMPT"], "1")
            self.assertEqual(result.outcome.status, "completed")

    def test_run_checks_node_requeues_failed_code_checks_with_feedback(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            temp_root = Path(tmp_dir)
            artifacts = create_run_artifacts(temp_root / "runs", "run-1")
            worktree_path = temp_root / "agent-1"
            worktree_path.mkdir()
            log_file = artifacts.logs_dir / "check-02-typecheck.log"
            write_text_file(log_file, "$ npm run typecheck\n=== STDERR ===\nType error on line 42")

            context = make_node_context(
                temp_root=temp_root,
                artifacts_run_id="run-1",
                worktree_path=worktree_path,
                effective_task=make_effective_task(self_repair_max_rounds=2, check_feedback_tail_lines=10),
            )
            context.artifacts = artifacts

            check_result = CheckCommandResult(
                name="typecheck",
                command="npm run typecheck",
                exit_code=2,
                started_at="2026-03-20T10:00:00Z",
                finished_at="2026-03-20T10:00:10Z",
                log_file=str(log_file),
                failure_kind=FailureKind.CODE,
            )
            state = make_running_checks_state(worktree_path=worktree_path)

            with patch(
                "orchestrator.graph.nodes.run_required_checks",
                return_value=ChecksRunResult(results=[check_result], final_status="FAILED_CODE"),
            ):
                updates = run_checks_node(context, state)

            self.assertEqual(updates["status"], TaskStatus.RUNNING_CODEX.value)
            self.assertEqual(updates["repair_attempts"], 1)
            self.assertIn("typecheck", updates["latest_check_feedback"])
            self.assertIn("Type error on line 42", updates["latest_check_feedback"])
            self.assertIsNone(updates["error_message"])

    def test_run_checks_node_stops_after_retry_budget_is_exhausted(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            temp_root = Path(tmp_dir)
            artifacts = create_run_artifacts(temp_root / "runs", "run-2")
            worktree_path = temp_root / "agent-1"
            worktree_path.mkdir()
            log_file = artifacts.logs_dir / "check-02-typecheck.log"
            write_text_file(log_file, "$ npm run typecheck\n=== STDERR ===\nType error on line 42")

            context = make_node_context(
                temp_root=temp_root,
                artifacts_run_id="run-2",
                worktree_path=worktree_path,
                effective_task=make_effective_task(self_repair_max_rounds=1, check_feedback_tail_lines=10),
            )
            context.artifacts = artifacts

            check_result = CheckCommandResult(
                name="typecheck",
                command="npm run typecheck",
                exit_code=2,
                started_at="2026-03-20T10:00:00Z",
                finished_at="2026-03-20T10:00:10Z",
                log_file=str(log_file),
                failure_kind=FailureKind.CODE,
            )
            state = make_running_checks_state(worktree_path=worktree_path)
            state["repair_attempts"] = 1

            with patch(
                "orchestrator.graph.nodes.run_required_checks",
                return_value=ChecksRunResult(results=[check_result], final_status="FAILED_CODE"),
            ):
                updates = run_checks_node(context, state)

            self.assertEqual(updates["status"], TaskStatus.FAILED_CODE.value)
            self.assertEqual(updates["error_message"], "Automated check 'typecheck' failed with exit code 2.")


def make_node_context(
    *,
    temp_root: Path,
    artifacts_run_id: str,
    worktree_path: Path,
    effective_task: EffectiveTask,
) -> NodeContext:
    artifacts = create_run_artifacts(temp_root / "runs", artifacts_run_id)
    reserved_slot = ReservedSlot(
        slot=SlotConfig(
            slot_id="agent-1",
            worktree_path=str(worktree_path),
            emulator_serial="emulator-5554",
        ),
        lock=SlotLock(file_path=temp_root / "locks" / "agent-1.lock"),
    )
    return NodeContext(
        slot_manager=Mock(),
        defaults_loader=Mock(),
        artifacts=artifacts,
        events_log_file=artifacts.run_dir / "events.jsonl",
        questions_dir=temp_root / "questions",
        answers_dir=temp_root / "answers",
        effective_task=effective_task,
        reserved_slot=reserved_slot,
    )


def make_running_checks_state(*, worktree_path: Path) -> dict[str, object]:
    return {
        "run_id": "run-1",
        "task_id": "TASK-1000",
        "task_file": str(worktree_path / "TASK-1000.yaml"),
        "status": TaskStatus.RUNNING_CHECKS.value,
        "slot_id": "agent-1",
        "worktree_path": str(worktree_path),
        "emulator_serial": "emulator-5554",
        "resolved_policy_file": None,
        "codex_log_file": None,
        "codex_exit_code": 0,
        "changed_files": ["app/file.ts"],
        "check_results": {},
        "open_question_id": None,
        "human_answers": [],
        "codex_attempts": 1,
        "repair_attempts": 0,
        "latest_check_feedback": None,
        "codex_summary": "Updated the analysis screen.",
        "error_message": None,
        "started_at": "2026-03-20T09:59:00Z",
        "updated_at": "2026-03-20T10:00:00Z",
    }


if __name__ == "__main__":
    unittest.main()
