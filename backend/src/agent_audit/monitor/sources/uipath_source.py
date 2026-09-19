"""UiPath Orchestrator telemetry source.

UiPath agents run as jobs on Automation Cloud. Orchestrator exposes an OData
API (OAuth 2.0 via UiPath Identity Server) over Jobs, Robots, Queues, and an
Audit log. This source pulls recent agent jobs and normalizes each into a
``RunRecord``.

Auth: client-credentials against the Identity Server token endpoint, scoped to
``OR.Jobs OR.Monitoring OR.Audit``. Secrets are read from env-var *names* in the
config, never inlined.

Config (passed to the constructor as a dict)::

    base_url           https://cloud.uipath.com/{account}/{tenant}
    identity_url       https://cloud.uipath.com/identity_/connect/token
    client_id_env      env var holding the OAuth client id
    client_secret_env  env var holding the OAuth client secret
    agent_name         the agent/process whose jobs to pull (optional filter)

NOTE: UiPath does not return token/cost on the Job entity directly; those come
from the job's output arguments or the AI Trust Layer usage records. This source
reads them from well-known output keys when present and leaves them at 0
otherwise (the monitor's absolute ceilings still apply; the outlier check
degrades gracefully).
"""
from __future__ import annotations

import logging
import os
from typing import Any

from agent_audit.monitor.run_record import Decision, RunRecord, ToolCall
from agent_audit.monitor.sources.base import TelemetrySource

log = logging.getLogger(__name__)

_JOB_STATE_TO_OUTCOME = {
    "Successful": "success",
    "Faulted": "faulted",
    "Stopped": "cancelled",
    "Stopping": "cancelled",
    "Suspended": "escalated",
    "Pending": "success",   # not terminal; treated as in-progress success
    "Running": "success",
}


class UiPathOrchestratorSource(TelemetrySource):
    source_name = "uipath"

    def __init__(self, config: dict[str, Any]) -> None:
        self.base_url = (config.get("base_url") or "").rstrip("/")
        self.identity_url = (config.get("identity_url")
                             or "https://cloud.uipath.com/identity_/connect/token")
        self.agent_name = config.get("agent_name")
        cid = config.get("client_id_env")
        csec = config.get("client_secret_env")
        if not (self.base_url and cid and csec):
            raise ValueError("uipath source needs base_url, client_id_env, client_secret_env")
        self._client_id = os.environ.get(cid)
        self._client_secret = os.environ.get(csec)
        if not (self._client_id and self._client_secret):
            raise ValueError(f"UiPath OAuth env vars {cid}/{csec} are not set")
        self._token: str | None = None

    def _get_token(self) -> str:
        if self._token:
            return self._token
        import httpx
        resp = httpx.post(
            self.identity_url,
            data={
                "grant_type": "client_credentials",
                "client_id": self._client_id,
                "client_secret": self._client_secret,
                "scope": "OR.Jobs OR.Monitoring OR.Audit",
            },
            timeout=30.0,
        )
        resp.raise_for_status()
        self._token = resp.json()["access_token"]
        return self._token

    def fetch_runs(self, *, since: str | None = None, limit: int = 100) -> list[RunRecord]:
        import httpx
        token = self._get_token()
        # OData: newest jobs first, optionally filtered to the agent's process.
        params = {
            "$top": str(limit),
            "$orderby": "EndTime desc",
            "$expand": "Release",
        }
        filters = ["EndTime ne null"]
        if since:
            filters.append(f"EndTime gt {since}")
        if self.agent_name:
            filters.append(f"Release/ProcessKey eq '{self.agent_name}'")
        params["$filter"] = " and ".join(filters)

        url = f"{self.base_url}/orchestrator_/odata/Jobs"
        resp = httpx.get(url, params=params,
                         headers={"Authorization": f"Bearer {token}"}, timeout=30.0)
        resp.raise_for_status()
        jobs = resp.json().get("value", [])
        return [self._normalize_job(j) for j in jobs]

    def _normalize_job(self, job: dict[str, Any]) -> RunRecord:
        """Map a UiPath Job entity → RunRecord."""
        outcome = _JOB_STATE_TO_OUTCOME.get(str(job.get("State", "")), "success")
        out_args = job.get("OutputArguments") or {}
        if isinstance(out_args, str):
            import json
            try:
                out_args = json.loads(out_args)
            except (ValueError, TypeError):
                out_args = {}

        # Tool/action invocations: UiPath surfaces these in output args or in the
        # agent's "actions" / "toolCalls" output. Tolerate several shapes.
        tool_calls: list[ToolCall] = []
        for tc in (out_args.get("toolCalls") or out_args.get("actions") or []):
            if isinstance(tc, dict):
                tool_calls.append(ToolCall(
                    name=tc.get("name") or tc.get("tool") or "unknown",
                    args=tc.get("args") or tc.get("input") or {},
                    destructive=bool(tc.get("destructive", False)),
                    hitl_approved=tc.get("hitlApproved"),
                ))

        decisions: list[Decision] = []
        for d in (out_args.get("decisions") or []):
            if isinstance(d, dict):
                decisions.append(Decision(
                    name=d.get("name", "decision"), value=str(d.get("value", "")),
                    autonomous=bool(d.get("autonomous", True)),
                    risk_score=float(d.get("riskScore", 0.0) or 0.0),
                ))

        usage = out_args.get("usage") or {}
        agent_name = (job.get("Release") or {}).get("ProcessKey") or self.agent_name or "uipath-agent"

        return RunRecord(
            run_id=str(job.get("Key") or job.get("Id") or "unknown"),
            agent_name=agent_name,
            source=self.source_name,
            started_at=job.get("StartTime") or "",
            finished_at=job.get("EndTime") or "",
            task=str(out_args.get("task") or job.get("Source") or ""),
            output=str(out_args.get("output") or out_args.get("result") or ""),
            outcome=outcome,
            tool_calls=tool_calls,
            decisions=decisions,
            tokens_prompt=int(usage.get("promptTokens") or 0),
            tokens_completion=int(usage.get("completionTokens") or 0),
            cost_usd=float(usage.get("costUsd") or 0.0),
            steps_taken=int(out_args.get("stepsTaken") or len(tool_calls)),
            raw={"job_state": job.get("State")},
        )
