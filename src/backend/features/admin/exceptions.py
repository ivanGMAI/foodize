from http import HTTPStatus

from shared.exceptions import RuleException


class AdminAccessDeniedException(RuleException):
    status_code = HTTPStatus.FORBIDDEN
    detail = "Admin access required"
