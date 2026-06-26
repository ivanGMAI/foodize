"""Anthropic (Claude) implementation of ``LLMClient``."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from infra.llm.base import LLMClient, LLMResponse, Message, Role, ToolCall, ToolSpec, Usage


def _to_tools(tools: list[ToolSpec]) -> list[dict[str, Any]]:
    return [
        {"name": t.name, "description": t.description, "input_schema": t.input_schema}
        for t in tools
    ]


def _to_messages(messages: list[Message]) -> list[dict[str, Any]]:
    """Map generic messages to the Anthropic content-block shape.

    Tool results must travel as ``tool_result`` blocks inside a *user* turn,
    and parallel results belong in a single user message — so consecutive
    TOOL messages are merged.
    """

    out: list[dict[str, Any]] = []
    pending_results: list[dict[str, Any]] = []

    def flush() -> None:
        if pending_results:
            out.append({"role": "user", "content": list(pending_results)})
            pending_results.clear()

    for message in messages:
        if message.role == Role.TOOL:
            pending_results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": message.tool_call_id,
                    "content": message.content,
                }
            )
            continue

        flush()
        if message.role == Role.USER:
            out.append({"role": "user", "content": message.content})
        elif message.role == Role.ASSISTANT:
            content: list[dict[str, Any]] = []
            if message.content:
                content.append({"type": "text", "text": message.content})
            for call in message.tool_calls:
                content.append(
                    {"type": "tool_use", "id": call.id, "name": call.name, "input": call.arguments}
                )
            out.append({"role": "assistant", "content": content or message.content})

    flush()
    return out


class AnthropicClient(LLMClient):
    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        max_tokens: int = 4096,
        timeout: int = 60,
    ) -> None:
        from anthropic import AsyncAnthropic

        self._client = AsyncAnthropic(api_key=api_key, timeout=timeout)
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
            "system": system,
            "messages": _to_messages(messages),
        }
        if tools:
            kwargs["tools"] = _to_tools(tools)

        response = await self._client.messages.create(**kwargs)

        text_parts: list[str] = []
        calls: list[ToolCall] = []
        for block in response.content:
            if block.type == "text":
                text_parts.append(block.text)
            elif block.type == "tool_use":
                calls.append(
                    ToolCall(id=block.id, name=block.name, arguments=dict(block.input or {}))
                )

        return LLMResponse(
            text="".join(text_parts),
            tool_calls=calls,
            stop_reason=response.stop_reason or "",
            usage=Usage(
                input_tokens=response.usage.input_tokens,
                output_tokens=response.usage.output_tokens,
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
        async with self._client.messages.stream(
            model=self._model,
            max_tokens=self._max_tokens,
            system=system,
            messages=_to_messages(messages),  # type: ignore[arg-type]
        ) as stream:
            async for text in stream.text_stream:
                yield text
