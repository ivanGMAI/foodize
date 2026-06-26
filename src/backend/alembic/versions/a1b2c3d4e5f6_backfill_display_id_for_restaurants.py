"""Backfill display_id for existing restaurants

Revision ID: a1b2c3d4e5f6
Revises: 62da7dbc720a
Branch Labels: None
Depends On: None

"""

import secrets
from typing import Sequence, Union

from sqlalchemy import text

from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "62da7dbc720a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(text("SELECT id FROM restaurants WHERE display_id IS NULL")).fetchall()
    for row in rows:
        while True:
            candidate = secrets.token_hex(4)
            exists = conn.execute(
                text("SELECT 1 FROM restaurants WHERE display_id = :d"),
                {"d": candidate},
            ).fetchone()
            if not exists:
                conn.execute(
                    text("UPDATE restaurants SET display_id = :d WHERE id = :id"),
                    {"d": candidate, "id": row[0]},
                )
                break


def downgrade() -> None:
    pass
