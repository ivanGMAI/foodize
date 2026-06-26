from pydantic import AmqpDsn

from settings.config.base import BaseConfig


class RabbitMQConfig(BaseConfig):
    url: AmqpDsn | str = "amqp://foodize:foodize@rabbitmq:5672/foodize"
