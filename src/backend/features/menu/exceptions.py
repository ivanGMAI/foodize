from shared.exceptions import NotFoundException


class MenuItemNotFoundException(NotFoundException):
    detail: str = "Menu item not found"
