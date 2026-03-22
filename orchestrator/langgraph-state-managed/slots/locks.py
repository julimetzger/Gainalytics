from __future__ import annotations

import fcntl
import time
from dataclasses import dataclass
from pathlib import Path


@dataclass
class SlotLock:
    file_path: Path
    _handle: object | None = None

    def acquire(self, timeout_seconds: int = 1) -> bool:
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        handle = self.file_path.open("a+", encoding="utf-8")
        started_at = time.monotonic()
        while True:
            try:
                fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                self._handle = handle
                return True
            except BlockingIOError:
                if time.monotonic() - started_at >= timeout_seconds:
                    handle.close()
                    return False
                time.sleep(0.1)

    def release(self) -> None:
        if self._handle is None:
            return
        fcntl.flock(self._handle.fileno(), fcntl.LOCK_UN)
        self._handle.close()
        self._handle = None
