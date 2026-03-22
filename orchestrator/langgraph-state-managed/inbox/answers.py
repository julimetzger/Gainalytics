from __future__ import annotations

import time
from pathlib import Path

from orchestrator.models.question import HumanAnswer
from orchestrator.storage.files import read_yaml_file


def wait_for_answer(
    answers_dir: Path,
    question_id: str,
    timeout_seconds: int,
    poll_interval_seconds: int,
) -> HumanAnswer | None:
    answer_file = answers_dir / f"{question_id}.yaml"
    deadline = time.monotonic() + timeout_seconds

    while time.monotonic() < deadline:
        if answer_file.exists():
            return HumanAnswer.model_validate(read_yaml_file(answer_file))
        time.sleep(poll_interval_seconds)

    return None
