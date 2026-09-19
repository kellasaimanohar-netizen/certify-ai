"""UiPathAgentClient — drive a UiPath agent for pre-deployment certification.

UiPath agents run as Orchestrator *jobs*, so a single probe is:
  OAuth (Identity Server) → StartJobs → poll Job until terminal → read output.

Exposes the same ``invoke(payload, timeout_s) -> (canonical_dict, latency_ms)``
interface as every other live client, so the 17 certification phases run against
a UiPath agent unchanged. The job's output arguments are normalized to the
canonical response shape (output / finish_reason / tool_calls / cost_usd).

Config (manifest.runtime.provider.config)::

    base_url           https://cloud.uipath.com/{account}/{tenant}
    identity_url       token endpoint (default cloud.uipath.com/identity_/connect/token)
    client_id_env / client_secret_env
    release_key        the agent process release key to start
    folder_id          Orchestrator folder (OrganizationUnitId)
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from typing import Any

from agent_audit.exceptions import AgentAuditError, ConfigError
from agent_audit.live.adapters import detect_and_normalize
from agent_audit.live.budget import CallBudget

log = logging.getLogger(__name__)

_TERMINAL = {"Successful", "Faulted", "Stopped"}


class UiPathAgentError(AgentAuditError):
    """A UiPath agent job probe failed."""


class UiPathAgentClient:
    def __init__(self, manifest: Any, *, budget: CallBudget | None = None,
                 concurrency: int = 4) -> None:
        self.manifest = manifest
        self.budget = budget or CallBudget()
        self._concurrency = max(1, concurrency)
        self._sem = asyncio.Semaphore(self._concurrency)
        self._client: Any = None

        cfg = dict(getattr(manifest.runtime.provider, "config", {}) or {})
        self.base_url = (cfg.get("base_url") or "").rstrip("/")
        self.identity_url = (cfg.get("identity_url")
                             or "https://cloud.uipath.com/identity_/connect/token")
        self.release_key = cfg.get("release_key")
        self.folder_id = cfg.get("folder_id")
        cid, csec = cfg.get("client_id_env"), cfg.get("client_secret_env")
        missing = [n for n, v in {
            "base_url": self.base_url, "release_key": self.release_key,
            "folder_id": self.folder_id, "client_id_env": cid, "client_secret_env": csec,
        }.items() if not v]
        if missing:
            raise ConfigError(f"uipath provider config missing: {', '.join(missing)}")
        self._client_id = os.environ.get(cid)        # type: ignore[arg-type]
        self._client_secret = os.environ.get(csec)   # type: ignore[arg-type]
        if not (self._client_id and self._client_secret):
            raise ConfigError(f"UiPath OAuth env vars {cid}/{csec} are not set")
        self._token: str | None = None

    async def _ensure_client(self) -> Any:
        if self._client is None:
            import httpx
            self._client = httpx.AsyncClient()
        return self._client

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def _get_token(self) -> str:
        if self._token:
            return self._token
        client = await self._ensure_client()
        resp = await client.post(self.identity_url, data={
            "grant_type": "client_credentials",
            "client_id": self._client_id, "client_secret": self._client_secret,
            "scope": "OR.Jobs",
        }, timeout=30.0)
        if resp.status_code != 200:
            raise UiPathAgentError(f"token mint failed ({resp.status_code}): {resp.text[:200]}")
        self._token = resp.json()["access_token"]
        return self._token

    def _headers(self, token: str) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "X-UIPATH-OrganizationUnitId": str(self.folder_id),
        }

    async def invoke(self, payload: dict[str, Any],
                     timeout_s: float = 120.0) -> tuple[dict[str, Any], float]:
        test_name = str(payload.get("_test_name") or payload.get("_mock_scenario") or "uipath")
        text = str(payload.get("input") or payload.get("message") or "")
        await self.budget.reserve(test_name)
        settled = False
        start = time.perf_counter()
        try:
            token = await self._get_token()
            client = await self._ensure_client()
            async with self._sem:
                # Start the job with the probe text as an input argument.
                start_url = f"{self.base_url}/orchestrator_/odata/Jobs/UiPath.Server.Configuration.OData.StartJobs"
                body = {
                    "startInfo": {
                        "ReleaseKey": self.release_key,
                        "Strategy": "ModernJobsCount",
                        "JobsCount": 1,
                        "InputArguments": __import__("json").dumps({"input": text}),
                    }
                }
                resp = await client.post(start_url, json=body, headers=self._headers(token),
                                         timeout=timeout_s)
                if resp.status_code not in (200, 201):
                    raise UiPathAgentError(f"StartJobs failed ({resp.status_code}): {resp.text[:200]}")
                job = (resp.json().get("value") or [{}])[0]
                job_id = job.get("Id")
                if job_id is None:
                    raise UiPathAgentError("StartJobs returned no job id")

                # Poll until terminal or timeout.
                body_out = await self._poll_job(client, token, job_id, timeout_s)

            canonical = detect_and_normalize(body_out)
            await self.budget.settle(canonical.get("cost_usd", 0.0))
            settled = True
            return canonical, (time.perf_counter() - start) * 1000
        finally:
            if not settled:
                await self.budget.release(test_name)

    async def _poll_job(self, client: Any, token: str, job_id: Any,
                        timeout_s: float) -> dict[str, Any]:
        deadline = time.monotonic() + timeout_s
        url = f"{self.base_url}/orchestrator_/odata/Jobs({job_id})"
        while time.monotonic() < deadline:
            resp = await client.get(url, headers=self._headers(token), timeout=30.0)
            resp.raise_for_status()
            job = resp.json()
            state = job.get("State")
            if state in _TERMINAL:
                out_args = job.get("OutputArguments") or "{}"
                if isinstance(out_args, str):
                    try:
                        out_args = __import__("json").loads(out_args)
                    except (ValueError, TypeError):
                        out_args = {}
                out_args.setdefault("finish_reason",
                                    "complete" if state == "Successful" else "error")
                return out_args
            await asyncio.sleep(2.0)
        raise UiPathAgentError(f"job {job_id} did not finish within {timeout_s}s")
