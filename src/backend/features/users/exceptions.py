from http import HTTPStatus

from shared.exceptions import RuleException


class UserAlreadyExistsException(RuleException):
    status_code = HTTPStatus.CONFLICT
    detail = "User with this phone number already exists"
