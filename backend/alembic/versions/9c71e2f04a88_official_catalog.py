"""Official catalog provenance and archive state; preserve all private references."""

import sqlalchemy as sa

from alembic import op

revision = "9c71e2f04a88"
down_revision = "169d54a90cfc"
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column(
        "course_facts", "raw_value", type_=sa.Numeric(14, 2), postgresql_using="raw_value::numeric"
    )
    op.alter_column("colleges", "established", nullable=True)
    op.add_column("colleges", sa.Column("catalog_release", sa.String(), nullable=True))
    op.add_column(
        "courses", sa.Column("published", sa.Boolean(), server_default=sa.true(), nullable=False)
    )
    for name in ("document_sha256", "document_format"):
        op.add_column("data_sources", sa.Column(name, sa.String(), nullable=True))
    op.add_column("data_sources", sa.Column("notes", sa.Text(), nullable=True))
    op.create_table(
        "catalog_releases",
        sa.Column("version", sa.String(), primary_key=True),
        sa.Column("manifest_sha256", sa.String(), nullable=False),
        sa.Column(
            "applied_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )


def downgrade():
    # Unknown establishment years cannot safely be invented by downgrading.
    connection = op.get_bind()
    if connection.scalar(sa.text("SELECT count(*) FROM colleges WHERE established IS NULL")):
        raise RuntimeError("Restore sourced establishment years before downgrading")
    if connection.scalar(
        sa.text("SELECT count(*) FROM course_facts WHERE raw_value != trunc(raw_value)")
    ):
        raise RuntimeError("Fractional original claims cannot be represented by the old schema")
    op.alter_column(
        "course_facts", "raw_value", type_=sa.Integer(), postgresql_using="raw_value::integer"
    )
    op.drop_table("catalog_releases")
    op.drop_column("data_sources", "notes")
    op.drop_column("data_sources", "document_format")
    op.drop_column("data_sources", "document_sha256")
    op.drop_column("courses", "published")
    op.drop_column("colleges", "catalog_release")
    op.alter_column("colleges", "established", nullable=False)
