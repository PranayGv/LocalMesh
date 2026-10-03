"""In-memory queue of return records submitted from the storefront.

Demo-only: no database, no persistence across restarts. A single process-wide
list is fine here since the app runs as one uvicorn worker.
"""

from backend.models import ReturnRecord

_RETURNS: list[ReturnRecord] = []


def add_return(record: ReturnRecord) -> None:
    _RETURNS.append(record)


def list_returns() -> list[ReturnRecord]:
    return list(reversed(_RETURNS))


def get_return(return_id: str) -> ReturnRecord | None:
    return next((r for r in _RETURNS if r.id == return_id), None)


def clear() -> None:
    _RETURNS.clear()
