from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from orchestrator.models.enums import QuestionReason, QuestionStatus


class HumanQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question_id: str = Field(min_length=1)
    run_id: str = Field(min_length=1)
    task_id: str = Field(min_length=1)
    reason: QuestionReason
    prompt: str = Field(min_length=1)
    status: QuestionStatus = QuestionStatus.OPEN
    created_at: str = Field(min_length=1)


class HumanAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question_id: str = Field(min_length=1)
    answer: str = Field(min_length=1)
    answered_at: str = Field(min_length=1)
