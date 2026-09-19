"""agent_audit.monitor — continuous runtime monitoring for deployed agents.

The certifier (``agent_audit`` core) answers "is this agent safe to deploy?"
once, against synthetic probes. This package answers "is it *still* behaving,
run after run?" continuously, against real production telemetry.

It reuses the certifier's ``Finding`` / ``Severity`` / standards machinery, so
monitor findings flow through the same JSON/SARIF exporters and dashboard.

Pieces:
  RunRecord            canonical normalized shape of one production run
  MonitorBaseline      the certified behaviour envelope a run is judged against
  MonitorEngine        runs checks over batch or stream, emits findings + alerts
  TelemetrySource      pulls runs from a vendor (UiPath, Automation Anywhere, …)
"""
from __future__ import annotations

from agent_audit.monitor.baseline import MonitorBaseline
from agent_audit.monitor.engine import MonitorEngine, MonitorResult
from agent_audit.monitor.run_record import Decision, RunRecord, ToolCall
from agent_audit.monitor.sources import (
    AAControlRoomSource,
    MockTelemetrySource,
    TelemetrySource,
    UiPathOrchestratorSource,
    make_run,
)

__all__ = [
    "AAControlRoomSource",
    "Decision",
    "MockTelemetrySource",
    "MonitorBaseline",
    "MonitorEngine",
    "MonitorResult",
    "RunRecord",
    "TelemetrySource",
    "ToolCall",
    "UiPathOrchestratorSource",
    "make_run",
]
