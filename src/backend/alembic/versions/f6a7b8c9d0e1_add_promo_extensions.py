"""add promo extensions: first_order_only, min_order_amount, menu_category

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d2
Create Date: 2026-05-09 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "f6a7b8c9d0e1"
down_revision: str | None = "e5f6a7b8c9d2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "promos",
        sa.Column("first_order_only", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "promos",
        sa.Column("min_order_amount", sa.Integer(), nullable=True),
    )
    op.add_column(
        "promos",
        sa.Column("menu_category", sa.String(32), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("promos", "menu_category")
    op.drop_column("promos", "min_order_amount")
    op.drop_column("promos", "first_order_only")
