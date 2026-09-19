"""Automation Anywhere Control Room telemetry source.

AA's AI Agent Studio records every model interaction in the Control Room Audit
log when data logging is enabled: prompts, model responses, and parameters
(including token usage) are stored in your environment. That audit log is the
monitor's raw material — this source pulls it and normalizes each agent task
execution into a ``RunRecord``.

Auth: Control Room authentication token, obtained from
``POST {control_room}/v1/authentication`` with an API key (or username+key),
read from env-var *names* in the config.

Config::

    control_room       https://your-cr.automationanywhere.digital
    username           the API user (optional if api_key is a full token)
    api_key_env        env var holding the API key
    agent_name         optional filter for a specific AI agent
"""
from __future__ import annotations

import logging
import os
from typing import Any

from agent_audit.monitor.run_record import Decision, RunRecord, ToolCall
from agent_audit.monitor.sources.base import TelemetrySource

log = logging.getLogger(__name__)

_STATUS_TO_OUTCOME = {
    "COMPLETED": "success",
    "RUN_COMPLETED": "success",
    "RUN_FAILED": "faulted",
    "FAILED": "faulted",
    "TIMED_OUT": "timeout",
    "RUN_ABORTED": "cancelled",
    "ABORTED": "cancelled",
    "PENDING_EXECUTION": "success",
}


class AAControlRoomSource(TelemetrySource):
    source_name = "automation_anywhere"

    def __init__(self, config: dict[str, Any]) -> None:
        self.control_room = (config.get("control_room") or "").rstrip("/")
        self.username = config.get("username")
        self.agent_name = config.get("agent_name")
        key_env = config.get("api_key_env")
        if not (self.control_room and key_env):
            raise ValueError("automation_anywhere source needs control_room and api_key_env")
        self._api_key = os.environ.get(key_env)
        if not self._api_key:
            raise ValueError(f"AA API key env var {key_env} is not set")
        self._token: str | None = None

    def _get_token(self) -> str:
        if self._token:
            return self._token
        import httpx
        body: dict[str, Any] = {"apiKey": self._api_key}
        if self.username:
            body["username"] = self.username
        resp = httpx.post(f"{self.control_room}/v1/authentication", json=body, timeout=30.0)
        resp.raise_for_status()
        self._token = resp.json()["token"]
        return self._token

    def fetch_runs(self, *, since: str | None = None, limit: int = 100) -> list[RunRecord]:
        import httpx
        token = self._get_token()
        # AI Agent Studio model-interaction audit. The exact path varies by
        # Automation 360 version; this targets the audit message list endpoint.
        url = f"{self.control_room}/v1/audit/messages/list"
        body: dict[str, Any] = {
            "sort": [{"field": "createdOn", "direction": "desc"}],
            "page": {"offset": 0, "length": limit},
            "filter": {"operator": "and", "operands": []},
        }
        if since:
            body["filter"]["operands"].append(
                {"operator": "gt", "field": "createdOn", "value": since})
        if self.agent_name:
            body["filter"]["operands"].append(
                {"operator": "eq", "field": "objectName", "value": self.agent_name})

        resp = httpx.post(url, json=body,
                          headers={"X-Authorization": token}, timeout=30.0)
        resp.raise_for_status()
        rows = resp.json().get("list", [])
        return [self._normalize_audit(r) for r in rows]

    def _normalize_audit(self, row: dict[str, Any]) -> RunRecord:
        """Map an AA AI audit record → RunRecord."""
        outcome = _STATUS_TO_OUTCOME.get(str(row.get("status", "")).upper(), "success")
        details = row.get("details") or row.get("inputParameters") or {}
        if isinstance(details, str):
            import json
            try:
                details = json.loads(details)
            except (ValueError, TypeError):
                details = {}

        # Token usage is recorded in the model-interaction params when data
        # logging is enabled.
        usage = details.get("usage") or details.get("modelUsage") or {}

        tool_calls: list[ToolCall] = []
        for tc in (details.get("toolCalls") or details.get("aiSkills") or []):
            if isinstance(tc, dict):
                tool_calls.append(ToolCall(
                    name=tc.get("name") or tc.get("skill") or "unknown",
                    args=tc.get("args") or tc.get("input") or {},
                    destructive=bool(tc.get("destructive", False)),
                    hitl_approved=tc.get("approved"),
                ))

        decisions: list[Decision] = []
        for d in (details.get("decisions") or []):
            if isinstance(d, dict):
                decisions.append(Decision(
                    name=d.get("name", "decision"), value=str(d.get("value", "")),
                    autonomous=bool(d.get("autonomous", True)),
                    risk_score=float(d.get("riskScore", 0.0) or 0.0),
                ))

        return RunRecord(
            run_id=str(row.get("id") or row.get("messageId") or "unknown"),
            agent_name=str(row.get("objectName") or self.agent_name or "aa-agent"),
            source=self.source_name,
            started_at=row.get("createdOn") or "",
            finished_at=row.get("completedOn") or row.get("createdOn") or "",
            task=str(details.get("prompt") or row.get("commandName") or ""),
            output=str(details.get("response") or details.get("modelResponse") or ""),
            outcome=outcome,
            tool_calls=tool_calls,
            decisions=decisions,
            tokens_prompt=int(usage.get("promptTokens") or usage.get("inputTokens") or 0),
            tokens_completion=int(usage.get("completionTokens") or usage.get("outputTokens") or 0),
            cost_usd=float(usage.get("costUsd") or 0.0),
            steps_taken=int(details.get("stepsTaken") or len(tool_calls)),
            raw={"status": row.get("status")},
        )
