from http import HTTPStatus

from shared.exceptions import AppException


class NotFoundException(AppException):
    status_code: int = HTTPStatus.NOT_FOUND
    detail: str = "Object not found"


class AuthException(AppException):
    status_code: int = HTTPStatus.UNAUTHORIZED
    detail: str = "Invalid credentials"


class InvalidCredentialsException(AuthException):
    detail: str = "Invalid phone number or password"


class AlreadyExistsException(AppException):
    status_code: int = HTTPStatus.CONFLICT
    detail: str = "Object already exists"
