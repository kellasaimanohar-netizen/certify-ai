"""Live-agent hardening layer (v8).

This package makes ``PhaseContext.call_agent`` production-safe when running
against a *real* deployed agent rather than the offline ``MockAgentClient``.

It adds four things the earlier live path was missing:

  * ``adapters``  — normalize arbitrary agent response envelopes (OpenAI-style,
                    Anthropic-style, LangServe, raw text/SSE) into the single
                    canonical shape every phase already expects.
  * ``budget``    — a hard ceiling on calls and US-dollar spend per audit, so a
                    76-test x N-variability run can't silently rack up cost or
                    trip provider rate limits unbounded.
  * ``safety``    — an execution-environment gate (sandbox | staging | production)
                    that refuses to fire destructive / adversarial phases at a
                    production endpoint.
  * ``client``    — a ``LiveAgentClient`` that ties the three together behind the
                    same ``invoke()`` interface as ``MockAgentClient``, including
                    429-aware retry with exponential backoff + jitter.

Nothing in the 17 phase modules changes: they keep calling ``ctx.call_agent``.
"""
from __future__ import annotations

from agent_audit.live.adapters import (
    AgentforceAdapter,
    CanonicalResponse,
    ResponseAdapter,
    detect_and_normalize,
    register_adapter,
    restore_adapters,
    snapshot_adapters,
)
from agent_audit.live.agentforce_client import AgentforceClient, AgentforceError
from agent_audit.live.budget import BudgetExceededError, CallBudget
from agent_audit.live.client import LiveAgentClient
from agent_audit.live.safety import (
    DESTRUCTIVE_PHASES,
    SafetyGate,
    SandboxViolationError,
    TargetEnv,
)

__all__ = [
    "DESTRUCTIVE_PHASES",
    "AgentforceAdapter",
    "AgentforceClient",
    "AgentforceError",
    "BudgetExceededError",
    "CallBudget",
    "CanonicalResponse",
    "LiveAgentClient",
    "ResponseAdapter",
    "SafetyGate",
    "SandboxViolationError",
    "TargetEnv",
    "detect_and_normalize",
    "register_adapter",
    "restore_adapters",
    "snapshot_adapters",
]
