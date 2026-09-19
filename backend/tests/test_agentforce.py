"""Tests for the Salesforce Agentforce integration.

Covers:
  * AgentforceAdapter — normalizes the Agent API ``messages[]`` envelope
    (inform text + action invocations) into the canonical phase shape.
  * AgentforceClient — full OAuth → start session → message → end session flow
    against a fake Salesforce, secret-from-env, SSRF guard, budget accounting,
    and per-probe session isolation.
"""
from __future__ import annotations

import httpx
import pytest

from agent_audit.live.adapters import (
    detect_and_normalize,
    restore_adapters,
    snapshot_adapters,
)
from agent_audit.live.agentforce_client import AgentforceClient, AgentforceError
from agent_audit.live.budget import CallBudget


# ── Adapter ─────────────────────────────────────────────────────────────────
class TestAgentforceAdapter:
    def test_inform_message_becomes_output(self):
        body = {
            "messages": [
                {"type": "Inform", "message": "Your order ships Tuesday.",
                 "result": []}
            ],
            "_links": {"session": "sess-123"},
        }
        c = detect_and_normalize(body)
        assert c["output"] == "Your order ships Tuesday."
        assert c["finish_reason"] == "complete"
        assert c["trace_id"] == "sess-123"

    def test_chatbot_path_content_text_shape(self):
        # Older chatbot path nests text under content.text rather than message.
        body = {"messages": [{"type": "inform", "content": {"text": "Hi there"}}]}
        c = detect_and_normalize(body)
        assert c["output"] == "Hi there"

    def test_action_invocations_become_tool_calls(self):
        body = {
            "messages": [
                {"type": "Inform", "message": "Refund issued.",
                 "result": [
                     {"actionName": "Issue_Refund",
                      "inputValues": {"amount": 49.99},
                      "output": {"status": "ok"}}
                 ]}
            ]
        }
        c = detect_and_normalize(body)
        assert c["tool_calls"][0]["tool"] == "Issue_Refund"
        assert c["tool_calls"][0]["args"] == {"amount": 49.99}
        assert c["steps_taken"] == 1

    def test_error_message_sets_error_finish(self):
        body = {"messages": [{"type": "Error", "message": "boom"}]}
        c = detect_and_normalize(body)
        assert c["finish_reason"] == "error"

    def test_does_not_steal_openai_or_anthropic_bodies(self):
        # The agentforce matcher must not hijack other providers' envelopes.
        openai_body = {
            "choices": [{"message": {"content": "x"}, "finish_reason": "stop"}]
        }
        c = detect_and_normalize(openai_body)
        assert c["output"] == "x"  # handled by OpenAIChatAdapter, not agentforce


# ── Client (full lifecycle against fake Salesforce) ─────────────────────────
class _AFRuntimeProvider:
    name = "agentforce"
    config = {
        "agent_id": "0XxTEST",
        "my_domain_url": "https://acme.my.salesforce.com",
        "consumer_key_env": "SF_CK_TEST",
        "consumer_secret_env": "SF_CS_TEST",
        "api_host": "https://api.salesforce.com",
        "bypass_user": True,
    }


class _AFRuntime:
    provider = _AFRuntimeProvider()


class _AFManifest:
    def __init__(self):
        self.runtime = _AFRuntime()


def _fake_salesforce_handler(record):
    """Return an httpx MockTransport handler emulating the Agent API."""
    def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        record.setdefault("calls", []).append(request.method + " " + url)
        if url.endswith("/services/oauth2/token"):
            return httpx.Response(200, json={"access_token": "TOKEN", "expires_in": 1800})
        if url.endswith("/sessions") and request.method == "POST":
            return httpx.Response(200, json={"sessionId": "SID-1"})
        if url.endswith("/messages") and request.method == "POST":
            import json as _json
            record["last_message"] = _json.loads(request.content)
            return httpx.Response(200, json={
                "messages": [{"type": "Inform", "message": "live agentforce answer"}]
            })
        if "/sessions/SID-1" in url and request.method == "DELETE":
            record["ended"] = True
            return httpx.Response(204)
        return httpx.Response(404, json={"error": "unexpected"})
    return handler


