"""Mock datasets: areas, product categories, and purchase history.

All in-memory — no database, no files. Numbers are hand-picked so the demo
can reach all three routing outcomes (demand-driven warehouse, climate-fit
warehouse, central hub) depending on which area/category the user picks.
"""

import hashlib
import random

AREAS = [
    {"code": "RAJ", "name": "Jaipur", "pincode": "302001", "climate_zone": "Hot", "avg_temp_c": 38},
    {"code": "DEL", "name": "Delhi", "pincode": "110001", "climate_zone": "Hot", "avg_temp_c": 34},
    {"code": "BLR", "name": "Bengaluru", "pincode": "560001", "climate_zone": "Moderate", "avg_temp_c": 24},
    {"code": "PUN", "name": "Pune", "pincode": "411001", "climate_zone": "Moderate", "avg_temp_c": 27},
    {"code": "SHM", "name": "Shimla", "pincode": "171001", "climate_zone": "Cold", "avg_temp_c": 12},
    {"code": "MUM", "name": "Mumbai", "pincode": "400001", "climate_zone": "Hot", "avg_temp_c": 31},
    {"code": "CHE", "name": "Chennai", "pincode": "600001", "climate_zone": "Hot", "avg_temp_c": 33},
    {"code": "KOL", "name": "Kolkata", "pincode": "700001", "climate_zone": "Moderate", "avg_temp_c": 29},
    {"code": "LKO", "name": "Lucknow", "pincode": "226001", "climate_zone": "Hot", "avg_temp_c": 32},
    {"code": "LEH", "name": "Leh", "pincode": "194101", "climate_zone": "Cold", "avg_temp_c": 3},
]

# Specific products (not abstract categories) — each still maps to one
# underlying "category" code for the demand/climate-fit rules.
CATEGORIES = [
    {"code": "COOLER", "name": "ArcticBreeze Air Cooler", "suited_climates": ["Hot"]},
    {"code": "FAN", "name": "ZephyrFlow Pedestal Fan", "suited_climates": ["Hot", "Moderate"]},
    {"code": "HEATER", "name": "WarmGlow Room Heater", "suited_climates": ["Cold", "Moderate"]},
]

# One or two named local fulfillment warehouses per area. Once a return is
# routed locally, one of these is assigned (deterministically, per product)
# so the admin panel can show exactly where the item is going rather than
# just the generic "local warehouse" route.
LOCAL_WAREHOUSES = {
    "RAJ": [
        {"code": "RAJ-W1", "name": "Jaipur Sitapura Warehouse"},
        {"code": "RAJ-W2", "name": "Jaipur Malviya Nagar Depot"},
    ],
    "DEL": [
        {"code": "DEL-W1", "name": "Delhi Okhla Warehouse"},
        {"code": "DEL-W2", "name": "Delhi Narela Depot"},
    ],
    "BLR": [
        {"code": "BLR-W1", "name": "Bengaluru Peenya Warehouse"},
        {"code": "BLR-W2", "name": "Bengaluru Electronic City Depot"},
    ],
    "PUN": [
        {"code": "PUN-W1", "name": "Pune Hinjewadi Warehouse"},
        {"code": "PUN-W2", "name": "Pune Chakan Depot"},
    ],
    "SHM": [
        {"code": "SHM-W1", "name": "Shimla Kasumpti Warehouse"},
    ],
    "MUM": [
        {"code": "MUM-W1", "name": "Mumbai Bhiwandi Warehouse"},
        {"code": "MUM-W2", "name": "Mumbai Taloja Depot"},
    ],
    "CHE": [
        {"code": "CHE-W1", "name": "Chennai Sriperumbudur Warehouse"},
        {"code": "CHE-W2", "name": "Chennai Ambattur Depot"},
    ],
    "KOL": [
        {"code": "KOL-W1", "name": "Kolkata Dankuni Warehouse"},
        {"code": "KOL-W2", "name": "Kolkata Salt Lake Depot"},
    ],
    "LKO": [
        {"code": "LKO-W1", "name": "Lucknow Amausi Warehouse"},
    ],
    "LEH": [
        {"code": "LEH-W1", "name": "Leh Choglamsar Warehouse"},
    ],
}

