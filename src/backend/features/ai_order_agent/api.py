from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from features.ai_order_agent import service
from features.ai_order_agent.schemas import OrderChatRequest
from features.users.models import User
from middlewares.limiter import limiter
from shared.dependencies import require_permission
from shared.enums.permissions import Permission

router = APIRouter(prefix="/ai/order", tags=["AI Order"])


@router.post("/chat")
@limiter.limit("20/minute")
async def order_chat(
    request: Request,
    body: OrderChatRequest,
    current_user: User = Depends(require_permission(Permission.ORDERS_CREATE)),
) -> StreamingResponse:
    return StreamingResponse(
        service.stream_chat(current_user, body.messages),
        media_type="text/plain; charset=utf-8",
    )
