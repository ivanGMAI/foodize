import uuid
from datetime import datetime, timezone
from unittest.mock import patch

from utils.JWT import (
    create_access_token,
    create_jwt_token,
    create_refresh_token,
    decode_jwt,
    encode_jwt,
    hash_password,
    validate_password,
)


class TestPasswordHashing:
    def test_hash_differs_from_plain(self):
        plain = "supersecret123"
        hashed = hash_password(plain)
        assert hashed != plain

    def test_correct_password_validates(self):
        plain = "supersecret123"
        hashed = hash_password(plain)
        assert validate_password(plain, hashed) is True

    def test_wrong_password_rejected(self):
        hashed = hash_password("supersecret123")
        assert validate_password("wrongpassword1", hashed) is False

    def test_empty_password_hashed(self):
        hashed = hash_password("")
        assert isinstance(hashed, str)
        assert validate_password("", hashed) is True

    def test_two_hashes_of_same_password_differ(self):
        plain = "samepassword1"
        h1 = hash_password(plain)
        h2 = hash_password(plain)
        assert h1 != h2


class TestEncodeDecodeJwt:
    def test_encode_calls_jwt_encode(self):
        payload = {"sub": "abc", "exp": 9999999999}
        with patch("utils.JWT.jwt.encode", return_value="tok") as mock_enc:
            with patch("utils.JWT.settings.auth.private_key_path") as mock_path:
                mock_path.read_text.return_value = "private-key"
                result = encode_jwt(payload)
        assert result == "tok"
        mock_enc.assert_called_once()

    def test_decode_calls_jwt_decode(self):
        expected = {"sub": str(uuid.uuid4()), "phone": "79001234567"}
        with patch("utils.JWT.jwt.decode", return_value=expected) as mock_dec:
            with patch("utils.JWT.settings.auth.public_key_path") as mock_path:
                mock_path.read_text.return_value = "public-key"
                result = decode_jwt("some.jwt.token")
        assert result == expected
        mock_dec.assert_called_once()

    def test_decode_accepts_explicit_public_key(self):
        expected = {"sub": "user-123"}
        with patch("utils.JWT.jwt.decode", return_value=expected):
            result = decode_jwt("some.jwt.token", public_key="explicit-key")
        assert result["sub"] == "user-123"


class TestCreateJwtToken:
    def test_payload_contains_required_fields(self):
        user_id = uuid.uuid4()
        phone = "79009998877"
        captured: dict = {}

        def fake_encode(payload, private_key=None, algorithm=None):
            captured.update(payload)
            return "mocked-token"

        with patch("utils.JWT.encode_jwt", side_effect=fake_encode):
            token = create_jwt_token(user_id=user_id, phone_number=phone, lifetime_seconds=3600)

        assert token == "mocked-token"
        assert captured["sub"] == str(user_id)
        assert captured["phone"] == phone
        assert "exp" in captured
        assert "iat" in captured

    def test_expiry_is_in_future(self):
        user_id = uuid.uuid4()
        captured: dict = {}

        def fake_encode(payload, private_key=None, algorithm=None):
            captured.update(payload)
            return "tok"

        with patch("utils.JWT.encode_jwt", side_effect=fake_encode):
            create_jwt_token(user_id=user_id, phone_number="79001112233", lifetime_seconds=60)

        now = datetime.now(timezone.utc)
        assert captured["exp"] > now


class TestAccessRefreshTokens:
    def test_access_token_delegates_to_create_jwt_token(self):
        user_id = uuid.uuid4()
        with patch("utils.JWT.create_jwt_token", return_value="access") as mock_create:
            result = create_access_token(user_id=user_id, phone_number="79001234567")
        assert result == "access"
        args = mock_create.call_args
        assert args.kwargs["user_id"] == user_id
        assert args.kwargs["phone_number"] == "79001234567"
        assert "lifetime_seconds" in args.kwargs

    def test_refresh_token_delegates_to_create_jwt_token(self):
        user_id = uuid.uuid4()
        with patch("utils.JWT.create_jwt_token", return_value="refresh") as mock_create:
            result = create_refresh_token(user_id=user_id, phone_number="79001234567")
        assert result == "refresh"
        mock_create.assert_called_once()

    def test_access_and_refresh_use_different_lifetimes(self):
        user_id = uuid.uuid4()
        access_lifetime: list[int] = []
        refresh_lifetime: list[int] = []

        def capture_access(**kwargs):
            access_lifetime.append(kwargs["lifetime_seconds"])
            return "access"

        def capture_refresh(**kwargs):
            refresh_lifetime.append(kwargs["lifetime_seconds"])
            return "refresh"

        with patch("utils.JWT.create_jwt_token", side_effect=capture_access):
            create_access_token(user_id=user_id, phone_number="7900")

        with patch("utils.JWT.create_jwt_token", side_effect=capture_refresh):
            create_refresh_token(user_id=user_id, phone_number="7900")

        assert access_lifetime[0] < refresh_lifetime[0]
