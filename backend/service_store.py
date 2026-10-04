"""In-memory queues of Local Brand Center service-centre notifications.

Repair notifications are generated automatically whenever a storefront
return is classified as a hardware defect (see submit_return in routes.py).
Stock-check notifications are created when the storefront's "check local
brand center" action runs for a product that isn't in local stock. Both are
demo-only, no persistence across restarts — mirrors returns_store.py.
"""

from backend.models import RepairNotification, StockNotification

_REPAIRS: list[RepairNotification] = []
_STOCKS: list[StockNotification] = []


def add_repair(notification: RepairNotification) -> None:
    _REPAIRS.insert(0, notification)


def list_repairs() -> list[RepairNotification]:
    return list(_REPAIRS)


def add_stock(notification: StockNotification) -> None:
    _STOCKS.insert(0, notification)


def list_stocks() -> list[StockNotification]:
    return list(_STOCKS)


def clear() -> None:
    _REPAIRS.clear()
    _STOCKS.clear()
