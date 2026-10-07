from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from pydantic import (
    AwareDatetime,
    Field,
    HttpUrl,
    StrictFloat,
    StrictInt,
    field_validator,
    model_validator,
)

from app.schemas.base import APIModel


class ReviewedSource(APIModel):
    title: str = Field(min_length=1, max_length=300)
    url: HttpUrl
    reporting_year: int | None = Field(default=None, ge=2000, le=2100)
    verified_at: AwareDatetime
    reviewer: str = Field(min_length=1, max_length=200)
    document_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    document_format: Literal["pdf", "html"] = "pdf"

    @model_validator(mode="after")
    def evidence(self):
        if self.url.scheme != "https" or self.url.username or self.url.password:
            raise ValueError("Reviewed sources require HTTPS without embedded credentials")
        if self.verified_at > datetime.now(UTC):
            raise ValueError("Review date cannot be in the future")
        if not self.title.strip() or not self.reviewer.strip():
            raise ValueError("Source title and reviewer cannot be blank")
        return self


class ReviewedFact(APIModel):
    kind: Literal["tuition", "duration"]
    raw_value: StrictInt | StrictFloat = Field(ge=0, le=500_000_000)
    raw_unit: Literal["INR/semester", "INR/year", "INR/installment", "months", "years", "semesters"]
    notes: str = Field(min_length=1, max_length=2000)
    source: ReviewedSource

    @model_validator(mode="after")
    def compatible_units(self):
        if not self.notes.strip():
            raise ValueError("Specify source scope and any normalization assumptions")
        if self.kind == "duration":
            if (
                self.raw_unit not in ("months", "years", "semesters")
                or not 1 <= self.normalized_value <= 144
            ):
                raise ValueError("Duration must be 1–144 months")
        elif self.raw_unit in ("months", "years", "semesters"):
            raise ValueError("Tuition requires an INR fee period")
        if round(self.raw_value, 2) != self.raw_value:
            raise ValueError("Original values support at most two decimal places")
        if self.raw_value * self.factor != int(self.raw_value * self.factor):
            raise ValueError("Claims must normalize to whole INR or months")
        return self

    @property
    def factor(self):
        return {"INR/semester": 2, "INR/installment": 2, "years": 12, "semesters": 6}.get(
            self.raw_unit, 1
        )

    @property
    def normalized_value(self):
        return int(self.raw_value * self.factor)


class ReviewedCourse(APIModel):
    college_slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    course_id: UUID
    facts: list[ReviewedFact] = Field(min_length=1, max_length=2)

    @field_validator("facts")
    @classmethod
    def distinct_claims(cls, facts):
        if len({fact.kind for fact in facts}) != len(facts):
            raise ValueError("Each course claim can appear only once")
        return facts


class ReviewManifest(APIModel):
    version: Literal[1]
    courses: list[ReviewedCourse] = Field(min_length=1, max_length=1000)

    @field_validator("courses")
    @classmethod
    def distinct_courses(cls, courses):
        if len({course.course_id for course in courses}) != len(courses):
            raise ValueError("Each course can appear only once")
        return courses
