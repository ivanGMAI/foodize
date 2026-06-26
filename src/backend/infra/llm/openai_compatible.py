"""OpenAI-compatible implementation of ``LLMClient``.

Covers OpenAI itself and any service that speaks the same chat-completions
protocol — notably Ollama (local inference) and GigaChat — by pointing
``base_url`` at the right endpoint.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any, cast

from infra.llm.base import LLMClient, LLMResponse, Message, Role, ToolCall, ToolSpec, Usage


def _to_tools(tools: list[ToolSpec]) -> list[dict[str, Any]]:
    return [
        {
            "type": "function",
            "function": {
                "name": t.name,
                "description": t.description,
                "parameters": t.input_schema,
            },
        }
        for t in tools
    ]


def _to_messages(system: str, messages: list[Message]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = [{"role": "system", "content": system}]
    for message in messages:
        if message.role == Role.USER:
            out.append({"role": "user", "content": message.content})
        elif message.role == Role.ASSISTANT:
            entry: dict[str, Any] = {"role": "assistant", "content": message.content or None}
            if message.tool_calls:
                entry["tool_calls"] = [
                    {
                        "id": call.id,
                        "type": "function",
                        "function": {
                            "name": call.name,
                            "arguments": json.dumps(call.arguments, ensure_ascii=False),
                        },
                    }
                    for call in message.tool_calls
                ]
            out.append(entry)
        elif message.role == Role.TOOL:
            out.append(
                {
                    "role": "tool",
                    "tool_call_id": message.tool_call_id,
                    "content": message.content,
                }
            )
    return out


class OpenAICompatibleClient(LLMClient):
    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        base_url: str | None = None,
        max_tokens: int = 4096,
        timeout: int = 60,
    ) -> None:
        from openai import AsyncOpenAI

        self._client = AsyncOpenAI(
            api_key=api_key or "not-needed", base_url=base_url, timeout=timeout
        )
        self._model = model
        self._max_tokens = max_tokens

    @property
    def model(self) -> str:
        return self._model

    async def complete(
        self,
        *,
        system: str,
        messages: list[Message],
        tools: list[ToolSpec] | None = None,
    ) -> LLMResponse:
        kwargs: dict[str, Any] = {
            "model": self._model,
            "max_tokens": self._max_tokens,
            "messages": _to_messages(system, messages),
        }
        if tools:
            kwargs["tools"] = _to_tools(tools)
            kwargs["tool_choice"] = "auto"

        response = await self._client.chat.completions.create(**kwargs)
        choice = response.choices[0]
        message = choice.message

        calls: list[ToolCall] = []
        for tool_call in message.tool_calls or []:
            try:
                arguments = json.loads(tool_call.function.arguments or "{}")
            except json.JSONDecodeError:
                arguments = {}
            calls.append(
                ToolCall(id=tool_call.id, name=tool_call.function.name, arguments=arguments)
            )

        usage = response.usage
        return LLMResponse(
            text=message.content or "",
            tool_calls=calls,
            stop_reason=choice.finish_reason or "",
            usage=Usage(
                input_tokens=getattr(usage, "prompt_tokens", 0) or 0,
                output_tokens=getattr(usage, "completion_tokens", 0) or 0,
            ),
            raw=response,
        )

    async def stream_text(
        self,
        *,
        system: str,
        messages: list[Message],
        tools: list[ToolSpec] | None = None,
    ) -> AsyncIterator[str]:
        stream = cast(
            "AsyncIterator[Any]",
            await self._client.chat.completions.create(
                model=self._model,
                max_tokens=self._max_tokens,
                messages=_to_messages(system, messages),  # type: ignore[arg-type]
                stream=True,
            ),
        )
        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            if delta and delta.content:
                yield delta.content
