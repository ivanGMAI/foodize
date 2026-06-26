from utils.formatting import format_price, format_status


def test_format_price():
    assert format_price(100) == "1,00 ₽"
    assert format_price(1050) == "10,50 ₽"
    assert format_price(99) == "0,99 ₽"


def test_format_status():
    assert format_status("PENDING") == "Ожидает подтверждения"
    assert format_status("COOKING") == "Готовится"
    assert format_status("UNKNOWN") == "UNKNOWN"
