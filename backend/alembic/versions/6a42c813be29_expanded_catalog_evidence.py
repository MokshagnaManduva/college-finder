"""Evidence for published intake, academic fees and campus facilities."""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "6a42c813be29"
down_revision = "9c71e2f04a88"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "colleges",
        sa.Column("facility_evidence", postgresql.JSONB(), server_default="[]", nullable=False),
    )
    op.drop_constraint(op.f("ck_course_facts_kind"), "course_facts", type_="check")
    op.create_check_constraint(
        op.f("ck_course_facts_kind"),
        "course_facts",
        "kind IN ('tuition', 'duration', 'academicFee', 'seats')",
    )


def downgrade() -> None:
    # These public claims can be restored from the retained catalog; private records stay intact.
    op.execute("DELETE FROM course_facts WHERE kind IN ('academicFee', 'seats')")
    op.drop_constraint(op.f("ck_course_facts_kind"), "course_facts", type_="check")
    op.create_check_constraint(
        op.f("ck_course_facts_kind"),
        "course_facts",
        "kind IN ('tuition', 'duration')",
    )
    op.drop_column("colleges", "facility_evidence")
