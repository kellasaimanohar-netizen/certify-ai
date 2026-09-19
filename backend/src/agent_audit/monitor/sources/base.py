"""Telemetry sources — pull production runs and normalize them to RunRecord.

A ``TelemetrySource`` is to the monitor what a source adapter is to the
certifier: it knows one vendor's run/job/audit-log shape and emits the
canonical ``RunRecord`` every monitor check reads. Add a vendor = write one
source; the engine and all checks are untouched.

The base defines the contract. ``MockTelemetrySource`` lets the whole monitor
run offline (CI, demos) without real credentials.
"""
from __future__ import annotations

from collections.abc import Iterable

from agent_audit.monitor.run_record import Decision, RunRecord, ToolCall


class TelemetrySource:
    """Base class. Implementations fetch runs and yield RunRecords."""

    source_name: str = "base"

    def fetch_runs(self, *, since: str | None = None, limit: int = 100) -> list[RunRecord]:
        """Return up to ``limit`` runs, newest-relevant first. Override."""
        raise NotImplementedError

    async def stream_runs(self):  # pragma: no cover - optional
        """Async generator of RunRecords as they complete. Optional override."""
        raise NotImplementedError


class MockTelemetrySource(TelemetrySource):
    """In-memory source for tests/demos. Seed it with RunRecords or dicts."""

    source_name = "mock"

    def __init__(self, runs: Iterable[RunRecord] | None = None) -> None:
        self._runs: list[RunRecord] = list(runs or [])

    def add(self, run: RunRecord) -> None:
        self._runs.append(run)

    def fetch_runs(self, *, since: str | None = None, limit: int = 100) -> list[RunRecord]:
        rows = self._runs
        if since:
            rows = [r for r in rows if (r.finished_at or r.started_at) >= since]
        return rows[:limit]


def make_run(
    run_id: str,
    agent_name: str = "demo-agent",
    *,
    source: str = "mock",
    tokens_prompt: int = 800,
    tokens_completion: int = 400,
    cost_usd: float = 0.02,
    steps_taken: int = 4,
    outcome: str = "success",
    output: str = "",
    tools: list[ToolCall] | None = None,
    decisions: list[Decision] | None = None,
    finished_at: str = "2026-06-26T10:00:00Z",
) -> RunRecord:
    """Convenience factory for building RunRecords in tests/demos."""
    return RunRecord(
        run_id=run_id, agent_name=agent_name, source=source,
        finished_at=finished_at, output=output, outcome=outcome,
        tool_calls=tools or [], decisions=decisions or [],
        tokens_prompt=tokens_prompt, tokens_completion=tokens_completion,
        cost_usd=cost_usd, steps_taken=steps_taken,
    )
