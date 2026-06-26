from http import HTTPStatus

from shared.exceptions import AppException


class InvalidTelegramInitDataException(AppException):
    status_code: int = HTTPStatus.UNAUTHORIZED
    detail: str = "Invalid Telegram initData"


class MalformedTelegramInitDataException(AppException):
    status_code: int = HTTPStatus.BAD_REQUEST
    detail: str = "Malformed Telegram initData"
