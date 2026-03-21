from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SlotConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slot_id: str = Field(min_length=1)
    worktree_path: str = Field(min_length=1)
    emulator_serial: str = Field(min_length=1)


class SlotConfigFile(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slots: list[SlotConfig] = Field(min_length=1)

    @field_validator("slots")
    @classmethod
    def ensure_unique_slots(cls, slots: list[SlotConfig]) -> list[SlotConfig]:
        slot_ids = {slot.slot_id for slot in slots}
        if len(slot_ids) != len(slots):
            raise ValueError("slot_id values must be unique")
        return slots
