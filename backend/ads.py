"""Ad-placement eligibility: decides whether a catalog product should be
advertised at all, and in which cities, following a fixed funnel —

    bought by many users -> clean return record -> fits current season
    -> (per city) fits the local climate -> serve ad there

Reuses the same demand engine as return routing (decision.py) and the same
climate catalog as warehouse stocking (warehouses.py) so the three readings
of "does this product fit here" never disagree with each other.
"""

from backend import decision, mock_data, warehouses

# How many of the mock cities must show demand (decision.DEMAND_THRESHOLD or
# rising, see decision._demand_from_counts) before a product counts as
# "bought by many users" network-wide, not just popular in one city.
BROAD_DEMAND_MIN_CITIES = 5

SEASON_LABELS = {"summer": "Summer", "monsoon": "Monsoon", "winter": "Winter"}


def get_catalog_product(name: str) -> dict | None:
    for entry_name, category, climate_code, season, price in warehouses.CATALOG:
        if entry_name == name:
            return {
                "name": entry_name,
                "category": category,
                "climate_code": climate_code,
                "season": season,
                "price": price,
            }
    return None


def list_catalog() -> list[dict]:
    return [
        {"name": name, "category": category, "climate_code": climate_code, "season": season, "price": price}
        for name, category, climate_code, season, price in warehouses.CATALOG
    ]


def _demand_gate(product_name: str) -> dict:
    cities_with_demand = []
    for area in mock_data.AREAS:
        counts = mock_data.generate_purchase_history(f"{product_name}|{area['code']}")
        demand = decision._demand_from_counts(area["code"], product_name, counts)
        if demand["has_demand"]:
            cities_with_demand.append(area["name"])

    passed = len(cities_with_demand) >= BROAD_DEMAND_MIN_CITIES
    total = len(mock_data.AREAS)
    if passed:
        reason = (
            f"Shows current demand in {len(cities_with_demand)} of {total} cities "
            f"({', '.join(cities_with_demand)}), meeting the broad-demand bar of "
            f"{BROAD_DEMAND_MIN_CITIES} cities."
        )
    else:
        reason = (
            f"Shows current demand in only {len(cities_with_demand)} of {total} cities, "
            f"below the broad-demand bar of {BROAD_DEMAND_MIN_CITIES} cities."
        )
    return {
        "passed": passed,
        "cities_with_demand": len(cities_with_demand),
        "total_cities": total,
        "reason": reason,
    }


def _return_reason_gate(product_name: str, returns: list) -> dict:
    defect_count = 0
    dissatisfaction_count = 0
    needle = product_name.strip().lower()
    for r in returns:
        if r.product.strip().lower() != needle:
            continue
        if r.classification.label == "hardware_defect":
            defect_count += 1
        else:
            dissatisfaction_count += 1

    passed = defect_count <= dissatisfaction_count
    if defect_count == 0 and dissatisfaction_count == 0:
        leading = "none"
        reason = "No returns recorded yet, so there is no defect signal blocking ads."
    elif defect_count > dissatisfaction_count:
        leading = "defects"
        reason = (
            f"Hardware defects lead returns ({defect_count} vs {dissatisfaction_count} "
            "dissatisfaction returns) — a quality issue, so it should not be advertised."
        )
    else:
        leading = "dissatisfaction"
        reason = (
            f"Dissatisfaction leads returns ({dissatisfaction_count} vs {defect_count} "
            "hardware-defect returns) — not a quality problem, safe to advertise."
        )
    return {
        "passed": passed,
        "defect_count": defect_count,
        "dissatisfaction_count": dissatisfaction_count,
        "leading": leading,
        "reason": reason,
    }


def _season_gate(product_season: str, requested_season: str) -> dict:
    passed = product_season == requested_season
    product_label = SEASON_LABELS.get(product_season, product_season)
    requested_label = SEASON_LABELS.get(requested_season, requested_season)
    if passed:
        reason = f"{product_label} gear matches the selected {requested_label} season."
    else:
        reason = f"This item is tagged for {product_label}, not the selected {requested_label} season."
    return {"passed": passed, "product_season": product_season, "requested_season": requested_season, "reason": reason}


def evaluate_ad_eligibility(product_name: str, requested_season: str, returns: list) -> dict | None:
    catalog_product = get_catalog_product(product_name)
    if catalog_product is None:
        return None

    demand_gate = _demand_gate(product_name)
    return_gate = _return_reason_gate(product_name, returns)
    season_gate = _season_gate(catalog_product["season"], requested_season)

    eligible = demand_gate["passed"] and return_gate["passed"] and season_gate["passed"]

    suited_zones = warehouses.CLIMATE_ZONES[catalog_product["climate_code"]]
    cities = [
        {
            "area_code": area["code"],
            "area_name": area["name"],
            "climate_zone": area["climate_zone"],
            "climate_fit": area["climate_zone"] in suited_zones,
            "ad_eligible": eligible and area["climate_zone"] in suited_zones,
        }
        for area in mock_data.AREAS
    ]

    return {
        "product": catalog_product["name"],
        "category": catalog_product["category"],
        "season": catalog_product["season"],
        "climate_code": catalog_product["climate_code"],
        "gates": {
            "bought_by_many": demand_gate,
            "return_reason": return_gate,
            "season_fit": season_gate,
        },
        "eligible": eligible,
        "cities": cities,
    }
