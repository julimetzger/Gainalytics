from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from orchestrator.config import RuntimePaths
from orchestrator.models.enums import TaskStatus
from orchestrator.scheduler.single_task import run_task_file


def _claim_tasks(runtime_paths: RuntimePaths, limit: int) -> list[Path]:
    claimed: list[Path] = []
    for task_file in sorted(runtime_paths.tasks_inbox_dir.glob("*.yaml")):
        if len(claimed) >= limit:
            break
        target = runtime_paths.tasks_processing_dir / task_file.name
        try:
            task_file.rename(target)
            claimed.append(target)
        except FileNotFoundError:
            continue
    return claimed


def _finalize_task_file(runtime_paths: RuntimePaths, processing_path: Path, status: TaskStatus) -> None:
    target_dir = runtime_paths.tasks_done_dir if status == TaskStatus.SUCCEEDED else runtime_paths.tasks_failed_dir
    processing_path.rename(target_dir / processing_path.name)


def run_scheduler_once(runtime_paths: RuntimePaths | None = None, max_parallel: int = 4) -> dict[str, str]:
    runtime_paths = runtime_paths or RuntimePaths.discover()
    runtime_paths.ensure_runtime_dirs()

    claimed = _claim_tasks(runtime_paths, limit=max_parallel)
    if not claimed:
        return {}

    outcomes: dict[str, str] = {}
    with ThreadPoolExecutor(max_workers=max_parallel) as executor:
        future_map = {
            executor.submit(run_task_file, task_path, runtime_paths): task_path for task_path in claimed
        }

        for future in as_completed(future_map):
            task_path = future_map[future]
            try:
                result = future.result()
                outcomes[task_path.name] = result.status.value
                _finalize_task_file(runtime_paths, task_path, result.status)
            except Exception as exc:  # noqa: BLE001
                outcomes[task_path.name] = f"FAILED_ENV: {exc}"
                _finalize_task_file(runtime_paths, task_path, TaskStatus.FAILED_ENV)

    return outcomes


def run_scheduler_loop(
    runtime_paths: RuntimePaths | None = None,
    max_parallel: int = 4,
    interval_seconds: int = 10,
) -> None:
    runtime_paths = runtime_paths or RuntimePaths.discover()
    runtime_paths.ensure_runtime_dirs()

    while True:
        run_scheduler_once(runtime_paths=runtime_paths, max_parallel=max_parallel)
        time.sleep(interval_seconds)
