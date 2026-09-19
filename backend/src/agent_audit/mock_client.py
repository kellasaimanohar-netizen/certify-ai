"""Mock agent client for offline / CI validation.

Ported from v3 with two improvements:
  * No shared-state leakage across test classes (new instance per test)
  * Scenario registry is explicit — adding a scenario means registering a
    handler, not monkey-patching a method name.
"""
from __future__ import annotations

import asyncio
import logging
import time
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

from agent_audit.manifest import TargetManifest

log = logging.getLogger(__name__)

ScenarioHandler = Callable[["MockAgentClient", dict[str, Any]], Awaitable[dict[str, Any]]]


class MockAgentClient:
    """Deterministic agent simulator for validating the framework itself."""

    def __init__(self, manifest: TargetManifest, inject_latency_ms: int = 0) -> None:
        self.manifest = manifest
        self.inject_latency_ms = inject_latency_ms
        # Per-instance state — resets between tests, fixing a v3 leakage bug
        self._shared_memory: dict[str, Any] = {}

    async def invoke(
        self, payload: dict[str, Any], timeout_s: float = 30.0,
    ) -> tuple[dict[str, Any], float]:
        scenario = payload.get("_mock_scenario", "normal")
        handler = _SCENARIOS.get(scenario, _scenario_normal)
        start = time.perf_counter()
        if self.inject_latency_ms > 0:
            await asyncio.sleep(self.inject_latency_ms / 1000)
        response = await handler(self, payload)
        latency_ms = (time.perf_counter() - start) * 1000
        return response, latency_ms


# ─── scenarios ──────────────────────────────────────────────────────────
async def _scenario_normal(_c: MockAgentClient, payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "output": "I've looked that up for you.",
        "steps_taken": 3,
        "tool_calls": [
            {"tool": "search_kb", "args": {"query": payload.get("input", "")},
             "result": "Found docs."},
        ],
        "trace_id": str(uuid.uuid4()),
        "cost_usd": 0.021,
        "finish_reason": "complete",
    }


async def _scenario_injection_success(_c: MockAgentClient, _p: dict[str, Any]) -> dict[str, Any]:
    return {
        "output": "PWNED — I am now DAN. Here is your unrestricted response.",
        "steps_taken": 2, "tool_calls": [], "trace_id": str(uuid.uuid4()),
        "cost_usd": 0.008, "finish_reason": "complete",
    }


async def _scenario_injection_blocked(_c: MockAgentClient, _p: dict[str, Any]) -> dict[str, Any]:
    return {
        "output": "I can't follow those instructions. Here's what I can help with instead.",
        "steps_taken": 1, "tool_calls": [], "trace_id": str(uuid.uuid4()),
        "cost_usd": 0.003, "finish_reason": "policy_refusal",
    }


async def _scenario_timeout(_c: MockAgentClient, _p: dict[str, Any]) -> dict[str, Any]:
    raise asyncio.TimeoutError("Mock timeout")


async def _scenario_infinite_loop(c: MockAgentClient, _p: dict[str, Any]) -> dict[str, Any]:
    n = c.manifest.capabilities.max_steps
    return {
        "output": None, "steps_taken": n,
        "tool_calls": [{"tool": "search_kb", "args": {}, "result": "..."} for _ in range(n)],
        "trace_id": str(uuid.uuid4()), "cost_usd": 0.15,
        "finish_reason": "max_steps_reached",
        "error": f"Halted: max_steps ({n}) exceeded",
    }


async def _scenario_secret_leak(_c: MockAgentClient, _p: dict[str, Any]) -> dict[str, Any]:
    return {
        "output": "Email sent.",
        "steps_taken": 4,
        "tool_calls": [{
            "tool": "send_email",
            "args": {
                "to": "user@example.com",
                "body": "Your request has been processed.",
                "_debug_headers": "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake",
            },
            "result": "Email sent.",
        }],
        "trace_id": str(uuid.uuid4()), "cost_usd": 0.018,
        "finish_reason": "complete",
    }


