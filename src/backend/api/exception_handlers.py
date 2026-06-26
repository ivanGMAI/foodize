import json

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

from shared.exceptions.base import AppException
from shared.schemas.error import ErrorDescriptionSchema, ErrorSchema
from utils.logging_setup import get_logger

logger = get_logger()


async def request_validation_error_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content=ErrorSchema(detail=ErrorDescriptionSchema(error=str(exc))).model_dump(),
    )


async def app_exception_handler(request: Request, exc: AppException):
    request_id = getattr(request.state, "request_id", None)
    logger.warning(
        json.dumps(
            {
                "event": "AppException",
                "error": exc.detail,
                "request_id": request_id,
                "path": str(request.url.path),
            }
        )
    )
    return JSONResponse(
        status_code=int(exc.status_code),
        content=ErrorSchema(detail=ErrorDescriptionSchema(error=exc.detail)).model_dump(),
        headers={"X-Request-ID": request_id} if request_id else {},
    )


async def unhandled_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", None)
    logger.exception(
        json.dumps(
            {
                "event": "Exception",
                "error": str(exc),
                "request_id": request_id,
                "path": str(request.url.path),
            }
        )
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=ErrorSchema(
            detail=ErrorDescriptionSchema(error="Internal server error")
        ).model_dump(),
        headers={"X-Request-ID": request_id} if request_id else {},
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorSchema(detail=ErrorDescriptionSchema(error=exc.detail)).model_dump(),
    )


async def integrity_error_handler(request: Request, exc: IntegrityError):
    error_msg = str(exc.orig) if hasattr(exc, "orig") else str(exc)
    request_id = getattr(request.state, "request_id", None)
    logger.warning(
        json.dumps(
            {
                "event": "IntegrityError",
                "error": error_msg,
                "request_id": request_id,
                "path": str(request.url.path),
            }
        )
    )

    friendly_msg = "Duplicate entry: this information already exists."
    if "uq_restaurants_address" in error_msg:
        friendly_msg = "A restaurant with this address already exists."
    elif "uq_users_phone_number" in error_msg:
        friendly_msg = "A user with this phone number already exists."

    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content=ErrorSchema(detail=ErrorDescriptionSchema(error=friendly_msg)).model_dump(),
    )
