"""Tests for provider message mapping.

Both providers consume the same generic ``Message`` list; each maps it to its
own wire shape. Anthropic carries tool results as ``tool_result`` blocks inside
a *user* turn (parallel results merged), while OpenAI uses a dedicated ``tool``
role message per result.
"""

from infra.llm.anthropic_client import _to_messages as anthropic_messages
from infra.llm.base import Message, Role, ToolCall
from infra.llm.openai_compatible import _to_messages as openai_messages


def _conversation() -> list[Message]:
    return [
        Message(role=Role.USER, content="найди пиццу"),
        Message(
            role=Role.ASSISTANT,
            content="ищу",
            tool_calls=[ToolCall(id="t1", name="search", arguments={"q": "pizza"})],
        ),
        Message(role=Role.TOOL, content='{"results": []}', tool_call_id="t1", tool_name="search"),
    ]


def test_anthropic_merges_parallel_tool_results_into_one_user_turn():
    messages = [
        Message(
            role=Role.ASSISTANT,
            tool_calls=[
                ToolCall(id="a", name="x", arguments={}),
                ToolCall(id="b", name="y", arguments={}),
            ],
        ),
        Message(role=Role.TOOL, content="ra", tool_call_id="a", tool_name="x"),
        Message(role=Role.TOOL, content="rb", tool_call_id="b", tool_name="y"),
    ]

    out = anthropic_messages(messages)

    assert out[0]["role"] == "assistant"
    assert [b["type"] for b in out[0]["content"]] == ["tool_use", "tool_use"]
    assert out[1]["role"] == "user"
    assert [b["type"] for b in out[1]["content"]] == ["tool_result", "tool_result"]
    assert {b["tool_use_id"] for b in out[1]["content"]} == {"a", "b"}


def test_anthropic_assistant_text_and_tool_use_in_one_turn():
    out = anthropic_messages(_conversation())

    assert out[0] == {"role": "user", "content": "найди пиццу"}
    assistant = out[1]
    assert assistant["role"] == "assistant"
    assert assistant["content"][0] == {"type": "text", "text": "ищу"}
    assert assistant["content"][1]["type"] == "tool_use"
    assert assistant["content"][1]["name"] == "search"


def test_openai_prepends_system_and_uses_tool_role():
    out = openai_messages("you are a bot", _conversation())

    assert out[0] == {"role": "system", "content": "you are a bot"}
    assert out[1] == {"role": "user", "content": "найди пиццу"}

    assistant = out[2]
    assert assistant["role"] == "assistant"
    assert assistant["tool_calls"][0]["id"] == "t1"
    assert assistant["tool_calls"][0]["function"]["name"] == "search"

    tool = out[3]
    assert tool["role"] == "tool"
    assert tool["tool_call_id"] == "t1"


def test_openai_serializes_tool_arguments_as_json_without_ascii_escaping():
    messages = [
        Message(
            role=Role.ASSISTANT,
            tool_calls=[ToolCall(id="t1", name="search", arguments={"q": "пицца"})],
        ),
    ]

    out = openai_messages("sys", messages)

    raw_args = out[1]["tool_calls"][0]["function"]["arguments"]
    assert "пицца" in raw_args
