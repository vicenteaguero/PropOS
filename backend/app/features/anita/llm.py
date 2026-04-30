"""LLM client abstraction with provider swap via env var.

Supports: cerebras (default DEV), anthropic (PROD), groq, openai.
Cerebras/Groq/OpenAI use OpenAI-compatible API; Anthropic uses native SDK.

Tool format adapter: tools/definitions.py emits canonical (OpenAI-style)
tool specs; this module translates to Anthropic format when needed.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any, Protocol

from app.core.config.settings import settings
from app.core.logging.logger import get_logger

logger = get_logger("ANITA_LLM")


@dataclass
class StreamEvent:
    """Single event from the streaming chat response."""

    type: str  # text_delta | tool_use | message_stop
    text: str | None = None
    tool_use_id: str | None = None
    tool_name: str | None = None
    tool_input: dict[str, Any] | None = None
    tokens_in: int | None = None
    tokens_out: int | None = None


class LLMClient(Protocol):
    provider_name: str
    model: str

    async def chat_stream(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        system: str,
    ) -> AsyncIterator[StreamEvent]:
        ...


class CerebrasClient:
    provider_name = "cerebras"

    def __init__(self, model: str | None = None):
        self.model = model or settings.anita_model
        from openai import AsyncOpenAI

        self._client = AsyncOpenAI(
            api_key=settings.cerebras_api_key,
            base_url="https://api.cerebras.ai/v1",
        )

    async def chat_stream(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        system: str,
    ) -> AsyncIterator[StreamEvent]:
        async for ev in _openai_compat_stream(
            self._client, self.model, messages, tools, system
        ):
            yield ev


class GroqClient:
    provider_name = "groq"

    def __init__(self, model: str = "llama-3.3-70b-versatile"):
        self.model = model
        from openai import AsyncOpenAI

        self._client = AsyncOpenAI(
            api_key=settings.groq_api_key,
            base_url="https://api.groq.com/openai/v1",
        )

    async def chat_stream(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        system: str,
    ) -> AsyncIterator[StreamEvent]:
        async for ev in _openai_compat_stream(
            self._client, self.model, messages, tools, system
        ):
            yield ev


class OpenAIClient:
    provider_name = "openai"

    def __init__(self, model: str = "gpt-4o-mini"):
        self.model = model
        from openai import AsyncOpenAI

        self._client = AsyncOpenAI(api_key=settings.openai_api_key)

    async def chat_stream(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        system: str,
    ) -> AsyncIterator[StreamEvent]:
        async for ev in _openai_compat_stream(
            self._client, self.model, messages, tools, system
        ):
            yield ev


class AnthropicClient:
    provider_name = "anthropic"

    def __init__(self, model: str = "claude-sonnet-4-6"):
        self.model = model
        from anthropic import AsyncAnthropic

        self._client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    async def chat_stream(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        system: str,
    ) -> AsyncIterator[StreamEvent]:
        # Anthropic uses different tool format; translate from canonical
        anthropic_tools = [
            {
                "name": t["function"]["name"],
                "description": t["function"]["description"],
                "input_schema": t["function"]["parameters"],
            }
            for t in tools
        ]
        # Translate messages
        msgs = _to_anthropic_messages(messages)

        async with self._client.messages.stream(
            model=self.model,
            max_tokens=2048,
            system=system,
            tools=anthropic_tools,
            messages=msgs,
        ) as stream:
            current_tool: dict[str, Any] = {}
            async for event in stream:
                etype = type(event).__name__
                if etype == "ContentBlockDeltaEvent":
                    delta = getattr(event, "delta", None)
                    if delta and getattr(delta, "type", "") == "text_delta":
                        yield StreamEvent(type="text_delta", text=delta.text)
                    elif delta and getattr(delta, "type", "") == "input_json_delta":
                        current_tool.setdefault("input_json", "")
                        current_tool["input_json"] += delta.partial_json
                elif etype == "ContentBlockStartEvent":
                    block = getattr(event, "content_block", None)
                    if block and getattr(block, "type", "") == "tool_use":
                        current_tool = {
                            "id": block.id,
                            "name": block.name,
                            "input_json": "",
                        }
                elif etype == "ContentBlockStopEvent":
                    if current_tool.get("name"):
                        import json

                        try:
                            tool_input = json.loads(current_tool.get("input_json", "{}"))
                        except json.JSONDecodeError:
                            tool_input = {}
                        yield StreamEvent(
                            type="tool_use",
                            tool_use_id=current_tool["id"],
                            tool_name=current_tool["name"],
                            tool_input=tool_input,
                        )
                        current_tool = {}
                elif etype == "MessageStopEvent":
                    final = await stream.get_final_message()
                    yield StreamEvent(
                        type="message_stop",
                        tokens_in=final.usage.input_tokens,
                        tokens_out=final.usage.output_tokens,
                    )


async def _openai_compat_stream(
    client: Any,
    model: str,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]],
    system: str,
) -> AsyncIterator[StreamEvent]:
    msgs = [{"role": "system", "content": system}, *messages]
    kwargs: dict[str, Any] = {"model": model, "messages": msgs, "stream": True}
    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"

    accumulated_tool_calls: dict[int, dict[str, Any]] = {}
    final_usage: dict[str, int] = {}

    async for chunk in await client.chat.completions.create(**kwargs):
        if not chunk.choices:
            if hasattr(chunk, "usage") and chunk.usage:
                final_usage = {
                    "in": chunk.usage.prompt_tokens,
                    "out": chunk.usage.completion_tokens,
                }
            continue
        choice = chunk.choices[0]
        delta = choice.delta

        if getattr(delta, "content", None):
            yield StreamEvent(type="text_delta", text=delta.content)

        if getattr(delta, "tool_calls", None):
            for tc in delta.tool_calls:
                idx = tc.index if hasattr(tc, "index") else 0
                slot = accumulated_tool_calls.setdefault(
                    idx, {"id": "", "name": "", "args_json": ""}
                )
                if tc.id:
                    slot["id"] = tc.id
                if tc.function and tc.function.name:
                    slot["name"] = tc.function.name
                if tc.function and tc.function.arguments:
                    slot["args_json"] += tc.function.arguments

        if choice.finish_reason in ("tool_calls", "stop"):
            for slot in accumulated_tool_calls.values():
                import json

                try:
                    args = json.loads(slot["args_json"]) if slot["args_json"] else {}
                except json.JSONDecodeError:
                    args = {"_malformed": slot["args_json"]}
                yield StreamEvent(
                    type="tool_use",
                    tool_use_id=slot["id"],
                    tool_name=slot["name"],
                    tool_input=args,
                )
            accumulated_tool_calls.clear()

            yield StreamEvent(
                type="message_stop",
                tokens_in=final_usage.get("in"),
                tokens_out=final_usage.get("out"),
            )


def _to_anthropic_messages(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Translate OpenAI-format messages to Anthropic format.

    OpenAI: {role: 'tool', tool_call_id, content}
    Anthropic: {role: 'user', content: [{type:'tool_result', tool_use_id, content}]}
    """
    out: list[dict[str, Any]] = []
    for m in messages:
        if m["role"] == "tool":
            out.append(
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "tool_result",
                            "tool_use_id": m["tool_call_id"],
                            "content": m["content"]
                            if isinstance(m["content"], str)
                            else str(m["content"]),
                        }
                    ],
                }
            )
        elif m["role"] == "assistant" and m.get("tool_calls"):
            content_blocks: list[dict[str, Any]] = []
            if m.get("content"):
                content_blocks.append({"type": "text", "text": m["content"]})
            for tc in m["tool_calls"]:
                import json

                content_blocks.append(
                    {
                        "type": "tool_use",
                        "id": tc["id"],
                        "name": tc["function"]["name"],
                        "input": json.loads(tc["function"]["arguments"])
                        if isinstance(tc["function"]["arguments"], str)
                        else tc["function"]["arguments"],
                    }
                )
            out.append({"role": "assistant", "content": content_blocks})
        else:
            out.append({"role": m["role"], "content": m["content"]})
    return out


_PROVIDERS: dict[str, type[LLMClient]] = {
    "cerebras": CerebrasClient,
    "anthropic": AnthropicClient,
    "openai": OpenAIClient,
    "groq": GroqClient,
}


def get_llm_client(provider: str | None = None) -> LLMClient:
    name = provider or settings.anita_provider
    cls = _PROVIDERS.get(name)
    if cls is None:
        raise ValueError(f"Unknown ANITA_PROVIDER={name!r}")
    return cls()  # type: ignore[abstract]
