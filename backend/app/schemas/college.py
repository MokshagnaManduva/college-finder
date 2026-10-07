from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.schemas.base import APIModel


class SourceOut(APIModel):
    id: UUID
    title: str
    status: Literal["demo", "unverified", "verified"]
    url: str | None
    reporting_year: int | None
    verified_at: datetime | None
    document_sha256: str | None = None
    document_format: str | None = None
    notes: str | None = None


class FactOut(APIModel):
    raw_value: float
    raw_unit: str
    factor: int
    normalized_value: int
    notes: str
    reviewer: str
    reviewed_at: datetime
    source: SourceOut
    document_sha256: str | None = None


class CourseOut(APIModel):
    id: UUID
    name: str
    degree: str
    duration_months: int
    annual_tuition: int | None
    fee_basis: Literal["demo-assumption", "reported", "unknown"]
    seats: int | None
    source: SourceOut
    tuition_evidence: FactOut | None = None
    duration_evidence: FactOut | None = None


class PlacementsOut(APIModel):
    avg_package: int | None = None
    highest_package: int | None = None
    placement_rate: float | None = None
    top_recruiters: list[str] = Field(default_factory=list)
    reporting_year: int | None = None
    scope: str | None = None
    median_package: int | None = None
    graduates: int | None = None
    placed: int | None = None
    higher_studies: int | None = None
    source: SourceOut | None = None


class MetricOut(APIModel):
    kind: str
    amount: float
    unit: str
    scope: str | None
    source: SourceOut


class CollegeOut(APIModel):
    id: UUID
    name: str
    slug: str
    location: str
    city: str
    state: str
    type: str
    established: int | None
    description: str
    image: str
    accreditation: str
    facilities: list[str]
    data_status: Literal["demo", "unverified", "verified"]
    courses: list[CourseOut]
    placements: PlacementsOut
    source: SourceOut
    metrics: list[MetricOut]


class CollegeQuery(APIModel):
    search: str = Field(default="", max_length=200)
    state: str = Field(default="", max_length=100)
    degree: str = Field(default="", max_length=100)
    budget: int | None = Field(default=None, ge=0, le=1_000_000_000)
    sort: Literal["name", "tuition", "established"] = "name"
    page: int = Field(default=1, ge=1, le=1_000_000)
    limit: int = Field(default=8, ge=1, le=50)


class CollegesResponse(APIModel):
    data: list[CollegeOut]
    total: int
    total_pages: int
    page: int


class FiltersOut(APIModel):
    states: list[str]
    degrees: list[str]
    tuition_range: dict[str, int | None]
