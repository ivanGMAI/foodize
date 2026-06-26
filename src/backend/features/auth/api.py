from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from database import db_helper
from features.auth import service
from features.auth.schemas import TokenResponse, UserLogin
from features.users.schemas import UserCreate, UserRead
from middlewares.limiter import limiter
from settings.config.app_config import settings
from shared.response import build_response
from shared.schemas.response import SuccessResponse

router = APIRouter(tags=["Auth"])


@router.post("/register", response_model=SuccessResponse[UserRead])
@limiter.limit(lambda: settings.auth.rate_limit_register)
async def create_registration(
    request: Request,
    user_in: UserCreate,
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[UserRead]:
    result = await service.register_user(session=session, user_data=user_in)
    return build_response(result)


@router.post("/login", response_model=SuccessResponse[TokenResponse])
@limiter.limit(lambda: settings.auth.rate_limit_login)
async def create_login(
    request: Request,
    response: Response,
    user_in: UserLogin,
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[TokenResponse]:
    result = await service.login_user(session=session, user_data=user_in, response=response)
    return build_response(result)


@router.post("/refresh", response_model=SuccessResponse[TokenResponse])
async def create_refresh(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[TokenResponse]:
    result = await service.refresh_user_token(request=request, response=response, session=session)
    return build_response(result)


@router.post("/logout", status_code=204)
async def create_logout(request: Request, response: Response) -> None:
    await service.logout_user(request=request, response=response)
