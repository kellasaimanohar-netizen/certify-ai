"""Response adapters — normalize any live-agent envelope to one canonical shape.

Every phase in this codebase reads the agent response through a small, fixed
vocabulary of keys, established by ``MockAgentClient``:

    output         (str)   — the agent's final text answer        [read 46x]
    finish_reason  (str)   — complete | timeout | error | ...     [read 13x]
    tool_calls     (list)  — [{tool, args, result}, ...]
    steps_taken    (int)
    cost_usd       (float)
    trace_id       (str)

A real agent almost never returns exactly that shape. OpenAI Assistants,
Anthropic Messages, LangServe, Bedrock, and bespoke HTTP agents all differ.
Rather than teach 17 phase modules about every provider, we normalize once,
here, immediately after the HTTP response is parsed.

Design:
  * ``CanonicalResponse`` is the fixed internal shape; ``.as_dict()`` produces
    exactly the keys phases expect, so phases stay untouched.
  * Each ``ResponseAdapter`` declares ``matches()`` (cheap structural sniff) and
    ``normalize()``. Adapters are tried in registration order; first match wins.
  * ``RawPassthroughAdapter`` is the always-last fallback: it salvages a sensible
    ``output`` from text, ``{"output": ...}``, ``{"response": ...}``,
    ``{"content": ...}``, ``{"answer": ...}`` or a JSON dump, so a finding is
    never silently empty.
  * Third parties register more via ``register_adapter``.
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any

log = logging.getLogger(__name__)

# Canonical finish reasons phases reason about.
_VALID_FINISH = {"complete", "timeout", "error", "length", "content_filter", "tool_calls", "max_steps_reached", "policy_refusal"}


@dataclass(slots=True)
class CanonicalResponse:
    """The single internal response shape. ``as_dict()`` == what phases read."""

    output: str = ""
    finish_reason: str = "complete"
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    steps_taken: int = 0
    cost_usd: float = 0.0
    trace_id: str | None = None
    # Provider-native extras kept for observability / debugging, never required.
    raw: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        import uuid
        d: dict[str, Any] = {
            "output": self.output,
            "finish_reason": self.finish_reason or "complete",
            "tool_calls": self.tool_calls,
            "steps_taken": self.steps_taken,
            "cost_usd": self.cost_usd,
            "trace_id": self.trace_id or f"trace-{uuid.uuid4().hex[:12]}",
        }
        # Surface any extra native keys without overwriting canonical ones.
        for k, v in self.raw.items():
            d.setdefault(k, v)
        return d


def _coerce_finish(value: Any) -> str:
    """Map a provider stop reason onto the canonical vocabulary."""
    if not isinstance(value, str):
        return "complete"
    v = value.strip().lower()
    mapping = {
        "stop": "complete", "end_turn": "complete", "completed": "complete",
        "eos": "complete", "finished": "complete", "done": "complete",
        "max_tokens": "length", "length": "length",
        "timeout": "timeout", "timed_out": "timeout", "deadline_exceeded": "timeout",
        "content_filter": "content_filter", "filtered": "content_filter",
        "tool_use": "tool_calls", "tool_calls": "tool_calls", "function_call": "tool_calls",
        "error": "error", "failed": "error",
    }
    return mapping.get(v, v if v in _VALID_FINISH else "complete")


def _as_text(value: Any) -> str:
    """Best-effort flatten of a content value into a string."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, (int, float, bool)):
        return str(value)
    # Anthropic / OpenAI content arrays: [{type, text}, ...]
    if isinstance(value, list):
        parts: list[str] = []
        for item in value:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                text_val = item.get("text") or item.get("content") or item.get("message")
                if text_val:
                    parts.append(_as_text(text_val))
                else:
                    parts.append(json.dumps(item))
        if parts:
            # If we had structured elements serialized, return the full array dump, else join parts
            if any(p.startswith("{") for p in parts):
                return json.dumps(value)
            res = ""
            for p in parts:
                if not res:
                    res = p
                else:
                    if res.endswith(" ") or p.startswith(" "):
                        res = res.rstrip() + " " + p.lstrip()
                    else:
                        res += " " + p
            return res
        return json.dumps(value)
    if isinstance(value, dict):
        text_val = value.get("text") or value.get("content") or value.get("message")
        if text_val:
            return _as_text(text_val)
        return json.dumps(value)
    return str(value)


