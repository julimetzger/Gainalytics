from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class LintCheck(BaseModel):
    model_config = ConfigDict(extra="forbid")

    command: str = Field(min_length=1)


class TypecheckCheck(BaseModel):
    model_config = ConfigDict(extra="forbid")

    command: str = Field(min_length=1)


class TestsCheck(BaseModel):
    model_config = ConfigDict(extra="forbid")

    command: str = Field(min_length=1)


class E2ECheck(BaseModel):
    model_config = ConfigDict(extra="forbid")

    framework: Literal["maestro"]
    command: str = Field(min_length=1)
    flow_path: str = Field(min_length=1)


class ChecksConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lint: LintCheck
    typecheck: TypecheckCheck
    tests: TestsCheck
    e2e: E2ECheck


class EscalationPolicy(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ambiguous_requirements: Literal["ask_human"]
    external_resource_access: Literal["ask_human"]


class MetadataDefaults(BaseModel):
    model_config = ConfigDict(extra="forbid")

    priority: Literal["low", "normal", "high"] = "normal"


class CodexConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    command: str = Field(min_length=1)
    output_last_message_file: str = Field(min_length=1)
    timeout_seconds: int = Field(default=1800, gt=0)
    self_repair_max_rounds: int = Field(default=2, ge=0)
    check_feedback_tail_lines: int = Field(default=80, gt=0)


class HumanInboxPolicy(BaseModel):
    model_config = ConfigDict(extra="forbid")

    poll_interval_seconds: int = Field(default=10, gt=0)
    answer_timeout_seconds: int = Field(default=3600, gt=0)


class RuntimePolicy(BaseModel):
    model_config = ConfigDict(extra="forbid")

    escalation: EscalationPolicy
    metadata_defaults: MetadataDefaults
    codex: CodexConfig
    human_inbox: HumanInboxPolicy
