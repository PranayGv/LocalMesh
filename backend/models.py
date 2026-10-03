from typing import Literal, Optional

from pydantic import BaseModel, Field

from backend.mock_data import AREAS, CATEGORIES

AreaCode = Literal[tuple(a["code"] for a in AREAS)]
CategoryCode = Literal[tuple(c["code"] for c in CATEGORIES)]


class ProcessReviewRequest(BaseModel):
    review_text: str = Field(min_length=1)
    category_code: CategoryCode
    area_code: AreaCode


class ClassifyRequest(BaseModel):
    review_text: str = Field(min_length=1)


class Classification(BaseModel):
    label: Literal["hardware_defect", "personal_dissatisfaction"]
    confidence: float


class DefectBranch(BaseModel):
    resolution: Literal["refund", "replacement"]
    customer_requested: bool
    resolution_reason: str
    repair_successful: bool
    repair_reason: str
    route: Literal["local_warehouse", "central_warehouse"]


class DemandInfo(BaseModel):
    area_code: str
    category_code: str
    months: list[str]
    counts: list[int]
    recent_avg: float
    prior_avg: float
    growth_pct: float
    threshold: int
    has_demand: bool
    reason: str


class TempScale(BaseModel):
    min_c: int
    max_c: int
    cold_max_c: int
    hot_min_c: int


class ClimateInfo(BaseModel):
    area_code: str
    area_climate_zone: str
    category_suited_climates: list[str]
    is_climate_fit: bool
    reason: str
    avg_temp_c: int
    temp_scale: TempScale


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
    pincode: str
    climate_zone: str


class MetaResponse(BaseModel):
    categories: list[CategoryOption]
    areas: list[AreaOption]


class ReturnSubmission(BaseModel):
    product: str = Field(min_length=1)
    season: Optional[str] = "summer"
    pincode: Optional[str] = ""
    review_text: str = Field(min_length=1)
    # Set by the storefront only when the customer was asked (i.e. the review
    # classified as a hardware defect) and picked one; ignored otherwise.
    preferred_resolution: Optional[Literal["refund", "replacement"]] = None
    # Explicit per-item climate suitability from the storefront catalog. When
    # supplied, overrides the season-based fallback so each product's actual
    # climate fit (e.g. a sweater = Cold only) is used, not an averaged guess.
    suited_climates: Optional[list[Literal["Hot", "Moderate", "Cold"]]] = None


ReturnStatus = Literal["defect_repaired", "defect_hub", "routed_local", "routed_hub"]


class ReturnRecord(BaseModel):
    id: str
    submitted_at: str
    product: str
    season: Optional[str] = None
    pincode: Optional[str] = None
    area_code: str
    area_name: str
    area_climate_zone: str
    review_text: str
    classification: Classification
    defect_branch: Optional[DefectBranch] = None
    dissatisfaction_branch: Optional[DissatisfactionBranch] = None
    status: ReturnStatus
    status_label: str


class ReturnListItem(BaseModel):
    id: str
    product: str
    area_name: str
    area_climate_zone: str
    submitted_at: str
    status: ReturnStatus
    status_label: str