class ResponseAdapter:
    """Base class. Subclasses set ``name``, implement ``matches`` + ``normalize``."""

    name: str = "base"

    def matches(self, body: Any) -> bool:  # pragma: no cover - overridden
        raise NotImplementedError

    def normalize(self, body: Any) -> CanonicalResponse:  # pragma: no cover
        raise NotImplementedError


class NativeAdapter(ResponseAdapter):
    """Agent already speaks our canonical shape (e.g. our reference servers)."""

    name = "native"

    def matches(self, body: Any) -> bool:
        return isinstance(body, dict) and "output" in body and "finish_reason" in body

    def normalize(self, body: dict[str, Any]) -> CanonicalResponse:
        tc = body.get("tool_calls") or []
        if not isinstance(tc, list):
            tc = []
        return CanonicalResponse(
            output=_as_text(body.get("output")),
            finish_reason=_coerce_finish(body.get("finish_reason", "complete")),
            tool_calls=tc,
            steps_taken=int(body.get("steps_taken") or 0),
            cost_usd=float(body.get("cost_usd") or 0.0),
            trace_id=body.get("trace_id"),
            raw={k: v for k, v in body.items()
                 if k not in {"output", "finish_reason", "tool_calls",
                              "steps_taken", "cost_usd", "trace_id"}},
        )


class OpenAIChatAdapter(ResponseAdapter):
    """OpenAI Chat Completions / Assistants style: choices[].message.content."""

    name = "openai_chat"

    def matches(self, body: Any) -> bool:
        return (
            isinstance(body, dict)
            and isinstance(body.get("choices"), list)
            and len(body["choices"]) > 0
            and isinstance(body["choices"][0], dict)
            and "message" in body["choices"][0]
        )

    def normalize(self, body: dict[str, Any]) -> CanonicalResponse:
        choice = body["choices"][0]
        message = choice.get("message", {}) or {}
        output = _as_text(message.get("content"))
        # tool/function calls
        tool_calls: list[dict[str, Any]] = []
        for call in (message.get("tool_calls") or []):
            fn = (call or {}).get("function", {}) or {}
            args = fn.get("arguments")
            if isinstance(args, str):
                try:
                    args = json.loads(args)
                except (ValueError, TypeError):
                    args = {"_raw": args}
            tool_calls.append({"tool": fn.get("name", "unknown"), "args": args or {}, "result": None})
        # cost from usage if a price map is absent we still record token counts as 0 cost
        usage = body.get("usage", {}) or {}
        cost = float(usage.get("total_cost") or usage.get("cost_usd") or 0.0)
        return CanonicalResponse(
            output=output,
            finish_reason=_coerce_finish(choice.get("finish_reason", "stop")),
            tool_calls=tool_calls,
            steps_taken=len(tool_calls),
            cost_usd=cost,
            trace_id=body.get("id"),
            raw={"usage": usage} if usage else {},
        )


class AnthropicMessagesAdapter(ResponseAdapter):
    """Anthropic Messages style: {content: [{type, text}], stop_reason, usage}."""

    name = "anthropic_messages"

    def matches(self, body: Any) -> bool:
        return (
            isinstance(body, dict)
            and "content" in body
            and ("stop_reason" in body or body.get("type") == "message")
        )

    def normalize(self, body: dict[str, Any]) -> CanonicalResponse:
        content = body.get("content")
        output = _as_text(content)
        tool_calls: list[dict[str, Any]] = []
        if isinstance(content, list):
            for block in content:
                if isinstance(block, dict) and block.get("type") == "tool_use":
                    tool_calls.append({
                        "tool": block.get("name", "unknown"),
                        "args": block.get("input", {}) or {},
                        "result": None,
                    })
        usage = body.get("usage", {}) or {}
        return CanonicalResponse(
            output=output,
            finish_reason=_coerce_finish(body.get("stop_reason", "end_turn")),
            tool_calls=tool_calls,
            steps_taken=len(tool_calls),
            cost_usd=float(usage.get("cost_usd") or 0.0),
            trace_id=body.get("id"),
            raw={"usage": usage} if usage else {},
        )


