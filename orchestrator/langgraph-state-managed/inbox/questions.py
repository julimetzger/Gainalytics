from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from orchestrator.models.enums import QuestionReason
from orchestrator.models.question import HumanQuestion
from orchestrator.storage.files import write_yaml_file


def create_human_question(
    questions_dir: Path,
    run_id: str,
    task_id: str,
    reason: QuestionReason,
    prompt: str,
) -> HumanQuestion:
    question = HumanQuestion(
        question_id=f"Q-{uuid4().hex[:10]}",
        run_id=run_id,
        task_id=task_id,
        reason=reason,
        prompt=prompt,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    write_yaml_file(questions_dir / f"{question.question_id}.yaml", question.model_dump(mode="json"))
    return question
