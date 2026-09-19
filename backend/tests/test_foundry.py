"""Tests for the Azure AI Foundry connector (offline mode).

The adapter is fed the assistant JSON the Foundry API returns; the source is fed
run JSON. No Azure calls are made. Live paths (azure-identity) are only exercised
for their fail-closed error handling.
"""
from __future__ import annotations

import pytest

from agent_audit.exceptions import SourceError
from agent_audit.sources.foundry_adapter import (
    FoundryAdapter, _provider_for, _looks_destructive,
)
from agent_audit.monitor.sources.foundry_source import FoundrySource


# ── adapter ──────────────────────────────────────────────────────────────────
ASSISTANT = {
    "name": "OrderAgent",
    "model": "gpt-4o-mini",
    "instructions": "You help customers with orders. Escalate refunds to a human.",
    "tools": [
        {"type": "code_interpreter"},
        {"type": "file_search"},
        {"type": "function", "function": {"name": "get_order_status"}},
        {"type": "function", "function": {"name": "issue_refund"}},
    ],
}


def test_provider_inference():
    assert _provider_for("gpt-4o-mini") == "openai"
    assert _provider_for("claude-3-5-sonnet") == "anthropic"
    assert _provider_for("llama-3-70b") == "meta"
    assert _provider_for("some-custom-deploy") == "azure"


def test_destructive_detection():
    assert _looks_destructive("issue_refund") is True
    assert _looks_destructive("delete_account") is True
    assert _looks_destructive("get_order_status") is False


def test_extract_offline_assistant():
    m = FoundryAdapter().extract({"config": ASSISTANT}, agent_name="fallback")
    assert m.agent_name == "OrderAgent"
    names = {t.name for t in m.capabilities.tools}
    # function tools + built-in tools both captured
    assert {"get_order_status", "issue_refund", "code_interpreter", "file_search"} <= names
    # destructive function flagged; code_interpreter flagged; file_search not
    refund = next(t for t in m.capabilities.tools if t.name == "issue_refund")
    assert refund.destructive is True
    ci = next(t for t in m.capabilities.tools if t.name == "code_interpreter")
    assert ci.destructive is True
    fs = next(t for t in m.capabilities.tools if t.name == "file_search")
    assert fs.destructive is False
    # model + provider + instruction
    assert m.models[0].provider == "openai"
    assert m.prompts[0].role == "system"
    assert "orders" in m.prompts[0].content.lower()


def test_extract_malformed_does_not_crash():
    for bad in [{"config": {}}, {"config": {"tools": "nope", "model": 123}},
                {"config": {"tools": [None, 5, {"type": "function"}]}}]:
        m = FoundryAdapter().extract(bad, agent_name="x")
        assert m.agent_name  # always usable

def test_live_mode_requires_endpoint_and_id():
    with pytest.raises(SourceError):
        FoundryAdapter().extract({"assistant_id": "asst_1"}, agent_name="x")  # endpoint missing


def test_registered_in_loader():
    from agent_audit.sources.loader import _BUILTIN_ADAPTERS
    assert _BUILTIN_ADAPTERS.get("foundry") is FoundryAdapter


# ── monitor source ───────────────────────────────────────────────────────────
def _src():
    return FoundrySource({"project_endpoint": "https://r.services.ai.azure.com/api/projects/P"})


def test_source_requires_endpoint():
    with pytest.raises(ValueError):
        FoundrySource({})


def test_normalize_completed_run():
    run = {"id": "run_1", "assistant_id": "asst_1", "status": "completed",
           "created_at": "2026-06-01T00:00:00Z", "completed_at": "2026-06-01T00:00:03Z",
           "usage": {"prompt_tokens": 900, "completion_tokens": 300},
           "step_count": 2}
    msgs = [{"role": "assistant", "content": [
        {"type": "text", "text": {"value": "Your order ships tomorrow."}}]}]
    rec = _src()._normalize_run(run, msgs)
    assert rec.run_id == "run_1"
    assert rec.source == "foundry"
    assert rec.outcome == "success"
    assert rec.tokens_prompt == 900
    assert rec.output == "Your order ships tomorrow."


def test_normalize_failed_run():
    rec = _src()._normalize_run({"id": "r", "status": "failed"}, [])
    assert rec.outcome == "faulted"


def test_normalize_tool_calls_from_required_action():
    run = {"id": "r", "status": "requires_action", "required_action": {
        "submit_tool_outputs": {"tool_calls": [
            {"type": "function", "function": {"name": "issue_refund",
                                              "arguments": '{"amount": 240}'}},
            {"type": "function", "function": {"name": "get_order_status",
                                              "arguments": {"id": "SO-1"}}},
        ]}}}
    rec = _src()._normalize_run(run, [])
    names = [t.name for t in rec.tool_calls]
    assert names == ["issue_refund", "get_order_status"]
    assert rec.tool_calls[0].destructive is True
    assert rec.tool_calls[0].args == {"amount": 240}   # JSON-string args parsed


def test_normalize_malformed_run_does_not_crash():
    for bad in [{"id": "r"}, {"id": "r", "usage": None, "required_action": "x"},
                {"id": "r", "required_action": {"submit_tool_outputs": {"tool_calls": [None, 3]}}}]:
        rec = _src()._normalize_run(bad, [])
        assert rec.run_id == "r"
