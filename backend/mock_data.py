"""Mock datasets: areas, product categories, and purchase history.

All in-memory — no database, no files. Numbers are hand-picked so the demo
can reach all three routing outcomes (demand-driven warehouse, climate-fit
warehouse, central hub) depending on which area/category the user picks.
"""

AREAS = [
    {"code": "RAJ", "name": "Jaipur", "pincode": "302001", "climate_zone": "Hot", "avg_temp_c": 38},
    {"code": "DEL", "name": "Delhi", "pincode": "110001", "climate_zone": "Hot", "avg_temp_c": 34},
    {"code": "BLR", "name": "Bengaluru", "pincode": "560001", "climate_zone": "Moderate", "avg_temp_c": 24},
    {"code": "PUN", "name": "Pune", "pincode": "411001", "climate_zone": "Moderate", "avg_temp_c": 27},
    {"code": "SHM", "name": "Shimla", "pincode": "171001", "climate_zone": "Cold", "avg_temp_c": 12},
]

CATEGORIES = [
    {"code": "COOLER", "name": "Cooler", "suited_climates": ["Hot"]},
    {"code": "FAN", "name": "Fan", "suited_climates": ["Hot", "Moderate"]},
    {"code": "HEATER", "name": "Heater", "suited_climates": ["Cold", "Moderate"]},
]

MONTHS = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]

# (area_code, category_code) -> 6 months of purchase counts, oldest to newest.
PURCHASE_HISTORY = {
    ("RAJ", "COOLER"): [40, 55, 70, 95, 110, 130],
    ("RAJ", "HEATER"): [8, 6, 5, 4, 3, 2],
    ("RAJ", "FAN"): [35, 40, 45, 60, 70, 80],
    ("DEL", "FAN"): [60, 65, 58, 90, 100, 115],
    ("DEL", "COOLER"): [50, 60, 65, 80, 95, 100],
    ("DEL", "HEATER"): [15, 14, 16, 13, 12, 11],
    ("BLR", "HEATER"): [10, 12, 9, 11, 10, 13],
    ("BLR", "COOLER"): [20, 18, 15, 14, 12, 10],
    ("BLR", "FAN"): [25, 24, 26, 23, 25, 24],
    ("PUN", "FAN"): [30, 28, 32, 29, 31, 33],
    ("PUN", "COOLER"): [25, 22, 20, 18, 15, 12],
    ("PUN", "HEATER"): [12, 11, 13, 12, 10, 11],
    ("SHM", "HEATER"): [50, 70, 85, 100, 120, 140],
    ("SHM", "FAN"): [5, 4, 4, 3, 2, 2],
    ("SHM", "COOLER"): [3, 2, 2, 1, 1, 1],
}

_DEFAULT_HISTORY = [20, 20, 20, 20, 20, 20]


def get_area(area_code: str) -> dict | None:
    return next((a for a in AREAS if a["code"] == area_code), None)


def get_category(category_code: str) -> dict | None:
    return next((c for c in CATEGORIES if c["code"] == category_code), None)


def get_purchase_history(area_code: str, category_code: str) -> list[int]:
    return PURCHASE_HISTORY.get((area_code, category_code), list(_DEFAULT_HISTORY))
