"""Demand and climate-fit rules, and the final routing decision."""

import hashlib

from backend import mock_data, warehouses

DEMAND_THRESHOLD = 80
DEMAND_GROWTH_FACTOR = 1.2


def _avg(values: list[int]) -> float:
    return sum(values) / len(values)


def _demand_from_counts(area_code: str, category_code: str, counts: list[int]) -> dict:
    prior_avg = round(_avg(counts[:3]), 1)
    recent_avg = round(_avg(counts[3:]), 1)

    growth_pct = round(((recent_avg - prior_avg) / prior_avg) * 100, 1) if prior_avg else 0.0
    rising = recent_avg > prior_avg * DEMAND_GROWTH_FACTOR
    above_threshold = recent_avg >= DEMAND_THRESHOLD
    has_demand = rising or above_threshold

    if rising:
        reason = (
            f"Recent average purchases ({recent_avg}/month) are {growth_pct}% higher than the "
            f"prior period ({prior_avg}/month), indicating rising demand in this area."
        )
    elif above_threshold:
        reason = (
            f"Recent average purchases ({recent_avg}/month) exceed the demand threshold of "
            f"{DEMAND_THRESHOLD}/month."
        )
    else:
        reason = (
            f"Recent average purchases ({recent_avg}/month) are flat or declining compared to the "
            f"prior period ({prior_avg}/month), and below the demand threshold of {DEMAND_THRESHOLD}/month."
        )

    return {
        "area_code": area_code,
        "category_code": category_code,
        "months": mock_data.MONTHS,
        "counts": counts,
        "recent_avg": recent_avg,
        "prior_avg": prior_avg,
        "growth_pct": growth_pct,
        "threshold": DEMAND_THRESHOLD,
        "has_demand": has_demand,
        "reason": reason,
    }


def evaluate_demand(area_code: str, category_code: str) -> dict:
    counts = mock_data.get_purchase_history(area_code, category_code)
    return _demand_from_counts(area_code, category_code, counts)


def _climate_result(area: dict, suited_climates: list[str], label: str) -> dict:
    area_climate_zone = area["climate_zone"]
    is_climate_fit = area_climate_zone in suited_climates
    # Weather-neutral gear (e.g. monsoon rainwear) is tagged as fitting every
    # zone so it never blocks local routing on climate grounds — but saying
    # "a rain jacket is suited for: Hot" reads as a false temperature claim,
    # so phrase the all-zone case as weather-neutral instead of listing zones.
    is_weather_neutral = set(suited_climates) >= {"Hot", "Moderate", "Cold"}

    if is_weather_neutral:
        reason = (
            f"{label} is weather-neutral gear suited for any climate zone, so it fits "
            f"{area['name']}'s {area_climate_zone} climate regardless of temperature."
        )
    elif is_climate_fit:
        suited_text = ", ".join(suited_climates)
        reason = (
            f"{area['name']} is a {area_climate_zone} climate zone, and {label} is suited "
            f"for: {suited_text}. This item fits the local climate."
        )
    else:
        suited_text = ", ".join(suited_climates)
        reason = (
            f"{area['name']} is a {area_climate_zone} climate zone, but {label} is only "
            f"suited for: {suited_text}. This item does not fit the local climate."
        )

    return {
        "area_code": area["code"],
        "area_climate_zone": area_climate_zone,
        "category_suited_climates": suited_climates,
        "is_climate_fit": is_climate_fit,
        "reason": reason,
        "avg_temp_c": area["avg_temp_c"],
        "temp_scale": mock_data.TEMP_SCALE,
    }


def evaluate_climate_fit(area_code: str, category_code: str) -> dict:
    area = mock_data.get_area(area_code)
    category = mock_data.get_category(category_code)
    return _climate_result(area, category["suited_climates"], category["name"])


def decide_routing(demand: dict, climate: dict, area_name: str, category_name: str) -> dict:
    if demand["has_demand"]:
        return {
            "route": "local_warehouse",
            "driver": "demand",
            "reason": (
                f"There is current demand for {category_name} in {area_name}, so the returned item "
                "will be stored in the local warehouse to meet upcoming orders."
            ),
        }

    if climate["is_climate_fit"]:
        return {
            "route": "local_warehouse",
            "driver": "climate_fit",
            "reason": (
                f"There is no strong current demand for {category_name} in {area_name}, but it suits "
                "the local climate, so the returned item will be stored in the local warehouse for "
                "when demand picks up."
            ),
        }

    return {
        "route": "central_hub",
        "driver": "none",
        "reason": (
            f"There is no current demand for {category_name} in {area_name}, and it does not suit "
            "the local climate, so the returned item will be sent to the central hub."
        ),
    }


