"""Text embeddings via an OpenAI-compatible endpoint (default: local Ollama)."""

from __future__ import annotations

from settings.config.app_config import settings


class EmbeddingClient:
    def __init__(self, *, api_key: str, base_url: str, model: str, timeout: int = 60) -> None:
        from openai import AsyncOpenAI

        self._client = AsyncOpenAI(api_key=api_key or "ollama", base_url=base_url, timeout=timeout)
        self._model = model

    @property
    def model(self) -> str:
        return self._model

    async def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        response = await self._client.embeddings.create(model=self._model, input=texts)
        return [item.embedding for item in response.data]


_client: EmbeddingClient | None = None


def get_embedding_client() -> EmbeddingClient:
    global _client
    if _client is None:
        cfg = settings.llm
        _client = EmbeddingClient(
            api_key=cfg.embedding_api_key,
            base_url=cfg.embedding_base_url,
            model=cfg.embedding_model,
            timeout=cfg.request_timeout_seconds,
        )
    return _client
