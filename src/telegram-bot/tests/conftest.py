import os

os.environ["BOT_TOKEN"] = "test_bot_token"
os.environ["BACKEND_URL"] = "http://localhost:8000"
os.environ["MINI_APP_URL"] = "https://t.me/app"
os.environ["TELEGRAM_BOT_API_SECRET"] = "secret"
os.environ["REDIS__URL"] = "redis://localhost:6379/0"
os.environ["RABBITMQ__URL"] = "amqp://test"
os.environ["BOT_MODE"] = "polling"