def evaluate_defect_resolution(product: str, area_code: str, preferred_resolution: str | None = None) -> dict:
    """Hardware-defect flow: refund-or-replacement (the customer's own choice,
    when the storefront asked for one), then the faulty unit always goes to
    the local repair shop; a successful repair restocks it at the local
    warehouse, a failed one escalates it to the central warehouse for deep
    repair or scrap. The repair outcome is deterministic per (product, area)
    so repeat demo runs on the same item are stable, like the demand
    generator above — only the resolution step is customer-driven.
    """
    digest = int(hashlib.sha256(f"defect|{product}|{area_code}".encode()).hexdigest(), 16)

    customer_requested = preferred_resolution in ("refund", "replacement")
    if customer_requested:
        resolution = preferred_resolution
    else:
        resolution = "replacement" if (digest % 10) < 4 else "refund"  # replacements are costlier, so less common

    repair_successful = ((digest // 10) % 100) < 72  # most defects are repairable

    if resolution == "replacement":
        lead_in = "As requested, a replacement" if customer_requested else "A replacement"
        resolution_reason = (
            f"{lead_in} {product} ships to the customer from the central hub. "
            "The faulty unit is retained rather than returned to them."
        )
    else:
        lead_in = "As requested, a refund" if customer_requested else "A refund"
        resolution_reason = (
            f"{lead_in} has been issued for {product}. The faulty unit is still retained "
            "for repair rather than being shipped back to the customer."
        )

    if repair_successful:
        route = "local_warehouse"
        repair_reason = (
            "Repair completed successfully at the local repair shop. "
            "The refurbished unit is restocked at the local warehouse."
        )
    else:
        route = "central_warehouse"
        repair_reason = (
            "Repair attempt at the local repair shop was unsuccessful. "
            "The unit is escalated to the central warehouse for deep repair or scrap."
        )

    return {
        "resolution": resolution,
        "customer_requested": customer_requested,
        "resolution_reason": resolution_reason,
        "repair_successful": repair_successful,
        "repair_reason": repair_reason,
        "route": route,
    }


def process_return(
    classifier,
    product: str,
    season: str | None,
    pincode: str | None,
    review_text: str,
    preferred_resolution: str | None = None,
    suited_climates: list[str] | None = None,
) -> dict:
    """End-to-end pipeline for a return submitted from the storefront: classify
    the review, resolve the customer's area from their pincode, and (for
    personal-dissatisfaction returns) run demand + climate-fit + routing.

    Unlike evaluate_demand/evaluate_climate_fit above, this accepts any free-typed
    product name and a storefront "season" tag rather than one of the three fixed
    demo categories, so it works for SeasonMart's full catalog. preferred_resolution
    carries the customer's refund-or-replacement choice when the storefront asked
    for one (i.e. the review classified as a hardware defect).
    """
    label, confidence = classifier.predict(review_text)
    classification = {"label": label, "confidence": confidence}
    area = mock_data.resolve_area(pincode)

    if label == "hardware_defect":
        defect = evaluate_defect_resolution(product, area["code"], preferred_resolution)
        status = "defect_repaired" if defect["route"] == "local_warehouse" else "defect_hub"
        status_label = "Repaired: Local Warehouse" if status == "defect_repaired" else "Central Warehouse: Deep Repair"
        return {
            "classification": classification,
            "area": area,
            "defect_branch": defect,
            "dissatisfaction_branch": None,
            "status": status,
            "status_label": status_label,
        }

    counts = mock_data.generate_purchase_history(f"{product}|{area['code']}")
    demand = _demand_from_counts(area["code"], product, counts)
    # Prefer the storefront's explicit per-item suitability (accurate: a
    # sweater is Cold-only, a rain jacket is weather-neutral); fall back to a
    # season-wide heuristic only when the caller hasn't supplied one.
    resolved_suited = suited_climates if suited_climates else mock_data.suited_climates_for_season(season)
    climate = _climate_result(area, resolved_suited, product)
    routing = decide_routing(demand, climate, area["name"], product)

    status = "routed_local" if routing["route"] == "local_warehouse" else "routed_hub"
    status_label = "Routed: Local Warehouse" if status == "routed_local" else "Routed: Central Hub"

    return {
        "classification": classification,
        "area": area,
        "defect_branch": None,
        "dissatisfaction_branch": {"demand": demand, "climate": climate, "decision": routing},
        "status": status,
        "status_label": status_label,
    }


# ---------------------------------------------------------------------------
# Local Brand Center — service centre intake
#
# Two request types a service centre handles: a repair notification (a
# customer's faulty unit needs fixing) and an out-of-stock notification (a
# customer wants a unit no local source currently has). Both are
# deterministic per (product, area) like the rest of this module, so a demo
# re-run on the same pair is stable.
# ---------------------------------------------------------------------------


def evaluate_technician_availability(product: str, area_code: str) -> dict:
    digest = int(hashlib.sha256(f"technician|{product}|{area_code}".encode()).hexdigest(), 16)
    available = (digest % 100) < 78  # most service centres have a certified technician on shift
    reason = (
        "A brand-certified technician is on site at the service centre."
        if available
        else "No brand-certified technician is free at the service centre right now."
    )
    return {"available": available, "reason": reason}


def evaluate_repair_flow(
    product: str,
    area_code: str,
    season: str | None = None,
    suited_climates: list[str] | None = None,
) -> dict:
    """Repair-notification branch: certified technician + resources check ->
    attempt repair -> industry-standard check.

    - No technician/resources free: skips straight to the central hub.
    - Attempted but fails the industry-standard check: escalated to the
      central hub for extensive repair.
    - Attempted and passes: the repaired unit is routed exactly like a
      personal-dissatisfaction return — current local demand, then climate
      fit — reusing evaluate_demand/evaluate_climate_fit/decide_routing
      above, so a repaired unit and a dissatisfaction return land in the
      same place for the same (product, area).
    """
    area = mock_data.get_area(area_code)
    area_name = area["name"]

    technician = evaluate_technician_availability(product, area_code)

    if not technician["available"]:
        return {
            "technician_check": technician,
            "repair_attempt": {
                "attempted": False,
                "passed": None,
                "reason": "No technician or repair resources were free, so the repair was never attempted on site.",
            },
            "dissatisfaction_check": None,
            "route": "central_hub",
            "route_reason": (
                f"No certified technician or resources were available in {area_name}, so the unit "
                "is sent straight to the central hub."
            ),
        }

    # Same digest/threshold used to decide a local repair shop's outcome
    # elsewhere (see evaluate_defect_resolution) so a given (product, area)
    # resolves the same way across the storefront, WMS and this service
    # centre flow.
    digest = int(hashlib.sha256(f"defect|{product}|{area_code}".encode()).hexdigest(), 16)
    passed = ((digest // 10) % 100) < 72

    if not passed:
        return {
            "technician_check": technician,
            "repair_attempt": {
                "attempted": True,
                "passed": False,
                "reason": "The technician attempted the repair, but it failed the industry-standard check.",
            },
            "dissatisfaction_check": None,
            "route": "central_hub",
            "route_reason": (
                f"The on-site repair in {area_name} did not pass the industry-standard check, so the "
                "unit is escalated to the central hub for extensive repair."
            ),
        }

    resolved_suited = suited_climates if suited_climates else mock_data.suited_climates_for_season(season)
    counts = mock_data.generate_purchase_history(f"{product}|{area_code}")
    demand = _demand_from_counts(area_code, product, counts)
    climate = _climate_result(area, resolved_suited, product)
    routing = decide_routing(demand, climate, area_name, product)

    return {
        "technician_check": technician,
        "repair_attempt": {
            "attempted": True,
            "passed": True,
            "reason": "The technician completed the repair and it passed the industry-standard check.",
        },
        "dissatisfaction_check": {"demand": demand, "climate": climate, "decision": routing},
        "route": routing["route"],
        "route_reason": routing["reason"],
    }


def evaluate_local_stock_lookup(product: str, area_code: str) -> dict:
    """Out-of-stock-notification branch: check the requesting service
    centre's own local warehouse first, then query every other local
    warehouse ("partner shops") for the same product, reusing the shared
    stock data in warehouses.py so this never disagrees with what WareHub
    or SeasonMart show for the same warehouse.
    """
    area = mock_data.get_area(area_code)
    area_name = area["name"] if area else area_code

    local_products = warehouses.local_warehouse_products(area_code)
    local_match = next((p for p in local_products if p["name"] == product), None)
    local_qty = local_match["qty"] if local_match else 0

    if local_qty > 0:
        found_at = {"area_code": area_code, "area_name": area_name, "qty": local_qty}
        return {
            "local_qty": local_qty,
            "partner_matches": [],
            "found_at": found_at,
            "in_stock": True,
            "route": "dispatch",
            "route_reason": (
                f"{product} is in stock at the {area_name} local warehouse, so the unit "
                "ships straight to the customer."
            ),
        }

    partner_matches = []
    for other in mock_data.AREAS:
        if other["code"] == area_code:
            continue
        match = next(
            (p for p in warehouses.local_warehouse_products(other["code"]) if p["name"] == product), None
        )
        if match and match["qty"] > 0:
            partner_matches.append({"area_code": other["code"], "area_name": other["name"], "qty": match["qty"]})

    found_at = partner_matches[0] if partner_matches else None

    if found_at:
        return {
            "local_qty": 0,
            "partner_matches": partner_matches,
            "found_at": found_at,
            "in_stock": True,
            "route": "dispatch",
            "route_reason": (
                f"Not stocked in {area_name}, but a partner shop in {found_at['area_name']} has it, "
                "so the unit ships from there."
            ),
        }

    return {
        "local_qty": 0,
        "partner_matches": [],
        "found_at": None,
        "in_stock": False,
        "route": "flag_storefront",
        "route_reason": (
            f"No local warehouse or partner shop carries {product} right now, so it is "
            "flagged unavailable on the storefront."
        ),
    }
