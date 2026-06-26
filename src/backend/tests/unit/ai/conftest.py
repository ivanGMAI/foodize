"""Shared fakes for the provider-agnostic LLM layer tests.

``FakeLLMClient`` lets us drive the agent loop deterministically without any
network or provider SDK: each ``complete`` call pops the next scripted response,
and ``stream_text`` yields a fixed list of chunks.
"""

from collections.abc import AsyncIterator

from infra.llm.base import LLMClient, LLMResponse, Message, ToolSpec


class FakeLLMClient(LLMClient):
    def __init__(
        self,
        responses: list[LLMResponse],
        stream_chunks: list[str] | None = None,
    ) -> None:
        self._responses = list(responses)
        self._stream_chunks = stream_chunks or ["ok"]
        self.complete_calls: list[dict] = []
        self.stream_calls: list[dict] = []

    @property
    def model(self) -> str:
        return "fake-model"

    async def complete(
        self,
        *,
        system: str,
        messages: list[Message],
        tools: list[ToolSpec] | None = None,
    ) -> LLMResponse:
        self.complete_calls.append({"system": system, "messages": list(messages), "tools": tools})
        return self._responses.pop(0)

    async def stream_text(
        self,
        *,
        system: str,
        messages: list[Message],
        tools: list[ToolSpec] | None = None,
    ) -> AsyncIterator[str]:
        self.stream_calls.append({"system": system, "messages": list(messages)})
        for chunk in self._stream_chunks:
            yield chunk
