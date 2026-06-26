from http import HTTPStatus

from shared.exceptions import AppException, NotFoundException


class PromoNotFoundException(NotFoundException):
    detail: str = "Promo code not found"


class PromoNotActiveException(AppException):
    status_code: int = HTTPStatus.UNPROCESSABLE_ENTITY
    detail: str = "Promo code is not active or has expired"


class PromoRestaurantMismatchException(AppException):
    status_code: int = HTTPStatus.UNPROCESSABLE_ENTITY
    detail: str = "Promo code is not valid for this restaurant"


class PromoUsageLimitException(AppException):
    status_code: int = HTTPStatus.UNPROCESSABLE_ENTITY
    detail: str = "Promo code usage limit has been reached"


class PromoAlreadyExistsException(AppException):
    status_code: int = HTTPStatus.CONFLICT
    detail: str = "Promo code already exists"
