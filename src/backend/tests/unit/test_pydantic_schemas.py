import uuid

import pytest
from pydantic import ValidationError

from features.auth.schemas import TokenResponse, UserLogin
from features.orders.schemas.order import OrderCreate
from features.orders.schemas.order_item import OrderItemCreate
from features.users.schemas import UserCreate, UserRead
from shared.enums.permissions import Permission


class TestUserLoginSchema:
    def test_valid_data(self):
        data = UserLogin(phone_number="79001234567", password="strongpass")
        assert data.phone_number == "79001234567"
        assert data.password == "strongpass"

    def test_password_too_short(self):
        with pytest.raises(ValidationError) as exc_info:
            UserLogin(phone_number="79001234567", password="short")
        errors = exc_info.value.errors()
        assert any(e["loc"] == ("password",) for e in errors)

    def test_missing_phone(self):
        with pytest.raises(ValidationError):
            UserLogin(password="strongpass123")

    def test_missing_password(self):
        with pytest.raises(ValidationError):
            UserLogin(phone_number="79001234567")


class TestUserCreateSchema:
    def test_valid_customer(self):
        data = UserCreate(
            name="Ivan",
            phone_number="79001234567",
            password="strongpass",
        )
        assert data.name == "Ivan"
        assert data.phone_number == "79001234567"

    def test_password_min_length(self):
        with pytest.raises(ValidationError):
            UserCreate(
                name="Ivan",
                phone_number="79001234567",
                password="short",
            )

    def test_invalid_phone(self):
        with pytest.raises(ValidationError):
            UserCreate(
                name="Ivan",
                phone_number="abc",
                password="strongpass",
            )


class TestUserReadSchema:
    def test_from_dict(self):
        user_id = uuid.uuid4()
        data = UserRead(
            id=user_id,
            name="Ivan",
            phone_number="79001234567",
            permissions=[Permission.ORDERS_CREATE],
        )
        assert data.id == user_id

    def test_id_must_be_uuid(self):
        with pytest.raises(ValidationError):
            UserRead(
                id="not-a-uuid",
                name="Ivan",
                phone_number="79001234567",
                permissions=[Permission.ORDERS_CREATE],
            )


class TestTokenResponseSchema:
    def test_default_token_type(self):
        resp = TokenResponse(access_token="acc", refresh_token="ref")
        assert resp.token_type == "Bearer"

    def test_custom_fields(self):
        resp = TokenResponse(access_token="a", refresh_token="r", token_type="bearer")
        assert resp.access_token == "a"
        assert resp.refresh_token == "r"


class TestOrderCreateSchema:
    def test_valid_order(self):
        item = OrderItemCreate(menu_item_id=uuid.uuid4(), quantity=2)
        order = OrderCreate(restaurant_id=uuid.uuid4(), items=[item])
        assert len(order.items) == 1
        assert order.items[0].quantity == 2

    def test_empty_items_list(self):
        with pytest.raises(ValidationError):
            OrderCreate(restaurant_id=uuid.uuid4(), items=[])
