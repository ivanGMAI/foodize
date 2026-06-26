from typing import Literal

from pydantic import BaseModel, Field


class OrderChatMessageIn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class OrderChatRequest(BaseModel):
    messages: list[OrderChatMessageIn] = Field(min_length=1, max_length=40)
