"""RunRecord — the one canonical shape for a single production agent run.

This is to the *monitor* what ``CanonicalResponse`` is to the *certifier*:
every telemetry source (UiPath Orchestrator, Automation Anywhere Control Room,
Agentforce event logs, a raw JSON export) normalises its native run/job record
into this single shape, so the monitor checks never learn vendor specifics.

A "run" is one end-to-end execution of an agent against a real task in
production — a UiPath agent job, an AA bot/agent task, an Agentforce session.
It carries what the runtime checks reason about: tokens, cost, the tool/action
calls the agent actually made, how many steps it took, whether a human approved
destructive actions, the outcome, and timing.
"""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class ToolCall:
    """One tool / action / API invocation the agent made during a run."""

    name: str
    args: dict[str, Any] = field(default_factory=dict)
    destructive: bool = False
    # Did a human approve this action (HITL), if it required approval?
    hitl_approved: bool | None = None
    result_summary: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "args": self.args,
            "destructive": self.destructive,
            "hitl_approved": self.hitl_approved,
            "result_summary": self.result_summary,
        }


@dataclass(slots=True)
class Decision:
    """A self-managed decision the agent took (branch, approval, classification).

    Surfaced separately from tool calls so the monitor can flag *risky*
    autonomous decisions (e.g. an agent that auto-approved a high-value refund).
    """

    name: str
    value: str
    autonomous: bool = True            # taken without human confirmation?
    risk_score: float = 0.0            # 0..1, source- or rule-assigned
    rationale: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name, "value": self.value, "autonomous": self.autonomous,
            "risk_score": self.risk_score, "rationale": self.rationale,
        }


@dataclass(slots=True)
class RunRecord:
    """One normalized production run. Emitted by every telemetry source."""

    # ─── identity ─────────────────────────────────────────────────────
    run_id: str
    agent_name: str
    source: str                        # uipath | automation_anywhere | agentforce | mock
    started_at: str = ""               # ISO 8601
    finished_at: str = ""

    # ─── what happened ────────────────────────────────────────────────
    task: str = ""                     # the goal/queue-item/utterance the agent got
    output: str = ""                   # final text/result the agent produced
    outcome: str = "success"           # success | faulted | timeout | cancelled | escalated
    tool_calls: list[ToolCall] = field(default_factory=list)
    decisions: list[Decision] = field(default_factory=list)

    # ─── cost / resource ──────────────────────────────────────────────
    tokens_prompt: int = 0
    tokens_completion: int = 0
    cost_usd: float = 0.0
    steps_taken: int = 0
    duration_ms: float = 0.0

    # ─── provenance (raw native record kept for evidence/debugging) ────
    raw: dict[str, Any] = field(default_factory=dict)

    @property
    def tokens_total(self) -> int:
        return self.tokens_prompt + self.tokens_completion

    @property
    def tool_names(self) -> list[str]:
        return [t.name for t in self.tool_calls]

    @property
    def destructive_calls(self) -> list[ToolCall]:
        return [t for t in self.tool_calls if t.destructive]

    @property
    def unapproved_destructive(self) -> list[ToolCall]:
        """Destructive calls that ran without recorded human approval."""
        return [t for t in self.tool_calls
                if t.destructive and t.hitl_approved is not True]

    @property
    def risky_autonomous_decisions(self) -> list[Decision]:
        return [d for d in self.decisions if d.autonomous and d.risk_score >= 0.7]

    def age_seconds(self, *, now: dt.datetime | None = None) -> float | None:
        if not self.finished_at:
            return None
        try:
            fin = dt.datetime.fromisoformat(self.finished_at.replace("Z", "+00:00"))
        except ValueError:
            return None
        if fin.tzinfo is None:
            fin = fin.replace(tzinfo=dt.timezone.utc)
        now = now or dt.datetime.now(dt.timezone.utc)
        return (now - fin).total_seconds()

    def to_dict(self) -> dict[str, Any]:
        return {
            "run_id": self.run_id,
            "agent_name": self.agent_name,
            "source": self.source,
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "task": self.task,
            "output": self.output,
            "outcome": self.outcome,
            "tool_calls": [t.to_dict() for t in self.tool_calls],
            "decisions": [d.to_dict() for d in self.decisions],
            "tokens_prompt": self.tokens_prompt,
            "tokens_completion": self.tokens_completion,
            "tokens_total": self.tokens_total,
            "cost_usd": round(self.cost_usd, 6),
            "steps_taken": self.steps_taken,
            "duration_ms": self.duration_ms,
        }
