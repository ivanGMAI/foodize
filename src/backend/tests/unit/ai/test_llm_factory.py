"""Tests for provider/model resolution and client caching (``infra/llm/factory.py``)."""

import pytest

from infra.llm import factory
from infra.llm.factory import AgentRole, _resolve_model, get_llm_client
from settings.config.runtime.llm import LLMConfig, LLMProvider

_CFG = LLMConfig(
    anthropic_order_model="order-model",
    anthropic_advisor_model="advisor-model",
    openai_model="openai-model",
    ollama_model="ollama-model",
    gigachat_model="gigachat-model",
)


@pytest.mark.parametrize(
    ("role", "provider", "expected"),
    [
        (AgentRole.ORDER, LLMProvider.ANTHROPIC, "order-model"),
        (AgentRole.ADVISOR, LLMProvider.ANTHROPIC, "advisor-model"),
        (AgentRole.ORDER, LLMProvider.OPENAI, "openai-model"),
        (AgentRole.ADVISOR, LLMProvider.OLLAMA, "ollama-model"),
        (AgentRole.ORDER, LLMProvider.GIGACHAT, "gigachat-model"),
    ],
)
def test_resolve_model_maps_role_and_provider(role, provider, expected):
    assert _resolve_model(role, provider, _CFG) == expected


def test_resolve_model_rejects_unknown_provider():
    with pytest.raises(ValueError, match="Unsupported LLM provider"):
        _resolve_model(AgentRole.ORDER, "telepathy", _CFG)  # type: ignore[arg-type]


def test_get_llm_client_is_cached_per_role_and_provider():
    factory._clients.clear()

    first = get_llm_client(AgentRole.ORDER, provider=LLMProvider.OLLAMA)
    second = get_llm_client(AgentRole.ORDER, provider=LLMProvider.OLLAMA)

    assert first is second


def test_gigachat_routes_through_openai_compatible_client():
    factory._clients.clear()
    from infra.llm.openai_compatible import OpenAICompatibleClient

    client = get_llm_client(AgentRole.ADVISOR, provider=LLMProvider.GIGACHAT)

    assert isinstance(client, OpenAICompatibleClient)
