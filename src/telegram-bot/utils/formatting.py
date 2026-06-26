_STATUS_LABELS: dict[str, str] = {
    "PENDING": "Ожидает подтверждения",
    "ACCEPTED": "Принят рестораном",
    "COOKING": "Готовится",
    "READY": "Готов к выдаче",
    "COMPLETED": "Выполнен",
    "CANCELLED": "Отменён",
}


def format_price(cents: int) -> str:
    return f"{cents // 100},{cents % 100:02d} ₽"


def format_status(status: str) -> str:
    return _STATUS_LABELS.get(status, status)
