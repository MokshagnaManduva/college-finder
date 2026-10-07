from datetime import date, datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, field_validator

from app.schemas.base import APIModel
from app.schemas.college import CollegeQuery

Stage = Literal[
    "Researching",
    "Shortlisted",
    "Applying",
    "Applied",
    "Offer received",
    "Waitlisted",
    "Rejected",
    "Withdrawn",
]
Money = Annotated[int, Field(ge=0, le=1_000_000_000, strict=True)]


class Preferences(APIModel):
    degree: str = Field(default="", max_length=100)
    states: list[Annotated[str, Field(max_length=100)]] = Field(default_factory=list, max_length=30)
    budget: Money | None = None
    strict_budget: bool = False
    strict_location: bool = False

    @field_validator("states")
    @classmethod
    def unique_states(cls, value: list[str]) -> list[str]:
        return list(dict.fromkeys(state.strip() for state in value if state.strip()))


class MatchQuery(APIModel):
    query: CollegeQuery = Field(default_factory=CollegeQuery)
    preferences: Preferences


class Scenario(APIModel):
    tuition: Money | None
    living: Money | None
    other: Money | None
    one_time: Money | None


class OptionIn(APIModel):
    college_id: UUID
    course_id: UUID | None = None


class EntryCreate(OptionIn):
    stage: Stage = "Researching"
    notes: str = Field(default="", max_length=4000)
    next_action: str = Field(default="", max_length=300)
    target_date: date | None = None
    scenario: Scenario | None = None


class EntryPatch(APIModel):
    revision: int = Field(ge=1)
    stage: Stage | None = None
    notes: str | None = Field(default=None, max_length=4000)
    next_action: str | None = Field(default=None, max_length=300)
    target_date: date | None = None
    scenario: Scenario | None = None

    @field_validator("stage", "notes", "next_action")
    @classmethod
    def nonnull_fields(cls, value):
        if value is None:
            raise ValueError("This field cannot be null")
        return value


class EntryOut(EntryCreate):
    id: UUID
    revision: int
    created_at: datetime
    updated_at: datetime


class ImportEntry(EntryCreate):
    client_id: UUID


class ImportRequest(APIModel):
    key: UUID
    entries: list[ImportEntry] = Field(max_length=200)


class CompareRequest(APIModel):
    options: list[OptionIn] = Field(min_length=2, max_length=3)
