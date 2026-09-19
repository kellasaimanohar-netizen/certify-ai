"""AAAgentClient — drive an Automation Anywhere AI agent for certification.

A probe authenticates to the Control Room, invokes the AI agent (synchronously
where supported), and normalizes the response to the canonical shape. Same
``invoke()`` interface as every other live client, so the certification phases
run unchanged.

Config (manifest.runtime.provider.config)::

    control_room   https://your-cr.automationanywhere.digital
    username       API user (optional if api_key is a full token)
    api_key_env    env var holding the API key
    agent_id       the AI agent / process id to invoke
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


class AAAgentError(AgentAuditError):
    """An Automation Anywhere agent probe failed."""


class AAAgentClient:
    def __init__(self, manifest: Any, *, budget: CallBudget | None = None,
                 concurrency: int = 4) -> None:
        self.manifest = manifest
        self.budget = budget or CallBudget()
        self._concurrency = max(1, concurrency)
        self._sem = asyncio.Semaphore(self._concurrency)
        self._client: Any = None

        cfg = dict(getattr(manifest.runtime.provider, "config", {}) or {})
        self.control_room = (cfg.get("control_room") or "").rstrip("/")
        self.username = cfg.get("username")
        self.agent_id = cfg.get("agent_id")
        key_env = cfg.get("api_key_env")
        missing = [n for n, v in {
            "control_room": self.control_room, "agent_id": self.agent_id,
            "api_key_env": key_env,
        }.items() if not v]
        if missing:
            raise ConfigError(f"automation_anywhere provider config missing: {', '.join(missing)}")
        self._api_key = os.environ.get(key_env)   # type: ignore[arg-type]
        if not self._api_key:
            raise ConfigError(f"AA API key env var {key_env} is not set")
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
        body: dict[str, Any] = {"apiKey": self._api_key}
        if self.username:
            body["username"] = self.username
        resp = await client.post(f"{self.control_room}/v1/authentication",
                                 json=body, timeout=30.0)
        if resp.status_code != 200:
            raise AAAgentError(f"auth failed ({resp.status_code}): {resp.text[:200]}")
        self._token = resp.json()["token"]
        return self._token

    async def invoke(self, payload: dict[str, Any],
                     timeout_s: float = 60.0) -> tuple[dict[str, Any], float]:
        test_name = str(payload.get("_test_name") or payload.get("_mock_scenario") or "aa")
        text = str(payload.get("input") or payload.get("message") or "")
        await self.budget.reserve(test_name)
        settled = False
        start = time.perf_counter()
        try:
            token = await self._get_token()
            client = await self._ensure_client()
            async with self._sem:
                url = f"{self.control_room}/v1/aiagentstudio/agents/{self.agent_id}/invoke"
                resp = await client.post(
                    url, json={"input": text},
                    headers={"X-Authorization": token, "Content-Type": "application/json"},
                    timeout=timeout_s,
                )
                if resp.status_code not in (200, 201, 202):
                    raise AAAgentError(f"invoke failed ({resp.status_code}): {resp.text[:200]}")
                ctype = resp.headers.get("content-type", "")
                body = resp.json() if "json" in ctype else {"output": resp.text}

            canonical = detect_and_normalize(body)
            await self.budget.settle(canonical.get("cost_usd", 0.0))
            settled = True
            return canonical, (time.perf_counter() - start) * 1000
        finally:
            if not settled:
                await self.budget.release(test_name)