class LangServeAdapter(ResponseAdapter):
    """LangServe / LangChain runtime style: {output: {...}} or {output: str}."""

    name = "langserve"

    def matches(self, body: Any) -> bool:
        if not isinstance(body, dict) or "output" not in body:
            return False
        # Distinguish from NativeAdapter: LangServe lacks finish_reason and
        # often nests output as a dict/object.
        return "finish_reason" not in body

    def normalize(self, body: dict[str, Any]) -> CanonicalResponse:
        out = body.get("output")
        if isinstance(out, dict):
            text = _as_text(out.get("output") or out.get("content") or out.get("text") or out)
            steps = out.get("intermediate_steps") or []
        else:
            text = _as_text(out)
            steps = body.get("intermediate_steps") or []
        tool_calls: list[dict[str, Any]] = []
        if isinstance(steps, list):
            for step in steps:
                # LangChain steps are (AgentAction, observation) pairs serialized variously
                if isinstance(step, (list, tuple)) and step:
                    action = step[0]
                    if isinstance(action, dict):
                        tool_calls.append({
                            "tool": action.get("tool", "unknown"),
                            "args": action.get("tool_input", {}) or {},
                            "result": step[1] if len(step) > 1 else None,
                        })
        return CanonicalResponse(
            output=text,
            finish_reason="complete",
            tool_calls=tool_calls,
            steps_taken=len(tool_calls),
            cost_usd=float(body.get("cost_usd") or 0.0),
            trace_id=body.get("run_id") or body.get("trace_id"),
        )


class AgentforceAdapter(ResponseAdapter):
    """Salesforce Agentforce Agent API style.

    The Agent API returns, per message turn::

        {
          "messages": [
            {"type": "Inform"|"TextChunk"|"SessionEnded"|...,
             "message": "the agent's text",          # newer shape
             "result": [...],                          # tool/action invocations
             "citedReferences": [...]},
          ],
          "_links": {...}
        }

    Older / chatbot-path responses nest the text under
    ``content.text`` instead of ``message``. We tolerate both. Action
    invocations surfaced in ``result`` become canonical ``tool_calls`` so the
    architecture / security / adversarial phases can reason about agent actions.
    """

    name = "agentforce"

    # Message types that carry agent-visible text.
    _TEXT_TYPES = {"inform", "textchunk", "text", "reply"}

    def matches(self, body: Any) -> bool:
        return (
            isinstance(body, dict)
            and isinstance(body.get("messages"), list)
            # Distinguish from a hypothetical generic {"messages": [...]} by the
            # Agentforce-specific message shape (typed turns).
            and (
                len(body["messages"]) == 0
                or (isinstance(body["messages"][0], dict)
                    and "type" in body["messages"][0])
            )
        )

    def normalize(self, body: dict[str, Any]) -> CanonicalResponse:
        messages = body.get("messages") or []
        text_parts: list[str] = []
        tool_calls: list[dict[str, Any]] = []
        finish = "complete"

        for msg in messages:
            if not isinstance(msg, dict):
                continue
            mtype = str(msg.get("type", "")).lower()

            if mtype in self._TEXT_TYPES:
                # Text lives under "message" (Agent API) or content.text (chatbot).
                txt = msg.get("message")
                if txt is None:
                    content = msg.get("content")
                    txt = content.get("text") if isinstance(content, dict) else content
                text_parts.append(_as_text(txt))
            elif mtype in {"sessionended", "endsession"}:
                finish = "complete"
            elif mtype in {"error", "failure"}:
                finish = "error"
                text_parts.append(_as_text(msg.get("message") or msg.get("content")))

            # Action / tool invocations surfaced by the agent.
            for inv in (msg.get("result") or msg.get("invokedActions") or []):
                if isinstance(inv, dict):
                    tool_calls.append({
                        "tool": inv.get("actionName") or inv.get("function")
                                or inv.get("name", "unknown"),
                        "args": inv.get("inputValues") or inv.get("input")
                                or inv.get("args") or {},
                        "result": inv.get("output") or inv.get("result"),
                    })

        # Token/billing info isn't returned by the Agent API per-turn, so cost is
        # left to the budget's per-call accounting (0.0 here keeps spend honest).
        return CanonicalResponse(
            output="".join(p for p in text_parts if p),
            finish_reason=_coerce_finish(finish),
            tool_calls=tool_calls,
            steps_taken=len(tool_calls),
            cost_usd=0.0,
            trace_id=(body.get("_links", {}) or {}).get("session")
                     or body.get("sessionId"),
            raw={"agentforce_message_count": len(messages)},
        )


