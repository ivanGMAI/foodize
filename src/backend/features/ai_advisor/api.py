from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse

from features.ai_advisor import service
from features.ai_advisor.schemas import AdvisorChatRequest, AdvisorInsightsResponse
from features.users.models import User
from features.vendors.dependencies import get_current_vendor
from features.vendors.models import VendorProfile
from infra.cache.redis import get_redis_cache
from middlewares.limiter import limiter
from shared.dependencies import require_permission
from shared.enums.permissions import Permission
from shared.response import build_response
from shared.schemas.response import SuccessResponse

router = APIRouter(prefix="/ai/advisor", tags=["AI Advisor"])

_INSIGHTS_TTL_SECONDS = 86_400


@router.post("/chat")
@limiter.limit("20/minute")
async def advisor_chat(
    request: Request,
    body: AdvisorChatRequest,
    _user: User = Depends(require_permission(Permission.VENDORS_ANALYTICS_READ)),
    current_vendor: VendorProfile = Depends(get_current_vendor),
) -> StreamingResponse:
    return StreamingResponse(
        service.stream_chat(current_vendor, body.messages, body.restaurant_id),
        media_type="text/plain; charset=utf-8",
    )


@router.get("/insights", response_model=SuccessResponse[AdvisorInsightsResponse])
@limiter.limit("10/minute")
async def advisor_insights(
    request: Request,
    refresh: bool = Query(False),
    _user: User = Depends(require_permission(Permission.VENDORS_ANALYTICS_READ)),
    current_vendor: VendorProfile = Depends(get_current_vendor),
) -> SuccessResponse[AdvisorInsightsResponse]:
    cache = get_redis_cache()
    key = f"ai:advisor:insights:{current_vendor.id}"

    if not refresh:
        cached = await cache.get(key)
        if cached:
            return build_response(AdvisorInsightsResponse(insights=cached, cached=True))

    text = await service.generate_insights(current_vendor)
    await cache.set(key, text, ttl=_INSIGHTS_TTL_SECONDS)
    return build_response(AdvisorInsightsResponse(insights=text, cached=False))
