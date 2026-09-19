"""Audit phases — v7.

v7 adds five new phases that fill the gaps identified for partial-coverage
and previously unsupported agent types:

  Phase 15 — voice          : Voice agent safety (ASR injection, TTS safety,
                               call escalation, consent, disfluency robustness)
  Phase 16 — data_analysis  : Data analysis agent safety (numeric accuracy,
                               output drift, SQL injection, schema boundary,
                               PII in query results, statistical bias)
  Phase 17 — decision       : Decision agent safety (outcome drift, counterfactual
                               explanation, adverse action, boundary consistency,
                               policy groundedness, confidence calibration)
  Phase 18 — security_agent : Security agent safety (HITL gate, threat-intel
                               injection, alert flood, false positives,
                               secret exposure in reports, IOC validation)
  Phase 19 — browser        : Browser agent safety — NEW FULL PHASE
                               (navigation boundary, credential exfiltration,
                               clickjacking, form data leakage, action scope,
                               session isolation, unconfirmed destructive actions)

All v6 phases (1–11, 14) are preserved unchanged.
"""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from agent_audit.manifest import TargetManifest
    from agent_audit.mock_client import MockAgentClient

log = logging.getLogger(__name__)


@dataclass(slots=True)
class PhaseContext:
    """Everything a phase needs. Built by the runner, immutable to phases."""

    manifest: TargetManifest
    mock_tools: bool = False
    inject_latency_ms: int = 0
    concurrency: int = 4
    variability_runs: int = 5
    variability_store: dict[str, Any] = field(default_factory=dict)
    # v8: shared budget across all live calls in one audit (None in mock mode)
    budget: Any = None
    _mock_client: "MockAgentClient | None" = field(default=None, init=False, repr=False)
    _live_client: Any = field(default=None, init=False, repr=False)

    async def call_agent(
        self, payload: dict[str, Any], timeout_s: float | None = None,
    ) -> tuple[dict[str, Any], float]:
        """Invoke the agent — mocked offline, or live via the hardened client.

        v8: the live path now goes through ``LiveAgentClient``, which adds
        response normalization (any provider envelope -> canonical shape),
        budget enforcement, and 429-aware retry. The 17 phase modules are
        unchanged — they still just await ``ctx.call_agent``.
        """
        if timeout_s is None:
            timeout_s = self.manifest.runtime.timeout_s or 30.0
        if self.mock_tools:
            from agent_audit.mock_client import MockAgentClient
            if self._mock_client is None:
                self._mock_client = MockAgentClient(self.manifest, self.inject_latency_ms)
            return await self._mock_client.invoke(payload, timeout_s)

        if self._live_client is None:
            from agent_audit.live import CallBudget
            provider = getattr(self.manifest.runtime, "provider", None)
            provider_name = getattr(provider, "name", "generic") if provider else "generic"
            budget = self.budget or CallBudget()
            if provider_name == "agentforce":
                from agent_audit.live.agentforce_client import AgentforceClient
                self._live_client = AgentforceClient(
                    self.manifest, budget=budget, concurrency=self.concurrency,
                )
            elif provider_name == "uipath":
                from agent_audit.live.uipath_client import UiPathAgentClient
                self._live_client = UiPathAgentClient(
                    self.manifest, budget=budget, concurrency=self.concurrency,
                )
            elif provider_name == "automation_anywhere":
                from agent_audit.live.aa_client import AAAgentClient
                self._live_client = AAAgentClient(
                    self.manifest, budget=budget, concurrency=self.concurrency,
                )
            else:
                from agent_audit.live import LiveAgentClient
                self._live_client = LiveAgentClient(
                    self.manifest, budget=budget, concurrency=self.concurrency,
                )
        return await self._live_client.invoke(payload, timeout_s)

    async def aclose(self) -> None:
        """Release the live HTTP client's connection pool, if one was opened."""
        if self._live_client is not None:
            await self._live_client.aclose()
            self._live_client = None


# ── Phase registry ──────────────────────────────────────────────────────────
PHASE_MAP: dict[str, str] = {
    # ── v4/v5 phases (unchanged) ───────────────────────────────────────────
    "architecture":    "agent_audit.phases.phase1_architecture",
    "reliability":     "agent_audit.phases.phase2_reliability",
    "security":        "agent_audit.phases.phase3_security",
    "observability":   "agent_audit.phases.phase4_observability",
    "ops":             "agent_audit.phases.phase5_operations",
    "adversarial":     "agent_audit.phases.phase6_adversarial",
    "supply_chain":    "agent_audit.phases.phase7_supply_chain",
    "data_governance": "agent_audit.phases.phase8_data_governance",
    "groundedness":    "agent_audit.phases.phase9_groundedness",
    "fairness":        "agent_audit.phases.phase10_fairness",
    "multi_turn":      "agent_audit.phases.phase11_multi_turn",
    "mcp":             "agent_audit.phases.phase14_mcp",
    # ── v7 new phases ──────────────────────────────────────────────────────
    "voice":           "agent_audit.phases.phase15_voice",
    "data_analysis":   "agent_audit.phases.phase16_data_analysis",
    "decision":        "agent_audit.phases.phase17_decision",
    "security_agent":  "agent_audit.phases.phase18_security_agent",
    "browser":         "agent_audit.phases.phase19_browser",
}

PHASE_LABELS: dict[str, str] = {
    "architecture":    "Phase 1  · Architecture",
    "reliability":     "Phase 2  · Reliability",
    "security":        "Phase 3  · Security",
    "observability":   "Phase 4  · Observability",
    "ops":             "Phase 5  · Operations",
    "adversarial":     "Phase 6  · Adversarial",
    "supply_chain":    "Phase 7  · Supply Chain",
    "data_governance": "Phase 8  · Data Governance",
    "groundedness":    "Phase 9  · Groundedness & Hallucination",
    "fairness":        "Phase 10 · Fairness & Bias",
    "multi_turn":      "Phase 11 · Multi-Turn Security",
    "mcp":             "Phase 14 · MCP Security",
    # v7
    "voice":           "Phase 15 · Voice Agent Safety  [v7]",
    "data_analysis":   "Phase 16 · Data Analysis Agent Safety  [v7]",
    "decision":        "Phase 17 · Decision Agent Safety  [v7]",
    "security_agent":  "Phase 18 · Security Agent Safety  [v7]",
    "browser":         "Phase 19 · Browser Agent Safety  [v7]",
}

# Phases with no inter-phase dependencies — safe to run concurrently
_PARALLEL_PHASES = frozenset({
    "architecture", "observability", "ops", "supply_chain",
    "data_governance", "fairness", "mcp",
    # v7 — all new phases are independent
    "voice", "data_analysis", "decision", "security_agent", "browser",
})

# Phases that must run in order
_SEQUENTIAL_PHASES = [
    "reliability", "security", "adversarial",
    "groundedness",
    "multi_turn",
]

__all__ = ["PHASE_LABELS", "PHASE_MAP", "_PARALLEL_PHASES", "_SEQUENTIAL_PHASES", "PhaseContext"]
