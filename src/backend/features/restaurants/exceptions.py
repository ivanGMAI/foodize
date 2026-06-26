from http import HTTPStatus

from shared.exceptions import AppException
from shared.exceptions.existence import NotFoundException


class RestaurantNotFoundException(NotFoundException):
    detail: str = "Restaurant not found"


class RestaurantClosedException(AppException):
    status_code: int = HTTPStatus.CONFLICT
    detail: str = "Restaurant is currently closed"
