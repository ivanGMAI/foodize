from http import HTTPStatus

from shared.exceptions import RuleException


class VendorAlreadyExistsException(RuleException):
    status_code = HTTPStatus.CONFLICT
    detail = "User already has a vendor profile"
