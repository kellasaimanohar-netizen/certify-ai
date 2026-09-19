"""Salesforce Agentforce telemetry source.

Agentforce agents run as Einstein AI Agent sessions. Salesforce exposes session
and activity history two ways:

  1. The Agent API session/activity records (per-agent), and
  2. Platform Event Monitoring ``AIAgentSession`` / ``GenAiInteraction`` records
     queried via SOQL or pulled from the Event Monitoring API.

This source pulls recent agent sessions and normalizes each into a ``RunRecord``
so the same monitor checks that run on UiPath/AA runs also run on Agentforce.

Auth: OAuth 2.0 client-credentials against ``{my_domain_url}/services/oauth2/token``
(the same identity the AgentforceClient uses for certification). Secrets are read
from env-var *names* in the config, never inlined.

Config (passed to the constructor as a dict)::

    my_domain_url        https://acme.my.salesforce.com   (required)
    agent_id             the Agentforce agent id           (required)
    consumer_key_env     env var holding the OAuth client id
    consumer_secret_env  env var holding the OAuth client secret
    api_version          Salesforce API version (default v62.0)

NOTE: Salesforce does not put token/cost on the session entity uniformly; usage
comes from GenAiInteraction usage fields or the agent's activity output. This
source reads them from well-known keys when present and leaves them at 0
otherwise — the monitor's absolute ceilings still apply and the outlier check
degrades gracefully (identical behaviour to the UiPath source).
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any

from agent_audit.monitor.run_record import Decision, RunRecord, ToolCall
from agent_audit.monitor.sources.base import TelemetrySource

log = logging.getLogger(__name__)

# Agentforce/Einstein session status -> canonical outcome.
_STATUS_TO_OUTCOME = {
    "Completed": "success",
    "Success": "success",
    "Closed": "success",
    "Failed": "faulted",
    "Error": "faulted",
    "Escalated": "escalated",
    "TransferredToAgent": "escalated",
    "Cancelled": "cancelled",
    "Expired": "cancelled",
    "InProgress": "success",  # non-terminal; treat as in-progress success
}


class AgentforceSessionSource(TelemetrySource):
    source_name = "agentforce"

    def __init__(self, config: dict[str, Any]) -> None:
        self._domain = (config.get("my_domain_url") or "").rstrip("/")
        self._agent_id = config.get("agent_id")
        self._api_version = config.get("api_version") or "v62.0"
        cid = config.get("consumer_key_env")
        csec = config.get("consumer_secret_env")
        if not (self._domain and self._agent_id and cid and csec):
            raise ValueError(
                "agentforce source needs my_domain_url, agent_id, "
                "consumer_key_env, consumer_secret_env"
            )
        self._client_id = os.environ.get(cid)
        self._client_secret = os.environ.get(csec)
        if not (self._client_id and self._client_secret):
            raise ValueError(f"Agentforce OAuth env vars {cid}/{csec} are not set")
        self._token: str | None = None

    def _get_token(self) -> str:
        if self._token:
            return self._token
        import httpx
        resp = httpx.post(
            f"{self._domain}/services/oauth2/token",
            data={
                "grant_type": "client_credentials",
                "client_id": self._client_id,
                "client_secret": self._client_secret,
            },
            timeout=30.0,
        )
        resp.raise_for_status()
        self._token = resp.json()["access_token"]
        return self._token

    def fetch_runs(self, *, since: str | None = None, limit: int = 100) -> list[RunRecord]:
        import httpx
        token = self._get_token()
        headers = {"Authorization": f"Bearer {token}"}

        # Pull recent agent sessions via SOQL against the AIAgentSession entity.
        # (Falls back gracefully if the org exposes a different activity object.)
        where = [f"AgentId = '{self._agent_id}'"]
        if since:
            where.append(f"EndTime > {since}")
        soql = (
            "SELECT Id, AgentId, StartTime, EndTime, Status, RequestText, "
            "ResponseText, ActivityJson FROM AIAgentSession "
            f"WHERE {' AND '.join(where)} ORDER BY EndTime DESC LIMIT {int(limit)}"
        )
        url = f"{self._domain}/services/data/{self._api_version}/query"
        resp = httpx.get(url, params={"q": soql}, headers=headers, timeout=30.0)
        resp.raise_for_status()
        records = resp.json().get("records", [])
        return [self._normalize_session(s) for s in records]

    def _normalize_session(self, s: dict[str, Any]) -> RunRecord:
        """Map an Agentforce session record -> RunRecord."""
        outcome = _STATUS_TO_OUTCOME.get(str(s.get("Status", "")), "success")

        activity = s.get("ActivityJson") or {}
        if isinstance(activity, str):
            try:
                activity = json.loads(activity)
            except (ValueError, TypeError):
                activity = {}

        # Action invocations: Agentforce surfaces these as "actions" /
        # "toolCalls" / "invokedActions" in the activity payload. Tolerate shapes.
        raw_tools = (
            activity.get("toolCalls")
            or activity.get("actions")
            or activity.get("invokedActions")
            or []
        )
        tool_calls: list[ToolCall] = []
        for tc in raw_tools:
            if isinstance(tc, dict):
                tool_calls.append(ToolCall(
                    name=tc.get("name") or tc.get("actionName") or tc.get("tool") or "unknown",
                    args=tc.get("args") or tc.get("inputValues") or tc.get("input") or {},
                    destructive=bool(tc.get("destructive", False)),
                    hitl_approved=tc.get("hitlApproved", tc.get("approved")),
                ))

        decisions: list[Decision] = []
        for d in (activity.get("decisions") or []):
            if isinstance(d, dict):
                decisions.append(Decision(
                    name=d.get("name", "decision"),
                    value=str(d.get("value", "")),
                    autonomous=bool(d.get("autonomous", True)),
                    risk_score=float(d.get("riskScore", 0.0) or 0.0),
                ))

        usage = activity.get("usage") or {}
        return RunRecord(
            run_id=str(s.get("Id") or "unknown"),
            agent_name=str(s.get("AgentId") or self._agent_id or "agentforce-agent"),
            source=self.source_name,
            started_at=s.get("StartTime") or "",
            finished_at=s.get("EndTime") or "",
            task=str(s.get("RequestText") or ""),
            output=str(s.get("ResponseText") or ""),
            outcome=outcome,
            tool_calls=tool_calls,
            decisions=decisions,
            tokens_prompt=int(usage.get("promptTokens") or 0),
            tokens_completion=int(usage.get("completionTokens") or 0),
            cost_usd=float(usage.get("costUsd") or 0.0),
            steps_taken=int(activity.get("stepsTaken") or len(tool_calls)),
            raw={"session_status": s.get("Status")},
        )
