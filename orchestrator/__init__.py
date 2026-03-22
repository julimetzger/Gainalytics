"""Gainalytics local orchestration package."""
from pathlib import Path

_PACKAGE_ROOT = Path(__file__).resolve().parent
_STATE_MANAGED_ROOT = _PACKAGE_ROOT / "langgraph-state-managed"

if _STATE_MANAGED_ROOT.exists():
    __path__.append(str(_STATE_MANAGED_ROOT))
