from enum import Enum


class UserRole(str, Enum):
    CUSTOMER = "CUSTOMER"
    VENDOR = "VENDOR"
    STAFF = "STAFF"
    ADMIN = "ADMIN"
