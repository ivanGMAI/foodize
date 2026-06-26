"""add restaurant order load controls

Revision ID: a7b8c9d0e1f2
Revises: a1b2c3d4e5f6
Create Date: 2026-05-17 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "a7b8c9d0e1f2"
down_revision: str | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "restaurants",
        sa.Column(
            "is_ordering_paused",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
    )
    op.add_column(
        "restaurants",
        sa.Column("ordering_paused_until", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "restaurants",
        sa.Column(
            "avg_prep_time_minutes",
            sa.Integer(),
            server_default="15",
            nullable=False,
        ),
    )
    op.add_column(
        "restaurants",
        sa.Column("max_active_orders", sa.Integer(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("restaurants", "max_active_orders")
    op.drop_column("restaurants", "avg_prep_time_minutes")
    op.drop_column("restaurants", "ordering_paused_until")
    op.drop_column("restaurants", "is_ordering_paused")
