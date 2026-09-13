"""The last thing each server a queue dials did, for the dashboard's lamps."""

from __future__ import annotations

import threading
from datetime import UTC, datetime
from typing import Any

OK = "ok"
DOWN = "down"
UNKNOWN = "unknown"

_LOCK = threading.Lock()
_STATE: dict[tuple[str, str], dict[str, Any]] = {}


def short(reason: str, limit: int = 200) -> str:
    """Return the first line of a reason, which is what fits a tooltip."""
    lines = reason.strip().splitlines()
    return lines[0][:limit] if lines else ""


def record(kind: str, url: str, reason: str = "") -> None:
    """Remember one outcome: no reason is an answer, a reason is a failure."""
    if not url:
        return
    now = datetime.now(UTC).isoformat()
    state = DOWN if reason else OK
    with _LOCK:
        previous = _STATE.get((kind, url))
        since = previous["since"] if previous and previous["state"] == state else now
        _STATE[(kind, url)] = {
            "url": url,
            "state": state,
            "reason": short(reason),
            "since": since,
            "checked_at": now,
        }


def read(kind: str, url: str) -> dict[str, Any]:
    """Return what one address last did, or why nothing is known about it."""
    if not url:
        return _unknown("", "no server URL is set")
    with _LOCK:
        found = _STATE.get((kind, url))
    if found is None:
        return _unknown(url, "not dialled since the service started")
    return dict(found)


def clear() -> None:
    """Forget every outcome."""
    with _LOCK:
        _STATE.clear()


def _unknown(url: str, reason: str) -> dict[str, Any]:
    """Describe an address nothing is known about."""
    return {
        "url": url,
        "state": UNKNOWN,
        "reason": reason,
        "since": None,
        "checked_at": None,
    }
