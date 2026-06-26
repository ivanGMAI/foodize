"""Resolve a configured ``LLMClient`` for a given agent role.

Each agent asks for a client by role; the active provider (and the model that
fits it) is taken from settings, so switching providers is a config change.
"""

from __future__ import annotations

from enum import Enum

from infra.llm.base import LLMClient
from settings.config.app_config import settings
from settings.config.runtime.llm import LLMConfig, LLMProvider


class AgentRole(str, Enum):
    ORDER = "order"
    ADVISOR = "advisor"


_clients: dict[tuple[str, str], LLMClient] = {}


def _resolve_model(role: AgentRole, provider: LLMProvider, cfg: LLMConfig) -> str:
    if provider == LLMProvider.ANTHROPIC:
        return cfg.anthropic_order_model if role == AgentRole.ORDER else cfg.anthropic_advisor_model
    if provider == LLMProvider.OPENAI:
        return cfg.openai_model
    if provider == LLMProvider.OLLAMA:
        return cfg.ollama_model
    if provider == LLMProvider.GIGACHAT:
        return cfg.gigachat_model
    raise ValueError(f"Unsupported LLM provider: {provider}")


def _build(provider: LLMProvider, model: str, cfg: LLMConfig) -> LLMClient:
    if provider == LLMProvider.ANTHROPIC:
        from infra.llm.anthropic_client import AnthropicClient

        return AnthropicClient(
            api_key=cfg.anthropic_api_key,
            model=model,
            max_tokens=cfg.max_output_tokens,
            timeout=cfg.request_timeout_seconds,
        )

    from infra.llm.openai_compatible import OpenAICompatibleClient

    if provider == LLMProvider.OPENAI:
        return OpenAICompatibleClient(
            api_key=cfg.openai_api_key,
            model=model,
            base_url=cfg.openai_base_url,
            max_tokens=cfg.max_output_tokens,
            timeout=cfg.request_timeout_seconds,
        )
    if provider == LLMProvider.OLLAMA:
        return OpenAICompatibleClient(
            api_key="ollama",
            model=model,
            base_url=cfg.ollama_base_url,
            max_tokens=cfg.max_output_tokens,
            timeout=cfg.request_timeout_seconds,
        )
    if provider == LLMProvider.GIGACHAT:
        return OpenAICompatibleClient(
            api_key=cfg.gigachat_api_key,
            model=model,
            base_url=cfg.gigachat_base_url,
            max_tokens=cfg.max_output_tokens,
            timeout=cfg.request_timeout_seconds,
        )
    raise ValueError(f"Unsupported LLM provider: {provider}")


def get_llm_client(role: AgentRole, *, provider: LLMProvider | None = None) -> LLMClient:
    cfg = settings.llm
    provider = provider or cfg.provider
    model = _resolve_model(role, provider, cfg)
    key = (provider.value, model)
    if key not in _clients:
        _clients[key] = _build(provider, model, cfg)
    return _clients[key]
