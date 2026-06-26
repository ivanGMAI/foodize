from shared.exceptions.base import AppException


class AlreadyFavoritedException(AppException):
    status_code = 409
    detail = "Restaurant is already in favorites"


class FavoriteNotFoundException(AppException):
    status_code = 404
    detail = "Favorite not found"
