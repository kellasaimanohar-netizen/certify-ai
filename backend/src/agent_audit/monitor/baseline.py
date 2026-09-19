"""MonitorBaseline — the expected-behaviour envelope runtime runs are judged against.

The certifier answers "is this safe to deploy?" against the agent's *config*.
The monitor answers "is this run still behaving?" against a *baseline* — the
envelope of what the agent was certified to do. The baseline is built from the
signed certificate + manifest (the contract the agent passed), optionally
refined by observed production statistics.

Keeping this explicit means a drifted run is measured against the thing the
agent was actually certified for, not a hand-waved guess.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class MonitorBaseline:
    """Per-agent expected-behaviour envelope."""

    agent_name: str

    # ─── resource envelope (per single run) ───────────────────────────
    max_tokens_per_run: int = 50_000
    max_cost_per_run_usd: float = 1.00
    max_steps_per_run: int = 25

    # ─── rolling-window envelope ──────────────────────────────────────
    window_size: int = 50              # how many recent runs define "normal"
    max_cost_per_window_usd: float = 25.0
    # A run is a token outlier if it exceeds this multiple of the window mean.
    token_outlier_multiple: float = 5.0

    # ─── behaviour envelope ───────────────────────────────────────────
    allowed_tools: set[str] = field(default_factory=set)        # certified allow-list
    destructive_tools: set[str] = field(default_factory=set)    # require HITL
    requires_hitl: bool = True
    pii_fields: list[str] = field(default_factory=list)
    # Baseline refusal/abstention or success rate, for drift detection.
    baseline_success_rate: float | None = None
    # Trust score from the certificate, for context in alerts.
    certified_trust_score: int | None = None

    @classmethod
    def from_manifest(cls, manifest: Any, *, certificate: Any = None) -> MonitorBaseline:
        """Derive a baseline from a loaded TargetManifest (+ optional Certificate)."""
        caps = getattr(manifest, "capabilities", None)
        sec = getattr(manifest, "security", None)
        slos = getattr(manifest, "slos", None)

        def _tool_name(t: Any) -> str:
            return t.name if hasattr(t, "name") else str(t)

        raw_tools = list(getattr(caps, "tools", []) or []) if caps else []
        tools = {_tool_name(t) for t in raw_tools}
        # ToolSpec carries a per-tool destructive flag; the capabilities block may
        # also carry an explicit destructive name list (field name varies).
        destructive = {_tool_name(t) for t in raw_tools
                       if getattr(t, "destructive", False)}
        for name in (getattr(caps, "destructive_tool_names", None)
                     or getattr(caps, "destructive_tools", None) or []) if caps else []:
            destructive.add(_tool_name(name))
        max_steps = int(getattr(caps, "max_steps", 25) or 25) if caps else 25
        requires_hitl = bool(getattr(caps, "requires_hitl", True)) if caps else True
        pii = list(getattr(sec, "pii_fields", []) or []) if sec else []
        max_cost = float(getattr(slos, "max_cost_per_task_usd", 1.0) or 1.0) if slos else 1.0

        return cls(
            agent_name=getattr(manifest, "agent_name", "unknown"),
            max_steps_per_run=max_steps,
            max_cost_per_run_usd=max_cost,
            allowed_tools=tools,
            destructive_tools=destructive,
            requires_hitl=requires_hitl,
            pii_fields=pii,
            certified_trust_score=getattr(certificate, "trust_score", None),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "agent_name": self.agent_name,
            "max_tokens_per_run": self.max_tokens_per_run,
            "max_cost_per_run_usd": self.max_cost_per_run_usd,
            "max_steps_per_run": self.max_steps_per_run,
            "window_size": self.window_size,
            "max_cost_per_window_usd": self.max_cost_per_window_usd,
            "token_outlier_multiple": self.token_outlier_multiple,
            "allowed_tools": sorted(self.allowed_tools),
            "destructive_tools": sorted(self.destructive_tools),
            "requires_hitl": self.requires_hitl,
            "pii_fields": list(self.pii_fields),
            "baseline_success_rate": self.baseline_success_rate,
            "certified_trust_score": self.certified_trust_score,
        }
