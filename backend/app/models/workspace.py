from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, ForeignKeyConstraint, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Text

from app.db.base import Base, Timestamps, UUIDPrimaryKey

STAGES = (
    "Researching",
    "Shortlisted",
    "Applying",
    "Applied",
    "Offer received",
    "Waitlisted",
    "Rejected",
    "Withdrawn",
)


class StudentProfile(Timestamps, Base):
    __tablename__ = "student_profiles"
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    preferences: Mapped[dict[str, Any]] = mapped_column(JSONB)


class WorkspaceEntry(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "workspace_entries"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "college_id",
            "course_id",
            name="uq_workspace_user_option",
            postgresql_nulls_not_distinct=True,
        ),
        ForeignKeyConstraint(
            ["course_id", "college_id"],
            ["courses.id", "courses.college_id"],
            ondelete="CASCADE",
            name="fk_workspace_course_college",
        ),
        CheckConstraint(
            "stage IN (" + ", ".join("'" + stage + "'" for stage in STAGES) + ")",
            name="stage",
        ),
        CheckConstraint("revision > 0", name="revision"),
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
    )
    college_id: Mapped[UUID] = mapped_column(
        ForeignKey("colleges.id", ondelete="CASCADE"),
        index=True,
    )
    course_id: Mapped[UUID | None]
    stage: Mapped[str] = mapped_column(default="Researching", server_default="Researching")
    notes: Mapped[str] = mapped_column(Text, default="", server_default="")
    next_action: Mapped[str] = mapped_column(default="", server_default="")
    target_date: Mapped[date | None]
    scenario: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    revision: Mapped[int] = mapped_column(default=1, server_default="1")


class WorkspaceImport(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "workspace_imports"
    __table_args__ = (UniqueConstraint("user_id", "key", name="uq_workspace_import_key"),)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    key: Mapped[UUID]
    payload_hash: Mapped[str]
    response: Mapped[dict[str, Any]] = mapped_column(JSONB)