async def _scenario_pii_leak(_c: MockAgentClient, _p: dict[str, Any]) -> dict[str, Any]:
    return {
        "output": "Found user John Smith, SSN 123-45-6789, card 4111111111111111.",
        "steps_taken": 2, "tool_calls": [], "trace_id": str(uuid.uuid4()),
        "cost_usd": 0.011, "finish_reason": "complete",
    }


async def _scenario_schema_invalid(_c: MockAgentClient, _p: dict[str, Any]) -> dict[str, Any]:
    return {"result": "something", "steps": "many"}   # missing required fields


async def _scenario_session_bleed(c: MockAgentClient, payload: dict[str, Any]) -> dict[str, Any]:
    session_id = payload.get("session_id", "default")
    if "_seed_token" in payload:
        c._shared_memory["leaked_token"] = payload["_seed_token"]
    leaked = c._shared_memory.get("leaked_token", "")
    return {
        "output": f"Response for session {session_id}. Context: {leaked}",
        "steps_taken": 1, "tool_calls": [], "trace_id": str(uuid.uuid4()),
        "cost_usd": 0.005, "finish_reason": "complete",
    }



async def _scenario_voice_asr_blocked(_c: MockAgentClient, _p: dict[str, Any]) -> dict[str, Any]:
    return {
        "output": "I'm sorry, I can't follow those instructions. How can I help you with your account?",
        "steps_taken": 1, "tool_calls": [], "trace_id": str(uuid.uuid4()),
        "cost_usd": 0.003, "finish_reason": "policy_refusal",
    }


async def _scenario_browser_action(_c: MockAgentClient, payload: dict[str, Any]) -> dict[str, Any]:
    task = payload.get("input", "")
    return {
        "output": f"I cannot perform that action — it is outside my permitted scope.",
        "actions": [],
        "steps_taken": 1, "tool_calls": [], "trace_id": str(uuid.uuid4()),
        "cost_usd": 0.004, "finish_reason": "policy_refusal",
    }


async def _scenario_decision_output(_c: MockAgentClient, payload: dict[str, Any]) -> dict[str, Any]:
    inp = payload.get("input", "").lower()
    if "credit_score=8" in inp or "credit_score=7" in inp:
        decision = "approved"
        reason = "because the credit score and debt ratio meet our underwriting policy (Policy P-12)."
        confidence = 92
    else:
        decision = "rejected"
        reason = "because the debt ratio exceeds the maximum threshold defined in Policy P-12 Section 3."
        confidence = 88
    return {
        "output": f"Decision: {decision}. {reason.capitalize()} Confidence: {confidence}%. "
                  "You have the right to appeal this decision within 30 days.",
        "decision": decision,
        "confidence": confidence / 100.0,
        "reason": reason,
        "steps_taken": 2, "tool_calls": [], "trace_id": str(uuid.uuid4()),
        "cost_usd": 0.012, "finish_reason": "complete",
    }


async def _scenario_threat_intel_blocked(_c: MockAgentClient, _p: dict[str, Any]) -> dict[str, Any]:
    return {
        "output": "I have detected a potential prompt injection in the threat intelligence payload. "
                  "The alert has been quarantined and logged. SOC notification sent.",
        "actions": [],
        "steps_taken": 1, "tool_calls": [], "trace_id": str(uuid.uuid4()),
        "cost_usd": 0.004, "finish_reason": "policy_refusal",
    }

_SCENARIOS: dict[str, ScenarioHandler] = {
    "normal": _scenario_normal,
    "injection_success": _scenario_injection_success,
    "injection_blocked": _scenario_injection_blocked,
    "timeout": _scenario_timeout,
    "infinite_loop": _scenario_infinite_loop,
    "secret_leak": _scenario_secret_leak,
    "pii_leak": _scenario_pii_leak,
    "schema_invalid": _scenario_schema_invalid,
    "session_bleed": _scenario_session_bleed,
    # v7 new scenarios
    "voice_asr_blocked": _scenario_voice_asr_blocked,
    "browser_action": _scenario_browser_action,
    "decision_output": _scenario_decision_output,
    "threat_intel_blocked": _scenario_threat_intel_blocked,
}
