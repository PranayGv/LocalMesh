import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request

from backend import decision, mock_data, returns_store, sourcing_store
from backend.models import (
    AreaOption,
    CategoryOption,
    Classification,
    ClassifyRequest,
    DefectBranch,
    LocalSourcingListItem,
    LocalSourcingRecord,
    LocalSourcingSubmission,
    MetaResponse,
    ProcessReviewRequest,
    ProcessReviewResponse,
    ReturnListItem,
    ReturnRecord,
    ReturnSubmission,
)

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/meta", response_model=MetaResponse)
def meta():
    return MetaResponse(
        categories=[CategoryOption(code=c["code"], name=c["name"]) for c in mock_data.CATEGORIES],
        areas=[
            AreaOption(code=a["code"], name=a["name"], pincode=a["pincode"], climate_zone=a["climate_zone"])
            for a in mock_data.AREAS
        ],
    )


@router.post("/classify", response_model=Classification)
def classify_review(body: ClassifyRequest, request: Request):
    """Classify-only step, used by the storefront to decide whether to ask the
    customer for a refund/replacement preference before finalizing a return."""
    classifier = request.app.state.classifier
    label, confidence = classifier.predict(body.review_text)
    return Classification(label=label, confidence=confidence)


@router.post("/process-review", response_model=ProcessReviewResponse)
def process_review(body: ProcessReviewRequest, request: Request):
    classifier = request.app.state.classifier
    label, confidence = classifier.predict(body.review_text)
    classification = Classification(label=label, confidence=confidence)

    area = mock_data.get_area(body.area_code)
    category = mock_data.get_category(body.category_code)

    if label == "hardware_defect":
        defect = decision.evaluate_defect_resolution(category["name"], body.area_code)
        return ProcessReviewResponse(classification=classification, defect_branch=DefectBranch(**defect))

    demand = decision.evaluate_demand(body.area_code, body.category_code)
    climate = decision.evaluate_climate_fit(body.area_code, body.category_code)
    routing = decision.decide_routing(demand, climate, area, category["name"])

    return ProcessReviewResponse(
        classification=classification,
        dissatisfaction_branch={
            "demand": demand,
            "climate": climate,
            "decision": routing,
        },
    )


@router.post("/returns", response_model=ReturnRecord)
def submit_return(body: ReturnSubmission, request: Request):
    classifier = request.app.state.classifier
    result = decision.process_return(
        classifier,
        body.product,
        body.season,
        body.pincode,
        body.review_text,
        body.preferred_resolution,
        body.suited_climates,
    )
    area = result["area"]

    record = ReturnRecord(
        id=uuid.uuid4().hex[:8],
        submitted_at=datetime.now(timezone.utc).isoformat(),
        product=body.product,
        season=body.season,
        pincode=body.pincode,
        area_code=area["code"],
        area_name=area["name"],
        area_climate_zone=area["climate_zone"],
        review_text=body.review_text,
        classification=result["classification"],
        defect_branch=result["defect_branch"],
        dissatisfaction_branch=result["dissatisfaction_branch"],
        status=result["status"],
        status_label=result["status_label"],
    )
    returns_store.add_return(record)
    return record


@router.get("/returns", response_model=list[ReturnListItem])
def returns_queue():
    return [
        ReturnListItem(
            id=r.id,
            product=r.product,
            area_name=r.area_name,
            area_climate_zone=r.area_climate_zone,
            submitted_at=r.submitted_at,
            status=r.status,
            status_label=r.status_label,
        )
        for r in returns_store.list_returns()
    ]


@router.delete("/returns")
def clear_returns():
    returns_store.clear()
    return {"cleared": True}


@router.get("/returns/{return_id}", response_model=ReturnRecord)
def return_detail(return_id: str):
    record = returns_store.get_return(return_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Return not found")
    return record


@router.post("/local-sourcing", response_model=LocalSourcingRecord)
def submit_local_sourcing(body: LocalSourcingSubmission):
    """Customer hit "Search local shops" on an out-of-stock storefront item.
    Assigns a nearby partner shop + delivery estimate, and logs it for the
    LocalMesh admin panel as a "Contacted Local Service" entry."""
    area = mock_data.resolve_area(body.pincode)
    shop = mock_data.pick_local_shop(area["code"], body.product)
    shop_name = shop["name"] if shop else "Nearby Partner Store"
    eta_days = mock_data.estimate_shop_eta_days(f"{body.product}|{area['code']}")

    record = LocalSourcingRecord(
        id=uuid.uuid4().hex[:8],
        submitted_at=datetime.now(timezone.utc).isoformat(),
        product=body.product,
        qty=body.qty,
        pincode=body.pincode,
        area_code=area["code"],
        area_name=area["name"],
        area_climate_zone=area["climate_zone"],
        shop_name=shop_name,
        eta_days=eta_days,
    )
    sourcing_store.add_request(record)
    return record


@router.get("/local-sourcing", response_model=list[LocalSourcingListItem])
def local_sourcing_queue():
    return [
        LocalSourcingListItem(
            id=r.id,
            product=r.product,
            qty=r.qty,
            area_name=r.area_name,
            area_climate_zone=r.area_climate_zone,
            shop_name=r.shop_name,
            eta_days=r.eta_days,
            submitted_at=r.submitted_at,
            status=r.status,
            status_label=r.status_label,
        )
        for r in sourcing_store.list_requests()
    ]


@router.delete("/local-sourcing")
def clear_local_sourcing():
    sourcing_store.clear()
    return {"cleared": True}


@router.get("/local-sourcing/{request_id}", response_model=LocalSourcingRecord)
def local_sourcing_detail(request_id: str):
    record = sourcing_store.get_request(request_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Sourcing request not found")
    return record