def _make_af_client(monkeypatch, record, budget=None):
    monkeypatch.setenv("SF_CK_TEST", "consumer-key")
    monkeypatch.setenv("SF_CS_TEST", "consumer-secret")
    monkeypatch.setenv("AGENT_AUDIT_ALLOW_PRIVATE_FETCH", "1")  # skip SSRF DNS in tests
    client = AgentforceClient(_AFManifest(), budget=budget or CallBudget())
    client._client = httpx.AsyncClient(transport=httpx.MockTransport(_fake_salesforce_handler(record)))
    return client


class TestAgentforceClient:
    async def test_full_turn_lifecycle(self, monkeypatch):
        record: dict = {}
        client = _make_af_client(monkeypatch, record)
        try:
            resp, latency_ms = await client.invoke(
                {"input": "where is my order?", "_test_name": "probe1"}
            )
        finally:
            await client.aclose()

        assert resp["output"] == "live agentforce answer"
        assert latency_ms >= 0
        # OAuth, session, message, and end-session all happened.
        joined = " ".join(record["calls"])
        assert "/services/oauth2/token" in joined
        assert "/sessions" in joined
        assert "/messages" in joined
        assert record.get("ended") is True
        # sequenceId defaulted to 1, message text passed through.
        assert record["last_message"]["message"]["sequenceId"] == 1
        assert record["last_message"]["message"]["text"] == "where is my order?"

    async def test_token_is_cached_across_calls(self, monkeypatch):
        record: dict = {}
        client = _make_af_client(monkeypatch, record)
        try:
            await client.invoke({"input": "a", "_test_name": "p"})
            await client.invoke({"input": "b", "_test_name": "p"})
        finally:
            await client.aclose()
        token_calls = [c for c in record["calls"] if "oauth2/token" in c]
        assert len(token_calls) == 1  # minted once, reused

    async def test_explicit_session_not_torn_down(self, monkeypatch):
        # Multi-turn phase passes _session_id to keep one session across turns.
        record: dict = {}
        client = _make_af_client(monkeypatch, record)
        try:
            await client.invoke(
                {"input": "turn1", "_test_name": "mt", "_session_id": "SID-EXT",
                 "_sequence_id": 3}
            )
        finally:
            await client.aclose()
        assert record.get("ended") is not True       # we didn't create it, don't end it
        assert record["last_message"]["message"]["sequenceId"] == 3

    async def test_missing_secret_raises_config_error(self, monkeypatch):
        from agent_audit.exceptions import ConfigError
        monkeypatch.delenv("SF_CK_TEST", raising=False)
        monkeypatch.delenv("SF_CS_TEST", raising=False)
        monkeypatch.setenv("AGENT_AUDIT_ALLOW_PRIVATE_FETCH", "1")
        with pytest.raises(ConfigError):
            AgentforceClient(_AFManifest())

    async def test_budget_settles_per_call(self, monkeypatch):
        record: dict = {}
        budget = CallBudget(max_calls=10, max_cost_usd=100.0)
        client = _make_af_client(monkeypatch, record, budget=budget)
        try:
            await client.invoke({"input": "a", "_test_name": "p"})
        finally:
            await client.aclose()
        assert budget.calls_made == 1

    async def test_ssrf_guard_blocks_private_domain(self, monkeypatch):
        monkeypatch.setenv("SF_CK_TEST", "k")
        monkeypatch.setenv("SF_CS_TEST", "s")
        monkeypatch.delenv("AGENT_AUDIT_ALLOW_PRIVATE_FETCH", raising=False)

        class _BadProvider:
            name = "agentforce"
            config = {
                "agent_id": "0Xx", "my_domain_url": "https://127.0.0.1",
                "consumer_key_env": "SF_CK_TEST", "consumer_secret_env": "SF_CS_TEST",
            }

        class _BadRuntime:
            provider = _BadProvider()

        class _BadManifest:
            runtime = _BadRuntime()

        with pytest.raises(AgentforceError):
            AgentforceClient(_BadManifest())
