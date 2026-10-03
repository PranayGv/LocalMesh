"""Demand and climate-fit rules, and the final routing decision."""

from backend import mock_data

DEMAND_THRESHOLD = 80
DEMAND_GROWTH_FACTOR = 1.2


def _avg(values: list[int]) -> float:
    return sum(values) / len(values)


def evaluate_demand(area_code: str, category_code: str) -> dict:
    counts = mock_data.get_purchase_history(area_code, category_code)
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


def evaluate_climate_fit(area_code: str, category_code: str) -> dict:
    area = mock_data.get_area(area_code)
    category = mock_data.get_category(category_code)

    area_climate_zone = area["climate_zone"]
    suited_climates = category["suited_climates"]
    is_climate_fit = area_climate_zone in suited_climates

    suited_text = ", ".join(suited_climates)
    if is_climate_fit:
        reason = (
            f"{area['name']} is a {area_climate_zone} climate zone, and {category['name']} is suited "
            f"for: {suited_text}. This category fits the local climate."
        )
    else:
        reason = (
            f"{area['name']} is a {area_climate_zone} climate zone, but {category['name']} is only "
            f"suited for: {suited_text}. This category does not fit the local climate."
        )

    return {
        "area_climate_zone": area_climate_zone,
        "category_suited_climates": suited_climates,
        "is_climate_fit": is_climate_fit,
        "reason": reason,
        "avg_temp_c": area["avg_temp_c"],
        "temp_scale": mock_data.TEMP_SCALE,
    }


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