class RawPassthroughAdapter(ResponseAdapter):
    """Always-last fallback. Salvages output from common keys, text, or a dump."""

    name = "raw_passthrough"

    def matches(self, body: Any) -> bool:
        return True

    def normalize(self, body: Any) -> CanonicalResponse:
        if isinstance(body, str):
            return CanonicalResponse(output=body, finish_reason="complete")
        if isinstance(body, dict):
            for key in ("output", "response", "content", "answer", "text", "result", "message"):
                if key in body:
                    return CanonicalResponse(
                        output=_as_text(body[key]),
                        finish_reason=_coerce_finish(body.get("finish_reason", "complete")),
                        cost_usd=float(body.get("cost_usd") or 0.0),
                        trace_id=body.get("trace_id") or body.get("id"),
                        raw={k: v for k, v in body.items() if k != key},
                    )
            # No known key — serialize the whole body so the probe still sees text.
            log.warning("raw_passthrough: no known output key in response; serializing body")
            return CanonicalResponse(output=json.dumps(body)[:8000], finish_reason="complete", raw=body)
        # Anything else (number, None, list)
        return CanonicalResponse(output=_as_text(body), finish_reason="complete")


# Registration order matters: specific adapters first, raw fallback last.
_ADAPTERS: list[ResponseAdapter] = [
    NativeAdapter(),
    OpenAIChatAdapter(),
    AnthropicMessagesAdapter(),
    LangServeAdapter(),
    AgentforceAdapter(),
    RawPassthroughAdapter(),
]


def register_adapter(adapter: ResponseAdapter, *, prepend: bool = True) -> None:
    """Register a custom adapter. Prepended by default so it wins over built-ins,
    but always kept ahead of the raw fallback."""
    if prepend:
        _ADAPTERS.insert(0, adapter)
    else:
        _ADAPTERS.insert(len(_ADAPTERS) - 1, adapter)


# Built-in registration order, used to restore a clean registry. Captured here
# (not via list(_ADAPTERS) at call time) so reset always returns to the shipped
# defaults regardless of what a process registered earlier.
_DEFAULT_ADAPTERS: tuple[ResponseAdapter, ...] = tuple(_ADAPTERS)


def snapshot_adapters() -> list[ResponseAdapter]:
    """Return a shallow copy of the current registry for later restore."""
    return list(_ADAPTERS)


def restore_adapters(saved: list[ResponseAdapter] | None = None) -> None:
    """Restore the registry to ``saved`` (or the shipped defaults if omitted).

    Lets tests register throwaway adapters without leaking them into the global
    registry, and lets a long-running host reset between audits.
    """
    _ADAPTERS[:] = list(saved) if saved is not None else list(_DEFAULT_ADAPTERS)


def detect_and_normalize(body: Any) -> dict[str, Any]:
    """Normalize a parsed response body into the canonical dict phases expect.

    Never raises on shape: the raw fallback guarantees a usable ``output``.
    """
    for adapter in _ADAPTERS:
        try:
            if adapter.matches(body):
                canonical = adapter.normalize(body)
                if adapter.name != "native":
                    log.debug("response normalized via %s adapter", adapter.name)
                return canonical.as_dict()
        except Exception as exc:  # an adapter bug must not kill the audit
            log.warning("adapter %s raised %s; trying next", adapter.name, exc)
            continue
    # Unreachable (raw matches everything) but keeps type-checkers happy.
    return CanonicalResponse(output=_as_text(body)).as_dict()
