from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from orchestrator.models.slot import SlotConfig, SlotConfigFile
from orchestrator.slots.locks import SlotLock
from orchestrator.storage.files import read_yaml_file


@dataclass
class ReservedSlot:
    slot: SlotConfig
    lock: SlotLock

    def release(self) -> None:
        self.lock.release()


class SlotManager:
    def __init__(self, config_file: Path, locks_dir: Path, repo_root: Path) -> None:
        payload = read_yaml_file(config_file)
        parsed = SlotConfigFile.model_validate(payload)
        normalized_slots: list[SlotConfig] = []
        for slot in parsed.slots:
            slot_path = Path(slot.worktree_path)
            if not slot_path.is_absolute():
                candidates = [
                    (repo_root / slot_path).resolve(),
                    (repo_root.parent / slot_path).resolve(),
                ]
                if repo_root.parent.name == ".worktrees":
                    candidates.append((repo_root.parent.parent / slot_path).resolve())

                resolved = next((candidate for candidate in candidates if candidate.exists()), None)
                slot_path = resolved or candidates[0]
            normalized_slots.append(
                SlotConfig(
                    slot_id=slot.slot_id,
                    worktree_path=str(slot_path),
                    emulator_serial=slot.emulator_serial,
                )
            )
        self._slot_config = SlotConfigFile(slots=normalized_slots)
        self._locks_dir = locks_dir

    def reserve_available(self, timeout_seconds: int = 1) -> ReservedSlot | None:
        for slot in self._slot_config.slots:
            lock = SlotLock(file_path=self._locks_dir / f"{slot.slot_id}.lock")
            if lock.acquire(timeout_seconds=timeout_seconds):
                return ReservedSlot(slot=slot, lock=lock)
        return None
