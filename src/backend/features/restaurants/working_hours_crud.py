import uuid
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from features.restaurants.working_hours import WorkingHours
from features.restaurants.working_hours_schemas import WorkingHoursEntry


async def get_working_hours(session: AsyncSession, restaurant_id: uuid.UUID) -> list[WorkingHours]:
    result = await session.execute(
        select(WorkingHours)
        .where(WorkingHours.restaurant_id == restaurant_id)
        .order_by(WorkingHours.day_of_week)
    )
    return list(result.scalars().all())


async def set_working_hours(
    session: AsyncSession,
    restaurant_id: uuid.UUID,
    entries: list[WorkingHoursEntry],
) -> list[WorkingHours]:
    await session.execute(delete(WorkingHours).where(WorkingHours.restaurant_id == restaurant_id))
    rows = [
        WorkingHours(
            restaurant_id=restaurant_id,
            day_of_week=e.day_of_week,
            open_time=e.open_time,
            close_time=e.close_time,
            is_closed=e.is_closed,
        )
        for e in entries
    ]
    session.add_all(rows)
    await session.commit()
    for r in rows:
        await session.refresh(r)
    return rows


def is_open_now(hours: list[WorkingHours]) -> bool | None:
    if not hours:
        return None
    now = datetime.now(tz=timezone.utc)
    dow = now.weekday()
    current_time = now.strftime("%H:%M")
    for h in hours:
        if h.day_of_week == dow:
            if h.is_closed:
                return False
            return h.open_time <= current_time < h.close_time
    return None