MONTHS = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]

# Bounds for the thermal-map gauge, and the thresholds that classify a
# temperature into Cold / Moderate / Hot — kept consistent with the
# climate_zone already assigned to each area above.
TEMP_SCALE = {"min_c": 0, "max_c": 45, "cold_max_c": 18, "hot_min_c": 30}

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

# Any SeasonMart product can be returned, not just Cooler/Fan/Heater, so
# climate fit for arbitrary products is derived from the storefront's
# "season" tag rather than a fixed per-product table. "monsoon" items are
# treated as suited everywhere (rain gear is needed regardless of hot/cold).
SEASON_SUITED_CLIMATES = {
    "summer": ["Hot", "Moderate"],
    "monsoon": ["Hot", "Moderate", "Cold"],
    "winter": ["Cold", "Moderate"],
}
_DEFAULT_SUITED_CLIMATES = ["Hot", "Moderate", "Cold"]


def get_area(area_code: str) -> dict | None:
    return next((a for a in AREAS if a["code"] == area_code), None)


def get_category(category_code: str) -> dict | None:
    return next((c for c in CATEGORIES if c["code"] == category_code), None)


def get_purchase_history(area_code: str, category_code: str) -> list[int]:
    return PURCHASE_HISTORY.get((area_code, category_code), list(_DEFAULT_HISTORY))


def get_local_warehouses(area_code: str) -> list[dict]:
    return LOCAL_WAREHOUSES.get(area_code, [])


def pick_local_warehouse(area_code: str, seed_key: str) -> dict | None:
    """Deterministically assign one of the area's local warehouses to a
    returned item, so repeat demo runs on the same (product, area) pair
    always land at the same warehouse, consistent with the other
    hash-seeded picks in this module."""
    warehouses = get_local_warehouses(area_code)
    if not warehouses:
        return None
    digest = int(hashlib.sha256(f"warehouse|{area_code}|{seed_key}".encode()).hexdigest(), 16)
    return warehouses[digest % len(warehouses)]


def suited_climates_for_season(season: str | None) -> list[str]:
    return SEASON_SUITED_CLIMATES.get((season or "").lower(), _DEFAULT_SUITED_CLIMATES)


def resolve_area(pincode: str | None) -> dict:
    """Map a free-typed storefront pincode to the nearest known mock area.

    Exact match wins; otherwise we fall back to whichever area shares the
    longest pincode prefix (a rough stand-in for geographic proximity), and
    finally default to the first area if the pincode is empty/unrecognised.
    """
    pincode = (pincode or "").strip()
    if not pincode:
        return AREAS[0]
    exact = next((a for a in AREAS if a["pincode"] == pincode), None)
    if exact:
        return exact

    def shared_prefix_len(a: str, b: str) -> int:
        length = 0
        for x, y in zip(a, b):
            if x != y:
                break
            length += 1
        return length

    return max(AREAS, key=lambda a: shared_prefix_len(a["pincode"], pincode))


def generate_purchase_history(seed_key: str) -> list[int]:
    """Deterministic pseudo-random 6-month purchase history for any
    (product, area) pair that isn't in the hand-authored table above, so
    every SeasonMart product/area combination still produces a plausible,
    stable demand chart."""
    seed = int(hashlib.sha256(seed_key.encode()).hexdigest(), 16) % (2**32)
    rng = random.Random(seed)
    trend = rng.choice([-1, 0, 1, 1])  # mild bias toward rising demand, for variety
    value = rng.randint(15, 70)
    counts = []
    for _ in range(6):
        value = max(2, value + trend * rng.randint(3, 14) + rng.randint(-6, 6))
        counts.append(value)
    return counts
