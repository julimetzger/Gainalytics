from __future__ import annotations

import argparse
from pathlib import Path

from orchestrator.config import RuntimePaths
from orchestrator.storage.files import write_yaml_file


def _default_slots(runtime_paths: RuntimePaths) -> dict[str, list[dict[str, str]]]:
    # If running inside an existing worktree, sibling worktrees usually live in repo_root.parent.
    if runtime_paths.repo_root.parent.name == ".worktrees":
        worktrees_root = runtime_paths.repo_root.parent
    else:
        worktrees_root = runtime_paths.repo_root / ".worktrees"

    return {
        "slots": [
            {
                "slot_id": "agent-1",
                "worktree_path": str((worktrees_root / "agent-1").resolve()),
                "emulator_serial": "emulator-5554",
            },
            {
                "slot_id": "agent-2",
                "worktree_path": str((worktrees_root / "agent-2").resolve()),
                "emulator_serial": "emulator-5556",
            },
            {
                "slot_id": "agent-3",
                "worktree_path": str((worktrees_root / "agent-3").resolve()),
                "emulator_serial": "emulator-5558",
            },
            {
                "slot_id": "agent-4",
                "worktree_path": str((worktrees_root / "agent-4").resolve()),
                "emulator_serial": "emulator-5560",
            },
        ]
    }

_DEFAULT_CHECKS = {
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

_DEFAULT_POLICY = {
    "escalation": {
        "ambiguous_requirements": "ask_human",
        "external_resource_access": "ask_human",
    },
    "metadata_defaults": {"priority": "normal"},
    "codex": {
        "command": "codex exec --full-auto --sandbox workspace-write --ask-for-approval on-request --output-last-message {output_file} - < {prompt_file}",
        "output_last_message_file": "codex-last-message.txt",
        "timeout_seconds": 1800,
        "self_repair_max_rounds": 2,
        "check_feedback_tail_lines": 80,
    },
    "human_inbox": {
        "poll_interval_seconds": 10,
        "answer_timeout_seconds": 3600,
    },
}


def _init_runtime(runtime_paths: RuntimePaths) -> None:
    runtime_paths.ensure_runtime_dirs()
    slots_file = runtime_paths.config_dir / "slots.yaml"
    checks_file = runtime_paths.config_dir / "checks.yaml"
    policy_file = runtime_paths.config_dir / "policy.yaml"

    if not slots_file.exists():
        write_yaml_file(slots_file, _default_slots(runtime_paths))
    if not checks_file.exists():
        write_yaml_file(checks_file, _DEFAULT_CHECKS)
    if not policy_file.exists():
        write_yaml_file(policy_file, _DEFAULT_POLICY)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Gainalytics local orchestration CLI")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("init", help="Create runtime folders and default configs")

    run_task = sub.add_parser("run-task", help="Run one task file end-to-end")
    run_task.add_argument("--task", required=True, help="Path to task YAML file")

    scheduler = sub.add_parser("scheduler", help="Run task scheduler")
    scheduler.add_argument("--once", action="store_true", help="Run a single scheduler cycle")
    scheduler.add_argument("--loop", action="store_true", help="Run scheduler continuously")
    scheduler.add_argument("--interval", type=int, default=10, help="Polling interval for loop mode")
    scheduler.add_argument("--max-parallel", type=int, default=4, help="Maximum concurrent tasks")

    return parser


def main() -> None:
    parser = _build_parser()
    args = parser.parse_args()

    runtime_paths = RuntimePaths.discover()

    if args.command == "init":
        _init_runtime(runtime_paths)
        print(f"Initialized runtime at {runtime_paths.runtime_root}")
        return

    _init_runtime(runtime_paths)

    if args.command == "run-task":
        try:
            from orchestrator.scheduler.single_task import run_task_file
        except ModuleNotFoundError as exc:
            raise SystemExit(
                "Missing dependency for run-task. Install orchestrator requirements "
                "from orchestrator/pyproject.toml (langgraph is required)."
            ) from exc

        result = run_task_file(Path(args.task), runtime_paths=runtime_paths)
        print(f"{result.run_id} {result.task_id} => {result.status.value}")
        return

    if args.command == "scheduler":
        try:
            from orchestrator.scheduler.parallel import run_scheduler_loop, run_scheduler_once
        except ModuleNotFoundError as exc:
            raise SystemExit(
                "Missing dependency for scheduler. Install orchestrator requirements "
                "from orchestrator/pyproject.toml (langgraph is required)."
            ) from exc

        if args.loop:
            run_scheduler_loop(
                runtime_paths=runtime_paths,
                max_parallel=args.max_parallel,
                interval_seconds=args.interval,
            )
            return

        outcomes = run_scheduler_once(runtime_paths=runtime_paths, max_parallel=args.max_parallel)
        if not outcomes:
            print("No tasks available in inbox.")
            return

        for task_file, status in outcomes.items():
            print(f"{task_file}: {status}")
        return

    parser.error("Unknown command")


if __name__ == "__main__":
    main()
