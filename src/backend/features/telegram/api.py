import logging
import secrets
from http import HTTPStatus

from fastapi import APIRouter, Depends, Header, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from database import db_helper
from features.auth.schemas import TokenResponse
from features.auth.service import get_current_user
from features.telegram import service
from features.telegram.schemas import (
    TelegramBotLinkRequest,
    TelegramBotOrdersRequest,
    TelegramBotOrderSummary,
    TelegramBotVendorStatusRequest,
    TelegramBotVendorStatusResponse,
    TelegramCheckRequest,
    TelegramCheckResponse,
    TelegramRegisterRequest,
    TelegramSiteLoginResponse,
    TelegramSiteLoginStartRequest,
    TelegramSiteLoginStartResponse,
    TelegramSiteLoginVerifyRequest,
    TelegramSitePasswordRequest,
)
from features.users.models import User
from features.users.schemas import UserRead
from infra.cache.redis import get_redis_cache
from settings.config.app_config import settings
from shared.exceptions import AccessDeniedException
from shared.response import build_response
from shared.schemas.response import (
    Pagination,
    SuccessListResponse,
    SuccessResponse,
)

router = APIRouter(prefix="/telegram", tags=["Telegram"])
logger = logging.getLogger(__name__)


@router.post("/check", response_model=SuccessResponse[TelegramCheckResponse])
async def telegram_check(
    data: TelegramCheckRequest,
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[TelegramCheckResponse]:
    result = await service.telegram_check(session=session, init_data=data.init_data)
    return build_response(result)


@router.post("/register", response_model=SuccessResponse[TokenResponse])
async def telegram_register(
    data: TelegramRegisterRequest,
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[TokenResponse]:
    result = await service.telegram_register(
        session=session,
        init_data=data.init_data,
        phone_number=data.phone_number,
        name=data.name,
    )
    return build_response(result)


@router.post("/auth", response_model=SuccessResponse[TokenResponse])
async def telegram_auth(
    data: TelegramCheckRequest,
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[TokenResponse]:
    result = await service.telegram_auth_existing(session=session, init_data=data.init_data)
    return build_response(result)


@router.post(
    "/site-login/request-code",
    response_model=SuccessResponse[TelegramSiteLoginStartResponse],
)
async def telegram_site_login_request_code(
    data: TelegramSiteLoginStartRequest,
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[TelegramSiteLoginStartResponse]:
    await service.request_site_login_code(session=session, phone_number=data.phone_number)
    return build_response(TelegramSiteLoginStartResponse())


@router.post(
    "/site-login/verify",
    response_model=SuccessResponse[TelegramSiteLoginResponse],
)
async def telegram_site_login_verify(
    data: TelegramSiteLoginVerifyRequest,
    response: Response,
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[TelegramSiteLoginResponse]:
    result = await service.verify_site_login_code(
        session=session,
        phone_number=data.phone_number,
        code=data.code,
        response=response,
    )
    return build_response(result)


@router.post("/site-login/password", response_model=SuccessResponse[UserRead])
async def telegram_site_login_set_password(
    data: TelegramSitePasswordRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[UserRead]:
    result = await service.set_site_password(
        session=session,
        user=current_user,
        password=data.password,
    )
    return build_response(UserRead.model_validate(result))


@router.post("/logout", response_model=SuccessResponse[UserRead])
async def telegram_logout(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[UserRead]:
    result = await service.unlink_telegram_for_user(session=session, user=current_user)
    return build_response(UserRead.model_validate(result))


@router.post("/bot/link-phone", response_model=SuccessResponse[UserRead])
async def telegram_bot_link_phone(
    data: TelegramBotLinkRequest,
    x_telegram_bot_secret: str = Header("", alias="X-Telegram-Bot-Secret"),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[UserRead]:
    if not settings.telegram.bot_api_secret or not secrets.compare_digest(
        settings.telegram.bot_api_secret, x_telegram_bot_secret
    ):
        raise AccessDeniedException(detail="Invalid bot secret")

    redis = get_redis_cache().get_raw_client()
    key = f"rl:link_phone:{data.telegram_id}"
    reqs = await redis.incr(key)
    if reqs == 1:
        await redis.expire(key, 3600)
    if reqs > 5:
        logger.warning("telegram link-phone rate limit exceeded: telegram_id=%s", data.telegram_id)
        raise HTTPException(status_code=HTTPStatus.TOO_MANY_REQUESTS, detail="Rate limit exceeded")

    result = await service.link_phone_from_bot(
        session=session,
        telegram_id=data.telegram_id,
        telegram_username=data.telegram_username,
        phone_number=data.phone_number,
        name=data.name,
    )
    return build_response(UserRead.model_validate(result))


@router.post(
    "/bot/vendor-status",
    response_model=SuccessResponse[TelegramBotVendorStatusResponse],
)
async def telegram_bot_vendor_status(
    data: TelegramBotVendorStatusRequest,
    x_telegram_bot_secret: str = Header("", alias="X-Telegram-Bot-Secret"),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[TelegramBotVendorStatusResponse]:
    if not settings.telegram.bot_api_secret or not secrets.compare_digest(
        settings.telegram.bot_api_secret, x_telegram_bot_secret
    ):
        raise AccessDeniedException(detail="Invalid bot secret")

    vendor = await service.get_vendor_status_for_telegram_id(
        session=session,
        telegram_id=data.telegram_id,
    )
    if not vendor:
        return build_response(TelegramBotVendorStatusResponse(is_vendor=False))

    return build_response(
        TelegramBotVendorStatusResponse(
            is_vendor=True,
            approval_status=vendor.approval_status,
            rejection_reason=vendor.rejection_reason,
        )
    )


@router.post(
    "/bot/orders",
    response_model=SuccessListResponse[TelegramBotOrderSummary],
)
async def telegram_bot_orders(
    data: TelegramBotOrdersRequest,
    x_telegram_bot_secret: str = Header("", alias="X-Telegram-Bot-Secret"),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessListResponse[TelegramBotOrderSummary]:
    if not settings.telegram.bot_api_secret or not secrets.compare_digest(
        settings.telegram.bot_api_secret, x_telegram_bot_secret
    ):
        raise AccessDeniedException(detail="Invalid bot secret")

    orders = await service.get_active_orders_for_telegram_id(
        session=session,
        telegram_id=data.telegram_id,
        limit=3,
    )
    data_out = [
        TelegramBotOrderSummary(
            id=str(order.id),
            display_id=order.display_id,
            status=order.status,
            restaurant_name=order.restaurant.name if order.restaurant else None,
            total_price=order.total_price,
            created_at=order.created_at,
        )
        for order in orders
    ]
    return SuccessListResponse(
        data=data_out,
        pagination=Pagination(
            current_page=1,
            per_page=3,
            total=len(data_out),
            total_pages=1 if data_out else 0,
            next=None,
            previous=None,
        ),
    )
