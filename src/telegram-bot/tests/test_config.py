import os
from unittest.mock import patch
from utils.enums import EventType
from config import BotConfig


def test_enums():
    assert EventType.ORDER_PLACED == "order.placed"
    assert EventType.ORDER_STATUS_CHANGED == "order.status_changed"


def test_config():
    with patch.dict(
        os.environ,
        {
            "BOT_TOKEN": "test_token",
            "BACKEND_URL": "http://test-backend:8000",
            "MINI_APP_URL": "https://t.me/test_bot/app",
            "TELEGRAM_BOT_API_SECRET": "secret",
            "REDIS__URL": "redis://localhost:6379/1",
            "RABBITMQ__URL": "amqp://test",
            "BOT_MODE": "webhook",
            "BOT_WEBHOOK_URL": "https://webhook.url",
            "BOT_WEBHOOK_SECRET": "webhook_secret",
        },
    ):
        cfg = BotConfig()
        assert cfg.bot_token == "test_token"
        assert cfg.backend_url == "http://test-backend:8000"
        assert cfg.mini_app_url == "https://t.me/test_bot/app"
        assert cfg.bot_api_secret == "secret"
        assert cfg.redis_url == "redis://localhost:6379/1"
        assert cfg.rabbitmq_url == "amqp://test"
        assert cfg.mode == "webhook"
        assert cfg.webhook_url == "https://webhook.url"
        assert cfg.webhook_secret == "webhook_secret"
