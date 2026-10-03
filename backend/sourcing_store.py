"""In-memory queue of local-shop sourcing requests from the storefront.

Demo-only: no database, no persistence across restarts. Mirrors
returns_store.py but for "Search local shops" requests rather than returns.
"""

from backend.models import LocalSourcingRecord

_REQUESTS: list[LocalSourcingRecord] = []


def add_request(record: LocalSourcingRecord) -> None:
    _REQUESTS.append(record)


def list_requests() -> list[LocalSourcingRecord]:
    return list(reversed(_REQUESTS))


def get_request(request_id: str) -> LocalSourcingRecord | None:
    return next((r for r in _REQUESTS if r.id == request_id), None)


def clear() -> None:
    _REQUESTS.clear()
