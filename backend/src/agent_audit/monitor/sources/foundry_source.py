"""Azure AI Foundry telemetry source.

Foundry Agent Service keeps persistent threads; invoking an agent on a thread is
a "run", and the run + its messages record what the agent did. This source lists
recent runs for an agent and normalizes each into a ``RunRecord`` so the same
monitor checks that run on Agentforce/UiPath/AA also run on Foundry agents.

Flow (GA api-version 2025-05-01):
  * list threads         GET  {endpoint}/threads
  * list runs per thread GET  {endpoint}/threads/{tid}/runs
  * list messages        GET  {endpoint}/threads/{tid}/messages   (for output)
A run exposes status, usage (prompt/completion tokens), the model, and — when
tools were invoked — required-action / step data.

Auth: Microsoft Entra via ``azure-identity`` DefaultAzureCredential (env / CLI /
managed-identity chain). No secret is inlined.

Config (constructor dict)::

    project_endpoint   https://<res>.services.ai.azure.com/api/projects/<proj>
    assistant_id       optional — filter runs to one agent
    api_version        optional — defaults to 2025-05-01

Like the other sources, token/cost fields are read when present and left at 0
otherwise; the monitor's absolute ceilings still apply and the outlier check
degrades gracefully.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from agent_audit.monitor.run_record import RunRecord, ToolCall
from agent_audit.monitor.sources.base import TelemetrySource

log = logging.getLogger(__name__)

_DEFAULT_API_VERSION = "2025-05-01"

# Foundry run status → canonical outcome.
_STATUS_TO_OUTCOME = {
    "completed": "success",
    "requires_action": "success",   # non-terminal; tool call pending
    "in_progress": "success",
    "queued": "success",
    "failed": "faulted",
    "cancelled": "cancelled",
    "cancelling": "cancelled",
    "expired": "cancelled",
}

_DESTRUCTIVE_HINTS = ("delete", "remove", "cancel", "refund", "transfer", "pay",
                      "issue", "wipe", "erase", "purge", "destroy", "revoke",
                      "terminate", "charge", "withdraw")


class FoundrySource(TelemetrySource):
    source_name = "foundry"

    def __init__(self, config: dict[str, Any]) -> None:
        self._endpoint = (config.get("project_endpoint") or "").rstrip("/")
        self._assistant_id = config.get("assistant_id")
        self._api_version = config.get("api_version") or _DEFAULT_API_VERSION
        if not self._endpoint:
            raise ValueError("foundry source needs project_endpoint")
        self._token: str | None = None

    def _get_token(self) -> str:
        if self._token:
            return self._token
        try:
            from azure.identity import DefaultAzureCredential
        except ImportError as exc:  # pragma: no cover
            raise ValueError(
                "foundry source needs azure-identity (`pip install azure-identity`)"
            ) from exc
        self._token = DefaultAzureCredential().get_token(
            "https://ai.azure.com/.default").token
        return self._token

    def _get(self, path: str) -> dict:
        from agent_audit.netguard import safe_urlopen
        import urllib.request
        url = f"{self._endpoint}/{path}"
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}api-version={self._api_version}"
        req = urllib.request.Request(url, headers={
            "Authorization": f"Bearer {self._get_token()}",
            "Content-Type": "application/json",
        })
        # safe_urlopen validates the URL and re-validates any redirect target.
        with safe_urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())

    def fetch_runs(self, *, since: str | None = None, limit: int = 100) -> list[RunRecord]:
        threads = self._get("threads").get("data", [])
        records: list[RunRecord] = []
        for thread in threads:
            tid = thread.get("id")
            if not tid:
                continue
            runs = self._get(f"threads/{tid}/runs").get("data", [])
            # cache the thread's messages once for output text
            try:
                messages = self._get(f"threads/{tid}/messages").get("data", [])
            except Exception:  # noqa: BLE001
                messages = []
            for run in runs:
                if self._assistant_id and run.get("assistant_id") != self._assistant_id:
                    continue
                records.append(self._normalize_run(run, messages))
                if len(records) >= limit:
                    return records
        return records

    def _normalize_run(self, run: dict, messages: list[dict]) -> RunRecord:
        status = str(run.get("status", "")).lower()
        outcome = _STATUS_TO_OUTCOME.get(status, "success")

        # tool calls live under required_action.submit_tool_outputs.tool_calls
        tool_calls: list[ToolCall] = []
        ra = run.get("required_action")
        ra = ra if isinstance(ra, dict) else {}
        sto = ra.get("submit_tool_outputs")
        sto = sto if isinstance(sto, dict) else {}
        for tc in (sto.get("tool_calls") or []):
            if isinstance(tc, dict):
                fn = tc.get("function") or {}
                name = fn.get("name") or tc.get("type") or "tool"
                args = fn.get("arguments") or {}
                if isinstance(args, str):
                    try:
                        args = json.loads(args)
                    except (ValueError, TypeError):
                        args = {"raw": args}
                tool_calls.append(ToolCall(
                    name=name, args=args if isinstance(args, dict) else {},
                    destructive=any(h in name.lower() for h in _DESTRUCTIVE_HINTS),
                ))

        usage = run.get("usage")
        usage = usage if isinstance(usage, dict) else {}

        # newest assistant message text as the run output
        output = ""
        for m in messages:
            if m.get("role") == "assistant":
                for block in (m.get("content") or []):
                    if isinstance(block, dict) and block.get("type") == "text":
                        output = (block.get("text") or {}).get("value", "")
                        break
                if output:
                    break

        return RunRecord(
            run_id=str(run.get("id") or "unknown"),
            agent_name=str(run.get("assistant_id") or self._assistant_id or "foundry-agent"),
            source=self.source_name,
            started_at=str(run.get("created_at") or ""),
            finished_at=str(run.get("completed_at") or run.get("failed_at") or ""),
            output=output,
            outcome=outcome,
            tool_calls=tool_calls,
            tokens_prompt=int(usage.get("prompt_tokens") or 0),
            tokens_completion=int(usage.get("completion_tokens") or 0),
            steps_taken=int(run.get("step_count") or len(tool_calls)),
            raw={"status": run.get("status"), "model": run.get("model")},
        )
