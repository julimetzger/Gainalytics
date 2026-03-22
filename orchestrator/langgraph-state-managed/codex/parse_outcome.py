from __future__ import annotations

import json
import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class CodexOutcome(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["completed", "needs_human", "failed"]
    summary: str = Field(min_length=1)
    changed_files: list[str] = Field(default_factory=list)
    question_reason: Literal["AMBIGUOUS_REQUIREMENT", "EXTERNAL_RESOURCE_ACCESS"] | None = None
    question: str | None = None


def _extract_json_blob(text: str) -> str | None:
    stripped = text.strip()
    if stripped.startswith("{") and stripped.endswith("}"):
        return stripped

    codeblock_match = re.search(r"```(?:json)?\\s*(\{.*?\})\\s*```", text, re.DOTALL)
    if codeblock_match:
        return codeblock_match.group(1)

    first = text.find("{")
    last = text.rfind("}")
    if first != -1 and last != -1 and last > first:
        return text[first : last + 1]

    return None


def parse_codex_outcome(raw_text: str) -> CodexOutcome:
    blob = _extract_json_blob(raw_text)
    if blob is None:
        return CodexOutcome(
            status="failed",
            summary="Codex response did not contain valid JSON output contract.",
            changed_files=[],
            question_reason=None,
            question=None,
        )

    try:
        payload = json.loads(blob)
    except json.JSONDecodeError:
        return CodexOutcome(
            status="failed",
            summary="Codex response JSON could not be decoded.",
            changed_files=[],
            question_reason=None,
            question=None,
        )

    return CodexOutcome.model_validate(payload)
