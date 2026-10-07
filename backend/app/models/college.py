from datetime import datetime
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import DateTime, Numeric, Text

from app.db.base import Base, Timestamps, UUIDPrimaryKey


class DataSource(UUIDPrimaryKey, Base):
    __tablename__ = "data_sources"
    __table_args__ = (
        CheckConstraint("status IN ('demo', 'unverified', 'verified')", name="status"),
        CheckConstraint(
            "status != 'verified' OR (url IS NOT NULL AND verified_at IS NOT NULL)",
            name="verified_evidence",
        ),
    )
    title: Mapped[str]
    status: Mapped[str]
    url: Mapped[str | None]
    reporting_year: Mapped[int | None]
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class College(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "colleges"
    name: Mapped[str]
    slug: Mapped[str] = mapped_column(unique=True)
    location: Mapped[str]
    city: Mapped[str]
    state: Mapped[str] = mapped_column(index=True)
    type: Mapped[str] = mapped_column(index=True)
    established: Mapped[int]
    description: Mapped[str] = mapped_column(Text)
    image: Mapped[str] = mapped_column(default="", server_default="")
    accreditation: Mapped[str] = mapped_column(default="", server_default="")
    facilities: Mapped[list[str]] = mapped_column(ARRAY(Text))
    source_id: Mapped[UUID] = mapped_column(ForeignKey("data_sources.id"))
    source: Mapped[DataSource] = relationship(lazy="raise")

    courses: Mapped[list["Course"]] = relationship(
        back_populates="college",
        cascade="all, delete-orphan",
        lazy="raise",
        order_by="Course.position",
    )
    metrics: Mapped[list["CollegeMetric"]] = relationship(
        cascade="all, delete-orphan",
        lazy="raise",
    )


class Course(UUIDPrimaryKey, Base):
    __tablename__ = "courses"
    __table_args__ = (
        UniqueConstraint("id", "college_id", name="uq_course_college_pair"),
        CheckConstraint("duration_months > 0", name="duration"),
        CheckConstraint("annual_tuition IS NULL OR annual_tuition >= 0", name="tuition"),
        CheckConstraint(
            "fee_basis IN ('demo-assumption', 'reported', 'unknown')",
            name="fee_basis",
        ),
    )
    college_id: Mapped[UUID] = mapped_column(
        ForeignKey("colleges.id", ondelete="CASCADE"),
        index=True,
    )
    name: Mapped[str]
    degree: Mapped[str] = mapped_column(index=True)
    duration_months: Mapped[int]
    annual_tuition: Mapped[int | None] = mapped_column(index=True)
    fee_basis: Mapped[str]
    seats: Mapped[int | None]
    position: Mapped[int]
    source_id: Mapped[UUID] = mapped_column(ForeignKey("data_sources.id"))
    college: Mapped[College] = relationship(back_populates="courses", lazy="raise")
    source: Mapped[DataSource] = relationship(lazy="raise")
    facts: Mapped[list["CourseFact"]] = relationship(lazy="raise", cascade="all, delete-orphan")


class CourseFact(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "course_facts"
    __table_args__ = (
        UniqueConstraint("course_id", "kind", name="uq_course_fact_kind"),
        CheckConstraint("kind IN ('tuition', 'duration')", name="kind"),
        CheckConstraint("raw_value >= 0 AND normalized_value >= 0", name="values"),
        CheckConstraint("factor > 0", name="factor"),
    )
    course_id: Mapped[UUID] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"))
    kind: Mapped[str]
    raw_value: Mapped[int]
    raw_unit: Mapped[str]
    factor: Mapped[int]
    normalized_value: Mapped[int]
    notes: Mapped[str] = mapped_column(Text)
    reviewer: Mapped[str]
    reviewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    payload: Mapped[dict] = mapped_column(JSONB)
    source_id: Mapped[UUID] = mapped_column(ForeignKey("data_sources.id"))
    source: Mapped[DataSource] = relationship(lazy="raise")

    @property
    def document_sha256(self) -> str | None:
        return self.payload.get("source", {}).get("documentSha256")


class CollegeMetric(UUIDPrimaryKey, Base):
    __tablename__ = "college_metrics"
    __table_args__ = (
        UniqueConstraint("college_id", "kind", name="uq_college_metric_kind"),
        CheckConstraint("amount >= 0", name="nonnegative"),
    )
    college_id: Mapped[UUID] = mapped_column(
        ForeignKey("colleges.id", ondelete="CASCADE"),
        index=True,
    )
    kind: Mapped[str]
    amount: Mapped[float] = mapped_column(Numeric(14, 2))
    unit: Mapped[str]
    scope: Mapped[str | None]
    source_id: Mapped[UUID] = mapped_column(ForeignKey("data_sources.id"))
    source: Mapped[DataSource] = relationship(lazy="raise")
