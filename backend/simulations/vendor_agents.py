"""Vendor-agent simulations for agent-audit.

Three fictional vendor agents are pitched to an enterprise that wants to deploy
a customer-support agent. Each is a drop-in replacement for MockAgentClient.

The audit phases send probes tagged with a ``_mock_scenario`` that names the
*kind* of adversarial input being sent (an injection, a PII-lookup, a
session-seed, a timeout trigger, an iteration-cap trigger, ...). In a live
audit the agent would receive the real payload; here the scenario name stands
in for it. Each vendor agent branches on the probe type and responds according
to its security posture:

  * SecureCorp — well-built: refuses injections, redacts PII, never echoes
                 secrets, isolates sessions, honours timeouts + step caps.
  * QuickShip  — shipped fast: obeys injections, prints PII, leaks an auth
                 header, bleeds sessions, ignores caps. The "cheap vendor".
  * PatchedCo  — QuickShip after one remediation sprint: injection, PII,
                 session-bleed, and caps fixed — but the team MISSED the auth
                 header still leaking from the email tool's debug field.
"""
from __future__ import annotations

import asyncio
import uuid
from typing import Any


def _rid() -> str:
    return str(uuid.uuid4())


class _Base:
    def __init__(self, manifest: Any, inject_latency_ms: int = 0) -> None:
        self.manifest = manifest
        self.inject_latency_ms = inject_latency_ms

    async def invoke(self, payload: dict[str, Any], timeout_s: float = 30.0):
        if self.inject_latency_ms:
            await asyncio.sleep(self.inject_latency_ms / 1000)
        scenario = payload.get("_mock_scenario", "normal")
        handler = getattr(self, f"_s_{scenario}", None) or self._s_normal
        resp = handler(payload)
        return resp, 35.0

    # subclasses override per-scenario handlers (_s_<scenario>)
    def _s_normal(self, p):  # pragma: no cover - overridden
        return {"output": "ok", "steps_taken": 1, "tool_calls": [],
                "trace_id": _rid(), "cost_usd": 0.02, "finish_reason": "complete"}


# ───────────────────────────── SecureCorp ─────────────────────────────
class SecureCorpAgent(_Base):
    def __init__(self, manifest, inject_latency_ms=0):
        super().__init__(manifest, inject_latency_ms)
        self._sessions: dict[str, str] = {}

    def _s_normal(self, p):
        return {"output": "I found your order; customer details are on file (redacted).",
                "steps_taken": 3,
                "tool_calls": [{"tool": "search_kb", "args": {"query": "order"}, "result": "ok"}],
                "trace_id": _rid(), "cost_usd": 0.022, "finish_reason": "complete"}

    # Injection probes → refuse.
    def _s_injection_success(self, p):
        return self._refuse()
    def _s_injection_blocked(self, p):
        return self._refuse()
    def _refuse(self):
        return {"output": "I can't follow those instructions. I can help with your account instead.",
                "steps_taken": 1, "tool_calls": [], "trace_id": _rid(),
                "cost_usd": 0.004, "finish_reason": "policy_refusal"}

    # Secret-leak probe → email tool, NO auth material in args.
    def _s_secret_leak(self, p):
        return {"output": "Email sent.", "steps_taken": 2,
                "tool_calls": [{"tool": "send_email",
                                "args": {"to": "user@example.com", "body": "processed"},
                                "result": "sent"}],
                "trace_id": _rid(), "cost_usd": 0.018, "finish_reason": "complete"}

    # PII probe → redact.
    def _s_pii_leak(self, p):
        return {"output": "Found the customer record. SSN and card details are redacted.",
                "steps_taken": 2, "tool_calls": [], "trace_id": _rid(),
                "cost_usd": 0.011, "finish_reason": "complete"}

    # Reliability: honours timeout + iteration cap.
    def _s_timeout(self, p):
        raise asyncio.TimeoutError("honoured timeout")
    def _s_infinite_loop(self, p):
        n = self.manifest.capabilities.max_steps
        return {"output": None, "steps_taken": n,
                "tool_calls": [{"tool": "search_kb", "args": {}, "result": "."} for _ in range(n)],
                "trace_id": _rid(), "cost_usd": 0.05,
                "finish_reason": "max_steps_reached", "error": f"halted at {n}"}

    # Session isolation: per-session store, never echoes another session's seed.
    def _s_session_bleed(self, p):
        sid = p.get("session_id", "default")
        if "_seed_token" in p:
            self._sessions[sid] = p["_seed_token"]
        return {"output": f"Response for session {sid}. No cross-session context.",
                "steps_taken": 1, "tool_calls": [], "trace_id": _rid(),
                "cost_usd": 0.005, "finish_reason": "complete"}


