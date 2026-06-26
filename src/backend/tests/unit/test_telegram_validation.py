import hashlib
import hmac
import json
import time
from urllib.parse import urlencode

import pytest

from features.telegram.exceptions import (
    InvalidTelegramInitDataException,
    MalformedTelegramInitDataException,
)
from features.telegram.service import _extract_tg_user, _validate_init_data
from settings.config.app_config import settings


def generate_valid_init_data(
    telegram_id: int = 123456, username: str = "test_user", override_auth_date: int | None = None
) -> str:
    """Generate valid initData with correct hash for testing."""
    auth_date = override_auth_date or int(time.time())
    user_data = json.dumps(
        {
            "id": telegram_id,
            "is_bot": False,
            "first_name": "Test",
            "username": username,
            "language_code": "en",
            "phone_number": "+79991234567",
        }
    )

    data_dict = {
        "user": user_data,
        "auth_date": str(auth_date),
        "query_id": "test_query_123",
    }

    secret_key = hmac.new(
        b"WebAppData",
        settings.telegram.bot_token.encode(),
        hashlib.sha256,
    ).digest()
    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(data_dict.items()))
    hash_value = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    data_dict["hash"] = hash_value

    return urlencode(data_dict)


class TestValidateInitData:
    """Tests for Telegram initData validation."""

    def test_valid_init_data(self):
        """Test that valid initData passes validation."""
        init_data = generate_valid_init_data()
        result = _validate_init_data(init_data)

        assert result is not None
        assert result["user"]
        assert result["auth_date"]

    def test_invalid_hash(self):
        """Test that invalid signature raises exception."""
        auth_date = int(time.time())
        user_data = json.dumps(
            {
                "id": 123456,
                "first_name": "Test",
                "username": "test_user",
            }
        )

        data_dict = {
            "user": user_data,
            "auth_date": str(auth_date),
            "query_id": "test_query_123",
            "hash": "invalid_hash_value",
        }

        init_data = urlencode(data_dict)

        with pytest.raises(InvalidTelegramInitDataException):
            _validate_init_data(init_data)

    def test_expired_init_data(self):
        """Test that expired initData (> 86400s old) raises exception."""
        expired_auth_date = int(time.time()) - (86400 + 3600)
        init_data = generate_valid_init_data(override_auth_date=expired_auth_date)

        with pytest.raises(InvalidTelegramInitDataException):
            _validate_init_data(init_data)

    def test_missing_hash(self):
        """Test that missing hash raises exception."""
        auth_date = int(time.time())
        user_data = json.dumps({"id": 123456, "first_name": "Test"})

        data_dict = {
            "user": user_data,
            "auth_date": str(auth_date),
            "query_id": "test_query_123",
        }

        init_data = urlencode(data_dict)

        with pytest.raises(MalformedTelegramInitDataException):
            _validate_init_data(init_data)

    def test_missing_auth_date(self):
        """Test that missing auth_date raises exception."""
        user_data = json.dumps({"id": 123456, "first_name": "Test"})

        data_dict = {
            "user": user_data,
            "query_id": "test_query_123",
        }

        secret_key = hmac.new(
            b"WebAppData",
            settings.telegram.bot_token.encode(),
            hashlib.sha256,
        ).digest()
        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(data_dict.items()))
        hash_value = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
        data_dict["hash"] = hash_value

        init_data = urlencode(data_dict)

        with pytest.raises(MalformedTelegramInitDataException):
            _validate_init_data(init_data)

    def test_malformed_init_data(self):
        """Test that malformed initData raises exception."""
        malformed_data = "not_a_valid_url_encoded_string!!!@@@"

        with pytest.raises(MalformedTelegramInitDataException):
            _validate_init_data(malformed_data)

    def test_invalid_user_json_is_not_validated_by_init_data(self):
        """Test that _validate_init_data doesn't validate user JSON (just hash)."""
        auth_date = int(time.time())

        data_dict = {
            "user": "not_valid_json",
            "auth_date": str(auth_date),
            "query_id": "test_query_123",
        }

        secret_key = hmac.new(
            b"WebAppData",
            settings.telegram.bot_token.encode(),
            hashlib.sha256,
        ).digest()
        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(data_dict.items()))
        hash_value = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
        data_dict["hash"] = hash_value

        init_data = urlencode(data_dict)

        result = _validate_init_data(init_data)
        assert result is not None


class TestExtractTgUser:
    """Tests for Telegram user extraction."""

    def test_valid_user(self):
        user_data = {"id": 123456, "first_name": "Test"}
        parsed = {"user": json.dumps(user_data)}
        result = _extract_tg_user(parsed)
        assert result["id"] == 123456

    def test_missing_user_id(self):
        user_data = {"first_name": "Test"}
        parsed = {"user": json.dumps(user_data)}
        with pytest.raises(MalformedTelegramInitDataException, match="Missing user id"):
            _extract_tg_user(parsed)

    def test_invalid_json(self):
        parsed = {"user": "not_json"}
        with pytest.raises(MalformedTelegramInitDataException, match="Invalid user payload"):
            _extract_tg_user(parsed)


class TestEdgeCases:
    def test_edge_case_auth_date_exactly_at_limit(self):
        """Test that auth_date exactly at 86400s boundary is rejected."""
        auth_date = int(time.time()) - 86400
        init_data = generate_valid_init_data(override_auth_date=auth_date)

        with pytest.raises(InvalidTelegramInitDataException):
            _validate_init_data(init_data)

    def test_edge_case_auth_date_within_limit(self):
        """Test that auth_date just within limit (86400s) is accepted."""
        auth_date = int(time.time()) - 86399
        init_data = generate_valid_init_data(override_auth_date=auth_date)

        result = _validate_init_data(init_data)
        assert result is not None
