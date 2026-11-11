"""Credential version so password changes revoke earlier sign-ins."""

import sqlalchemy as sa

from alembic import op

revision = "b3f1d7a9c2e4"
down_revision = "6a42c813be29"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("token_version", sa.Integer(), server_default="0", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("users", "token_version")
