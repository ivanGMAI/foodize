import uuid
from unittest.mock import MagicMock

import pytest

from features.orders.services.order import _validate_item_options
from shared.enums.selection_type import SelectionType
from shared.exceptions import BadRequestException


def _group(
    *,
    menu_item_id: uuid.UUID,
    is_required: bool = False,
    min_selected: int = 0,
    max_selected: int | None = None,
    selection_type: str = SelectionType.MULTIPLE.value,
    is_active: bool = True,
):
    group = MagicMock()
    group.id = uuid.uuid4()
    group.menu_item_id = menu_item_id
    group.name = "Sauce"
    group.is_required = is_required
    group.min_selected = min_selected
    group.max_selected = max_selected
    group.selection_type = selection_type
    group.is_active = is_active
    return group


def _option(group, *, is_available: bool = True):
    option = MagicMock()
    option.id = uuid.uuid4()
    option.group_id = group.id
    option.group = group
    option.is_available = is_available
    return option


def _menu_item(*groups):
    item = MagicMock()
    item.id = uuid.uuid4()
    item.option_groups = list(groups)
    for group in groups:
        group.menu_item_id = item.id
    return item


def _item_data(*selected_ids):
    data = MagicMock()
    data.selected_option_ids = list(selected_ids)
    return data


def test_validate_item_options_accepts_valid_selection():
    group = _group(menu_item_id=uuid.uuid4(), is_required=True, max_selected=2)
    menu_item = _menu_item(group)
    option = _option(group)

    result = _validate_item_options(_item_data(option.id), menu_item, {option.id: option})

    assert result == [option]


def test_validate_item_options_rejects_duplicate_option_ids():
    group = _group(menu_item_id=uuid.uuid4())
    menu_item = _menu_item(group)
    option = _option(group)

    with pytest.raises(BadRequestException, match="Duplicate options selected"):
        _validate_item_options(_item_data(option.id, option.id), menu_item, {option.id: option})


def test_validate_item_options_rejects_missing_required_group():
    group = _group(menu_item_id=uuid.uuid4(), is_required=True)
    menu_item = _menu_item(group)

    with pytest.raises(BadRequestException, match="Not enough options selected"):
        _validate_item_options(_item_data(), menu_item, {})


def test_validate_item_options_rejects_too_many_options():
    group = _group(menu_item_id=uuid.uuid4(), max_selected=1)
    menu_item = _menu_item(group)
    option_1 = _option(group)
    option_2 = _option(group)

    with pytest.raises(BadRequestException, match="Too many options selected"):
        _validate_item_options(
            _item_data(option_1.id, option_2.id),
            menu_item,
            {option_1.id: option_1, option_2.id: option_2},
        )


def test_validate_item_options_rejects_multiple_values_for_single_group():
    group = _group(
        menu_item_id=uuid.uuid4(),
        selection_type=SelectionType.SINGLE.value,
    )
    menu_item = _menu_item(group)
    option_1 = _option(group)
    option_2 = _option(group)

    with pytest.raises(BadRequestException, match="Only one option can be selected"):
        _validate_item_options(
            _item_data(option_1.id, option_2.id),
            menu_item,
            {option_1.id: option_1, option_2.id: option_2},
        )


def test_validate_item_options_rejects_option_from_another_menu_item():
    group = _group(menu_item_id=uuid.uuid4())
    menu_item = _menu_item()
    option = _option(group)

    with pytest.raises(BadRequestException, match="does not belong"):
        _validate_item_options(_item_data(option.id), menu_item, {option.id: option})


def test_validate_item_options_rejects_unavailable_option():
    group = _group(menu_item_id=uuid.uuid4())
    menu_item = _menu_item(group)
    option = _option(group, is_available=False)

    with pytest.raises(BadRequestException, match="not available"):
        _validate_item_options(_item_data(option.id), menu_item, {option.id: option})
