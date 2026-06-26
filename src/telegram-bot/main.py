import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.webhook.aiohttp_server import SimpleRequestHandler, setup_application
from aiohttp import web

from config import bot_config
from handlers import start
from notifications.consumer import start_notification_consumer


async def main() -> None:
    logging.basicConfig(level=logging.INFO)

    bot = Bot(
        token=bot_config.bot_token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )
    dp = Dispatcher()
    dp.include_router(start.router)

    if bot_config.mode == "webhook":

        async def on_startup(dispatcher: Dispatcher) -> None:
            await bot.set_webhook(
                url=f"{bot_config.webhook_url}/webhook",
                secret_token=bot_config.webhook_secret or None,
            )

        dp.startup.register(on_startup)
        app = web.Application()
        handler = SimpleRequestHandler(
            dispatcher=dp,
            bot=bot,
            secret_token=bot_config.webhook_secret or None,
        )
        handler.register(app, path="/webhook")
        setup_application(app, dp, bot=bot)

        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, "0.0.0.0", 8080)
        await site.start()

        asyncio.create_task(start_notification_consumer(bot))
        await asyncio.Future()
    else:
        asyncio.create_task(start_notification_consumer(bot))
        await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