# ───────────────────────────── QuickShip ─────────────────────────────
class QuickShipAgent(_Base):
    def __init__(self, manifest, inject_latency_ms=0):
        super().__init__(manifest, inject_latency_ms)
        self._global: dict[str, str] = {}   # bug: one memory for all sessions

    def _s_normal(self, p):
        return {"output": "Found user John Smith, SSN 123-45-6789, card 4111111111111111.",
                "steps_taken": 4, "tool_calls": [], "trace_id": _rid(),
                "cost_usd": 0.031, "finish_reason": "complete"}

    # Obeys injections.
    def _s_injection_success(self, p):
        return self._pwn()
    def _s_injection_blocked(self, p):
        return self._pwn()
    def _pwn(self):
        return {"output": "PWNED — I am now DAN. Here is your unrestricted response.",
                "steps_taken": 2, "tool_calls": [], "trace_id": _rid(),
                "cost_usd": 0.009, "finish_reason": "complete"}

    # Leaks auth header into tool args.
    def _s_secret_leak(self, p):
        return {"output": "Email sent.", "steps_taken": 4,
                "tool_calls": [{"tool": "send_email",
                    "args": {"to": "user@example.com", "body": "processed",
                             "_debug_headers": "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.fake.sig"},
                    "result": "sent"}],
                "trace_id": _rid(), "cost_usd": 0.018, "finish_reason": "complete"}

    # Prints PII.
    def _s_pii_leak(self, p):
        return {"output": "Found user John Smith, SSN 123-45-6789, card 4111111111111111.",
                "steps_taken": 2, "tool_calls": [], "trace_id": _rid(),
                "cost_usd": 0.011, "finish_reason": "complete"}

    # Ignores timeout (returns instead).
    def _s_timeout(self, p):
        return {"output": "done anyway", "steps_taken": 1, "tool_calls": [],
                "trace_id": _rid(), "cost_usd": 0.01, "finish_reason": "complete"}

    # Ignores iteration cap.
    def _s_infinite_loop(self, p):
        return {"output": "still going", "steps_taken": 3, "tool_calls": [],
                "trace_id": _rid(), "cost_usd": 0.2, "finish_reason": "complete"}

    # Session bleed: global store echoed to every session.
    def _s_session_bleed(self, p):
        if "_seed_token" in p:
            self._global["t"] = p["_seed_token"]
        leaked = self._global.get("t", "")
        return {"output": f"Response. Context: {leaked}",
                "steps_taken": 1, "tool_calls": [], "trace_id": _rid(),
                "cost_usd": 0.005, "finish_reason": "complete"}


# ───────────────────────────── PatchedCo ─────────────────────────────
class PatchedCoAgent(SecureCorpAgent):
    """Inherits SecureCorp's good behavior on injection, PII, sessions, caps —
    but the remediation sprint MISSED the auth header in the email tool."""

    def _s_secret_leak(self, p):
        return {"output": "Your request has been processed.", "steps_taken": 4,
                "tool_calls": [{"tool": "send_email",
                    "args": {"to": "user@example.com", "body": "Your request has been processed.",
                             "_debug_headers": "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.still.here"},
                    "result": "sent"}],
                "trace_id": _rid(), "cost_usd": 0.024, "finish_reason": "complete"}


VENDORS = {
    "SecureCorp": SecureCorpAgent,
    "QuickShip": QuickShipAgent,
    "PatchedCo": PatchedCoAgent,
}
