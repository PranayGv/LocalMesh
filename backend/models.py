from typing import Literal, Optional

from pydantic import BaseModel, Field

from backend.mock_data import AREAS, CATEGORIES

AreaCode = Literal[tuple(a["code"] for a in AREAS)]
CategoryCode = Literal[tuple(c["code"] for c in CATEGORIES)]


class ProcessReviewRequest(BaseModel):
    review_text: str = Field(min_length=1)
    category_code: CategoryCode
    area_code: AreaCode


class Classification(BaseModel):
    label: Literal["hardware_defect", "personal_dissatisfaction"]
    confidence: float


class DefectBranch(BaseModel):
    implemented: bool = False
    message: str = (
        "Hardware defect handling (repair / service-center routing) is not implemented yet. "
        "Coming in a future release."
    )


class DemandInfo(BaseModel):
    area_code: str
    category_code: str
    months: list[str]
    counts: list[int]
    recent_avg: float
    prior_avg: float
    has_demand: bool
    reason: str


class ClimateInfo(BaseModel):
    area_climate_zone: str
    category_suited_climates: list[str]
    is_climate_fit: bool
    reason: str


class Decision(BaseModel):
    route: Literal["local_warehouse", "central_hub"]
    driver: Literal["demand", "climate_fit", "none"]
    reason: str


class DissatisfactionBranch(BaseModel):
    demand: DemandInfo
    climate: ClimateInfo
    decision: Decision


class ProcessReviewResponse(BaseModel):
    classification: Classification
    defect_branch: Optional[DefectBranch] = None
    dissatisfaction_branch: Optional[DissatisfactionBranch] = None


class CategoryOption(BaseModel):
    code: str
    name: str


class AreaOption(BaseModel):
    code: str
    name: str


class MetaResponse(BaseModel):
    categories: list[CategoryOption]
    areas: list[AreaOption]
