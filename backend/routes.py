from fastapi import APIRouter, Request

from backend import decision, mock_data
from backend.models import (
    AreaOption,
    CategoryOption,
    Classification,
    DefectBranch,
    MetaResponse,
    ProcessReviewRequest,
    ProcessReviewResponse,
)

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/meta", response_model=MetaResponse)
def meta():
    return MetaResponse(
        categories=[CategoryOption(code=c["code"], name=c["name"]) for c in mock_data.CATEGORIES],
        areas=[AreaOption(code=a["code"], name=a["name"]) for a in mock_data.AREAS],
    )


@router.post("/process-review", response_model=ProcessReviewResponse)
def process_review(body: ProcessReviewRequest, request: Request):
    classifier = request.app.state.classifier
    label, confidence = classifier.predict(body.review_text)
    classification = Classification(label=label, confidence=confidence)

    if label == "hardware_defect":
        return ProcessReviewResponse(classification=classification, defect_branch=DefectBranch())

    area = mock_data.get_area(body.area_code)
    category = mock_data.get_category(body.category_code)

    demand = decision.evaluate_demand(body.area_code, body.category_code)
    climate = decision.evaluate_climate_fit(body.area_code, body.category_code)
    routing = decision.decide_routing(demand, climate, area["name"], category["name"])

    return ProcessReviewResponse(
        classification=classification,
        dissatisfaction_branch={
            "demand": demand,
            "climate": climate,
            "decision": routing,
        },
    )
