from enum import Enum

from settings.config.base import BaseConfig


class LLMProvider(str, Enum):
    ANTHROPIC = "anthropic"
    OPENAI = "openai"
    OLLAMA = "ollama"
    GIGACHAT = "gigachat"


class LLMConfig(BaseConfig):
    """Provider-agnostic LLM settings.

    Read from the environment via the nested delimiter, e.g.
    ``LLM__PROVIDER=anthropic`` and ``LLM__ANTHROPIC_API_KEY=...``.
    """

    provider: LLMProvider = LLMProvider.ANTHROPIC
    max_output_tokens: int = 4096
    request_timeout_seconds: int = 60
    max_agent_steps: int = 8

    anthropic_api_key: str = ""
    anthropic_order_model: str = "claude-haiku-4-5"
    anthropic_advisor_model: str = "claude-sonnet-4-6"

    openai_api_key: str = ""
    openai_base_url: str | None = None
    openai_model: str = "gpt-4o-mini"

    ollama_base_url: str = "http://localhost:11434/v1"
    ollama_model: str = "qwen2.5"

    gigachat_api_key: str = ""
    gigachat_base_url: str = "https://gigachat.devices.sberbank.ru/api/v1"
    gigachat_model: str = "GigaChat"

    embeddings_enabled: bool = True
    embedding_base_url: str = "http://localhost:11434/v1"
    embedding_api_key: str = ""
    embedding_model: str = "bge-m3"
    embedding_candidate_limit: int = 300
