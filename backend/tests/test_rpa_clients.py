"""Tests for UiPath + Automation Anywhere clients and telemetry sources.

Validates: probe-client job/invoke lifecycle against a fake Control Room /
Orchestrator, config validation, and telemetry-source normalization of native
job/audit records into RunRecord.
"""
from __future__ import annotations

import httpx
import pytest

from agent_audit.live.budget import CallBudget
from agent_audit.monitor.run_record import RunRecord


# ── UiPath probe client ──────────────────────────────────────────────────────
class _UiProvider:
    name = "uipath"
    config = {
        "base_url": "https://cloud.uipath.com/acct/tenant",
        "release_key": "rk-123", "folder_id": "99",
        "client_id_env": "UI_CID", "client_secret_env": "UI_CSEC",
    }


class _UiRuntime:
    provider = _UiProvider()


class _UiManifest:
    runtime = _UiRuntime()


class TestUiPathClient:
    async def test_job_lifecycle(self, monkeypatch):
        monkeypatch.setenv("UI_CID", "id")
        monkeypatch.setenv("UI_CSEC", "secret")
        from agent_audit.live.uipath_client import UiPathAgentClient

        state = {"polls": 0}

        def handler(req: httpx.Request) -> httpx.Response:
            u = str(req.url)
            if u.endswith("/connect/token"):
                return httpx.Response(200, json={"access_token": "T"})
            if "StartJobs" in u:
                return httpx.Response(201, json={"value": [{"Id": 7, "State": "Pending"}]})
            if "/Jobs(7)" in u:
                state["polls"] += 1
                # First poll running, second terminal.
                if state["polls"] < 2:
                    return httpx.Response(200, json={"State": "Running"})
                return httpx.Response(200, json={
                    "State": "Successful",
                    "OutputArguments": '{"output": "uipath agent answer"}',
                })
            return httpx.Response(404)

        client = UiPathAgentClient(_UiManifest(), budget=CallBudget())
        client._client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        try:
            resp, _ = await client.invoke({"input": "hi", "_test_name": "p"}, timeout_s=10)
        finally:
            await client.aclose()
        assert resp["output"] == "uipath agent answer"
        assert state["polls"] >= 2

    def test_missing_config_raises(self, monkeypatch):
        from agent_audit.exceptions import ConfigError
        from agent_audit.live.uipath_client import UiPathAgentClient

        class _Bad:
            class runtime:  # noqa: N801
                class provider:  # noqa: N801
                    name = "uipath"
                    config = {"base_url": "https://x"}  # missing keys
        with pytest.raises(ConfigError):
            UiPathAgentClient(_Bad())


# ── Automation Anywhere probe client ─────────────────────────────────────────
class _AAProvider:
    name = "automation_anywhere"
    config = {
        "control_room": "https://cr.aa.digital",
        "agent_id": "ag-1", "api_key_env": "AA_KEY",
    }


class _AARuntime:
    provider = _AAProvider()


class _AAManifest:
    runtime = _AARuntime()


class TestAAClient:
    async def test_invoke(self, monkeypatch):
        monkeypatch.setenv("AA_KEY", "key")
        from agent_audit.live.aa_client import AAAgentClient

        def handler(req: httpx.Request) -> httpx.Response:
            u = str(req.url)
            if u.endswith("/v1/authentication"):
                return httpx.Response(200, json={"token": "TKN"})
            if "/invoke" in u:
                return httpx.Response(200, json={"output": "aa agent answer"})
            return httpx.Response(404)

        client = AAAgentClient(_AAManifest(), budget=CallBudget())
        client._client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        try:
            resp, _ = await client.invoke({"input": "hi", "_test_name": "p"})
        finally:
            await client.aclose()
        assert resp["output"] == "aa agent answer"


# ── Telemetry source normalization ───────────────────────────────────────────
class TestUiPathSource:
    def test_normalize_job(self, monkeypatch):
        from agent_audit.monitor.sources.uipath_source import UiPathOrchestratorSource

        monkeypatch.setenv("UI_CID", "id")
        monkeypatch.setenv("UI_CSEC", "secret")
        src = UiPathOrchestratorSource({
            "base_url": "https://cloud.uipath.com/a/t",
            "client_id_env": "UI_CID", "client_secret_env": "UI_CSEC",
        })
        job = {
            "Key": "job-1", "State": "Faulted",
            "StartTime": "2026-06-26T10:00:00Z", "EndTime": "2026-06-26T10:01:00Z",
            "Release": {"ProcessKey": "invoice-agent"},
            "OutputArguments": (
                '{"output": "done", "stepsTaken": 12, '
                '"usage": {"promptTokens": 900, "completionTokens": 300, "costUsd": 0.05}, '
                '"toolCalls": [{"name": "Post_GL", "destructive": true, "hitlApproved": false}]}'
            ),
        }
        rec: RunRecord = src._normalize_job(job)
        assert rec.run_id == "job-1"
        assert rec.outcome == "faulted"
        assert rec.agent_name == "invoice-agent"
        assert rec.tokens_total == 1200
        assert rec.cost_usd == 0.05
        assert rec.steps_taken == 12
        assert rec.unapproved_destructive[0].name == "Post_GL"


class TestAASource:
    def test_normalize_audit(self):
        from agent_audit.monitor.sources.aa_source import AAControlRoomSource

        import os
        os.environ["AA_KEY_T"] = "k"
        src = AAControlRoomSource({
            "control_room": "https://cr.aa.digital", "api_key_env": "AA_KEY_T",
        })
        row = {
            "id": "msg-9", "objectName": "refund-agent",
            "status": "RUN_FAILED",
            "createdOn": "2026-06-26T10:00:00Z", "completedOn": "2026-06-26T10:00:30Z",
            "details": {
                "prompt": "refund please", "response": "done",
                "usage": {"promptTokens": 500, "completionTokens": 100},
                "stepsTaken": 5,
            },
        }
        rec = src._normalize_audit(row)
        assert rec.run_id == "msg-9"
        assert rec.agent_name == "refund-agent"
        assert rec.outcome == "faulted"
        assert rec.tokens_total == 600
        assert rec.task == "refund please"
