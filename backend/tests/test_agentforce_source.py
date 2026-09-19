"""Tests for AgentforceSessionSource — the runtime-monitor telemetry source.

These exercise the normalization logic (Salesforce session record -> RunRecord)
without a live org. Network calls are not made; we call ``_normalize_session``
directly with representative payloads, mirroring how the certifier's adapter is
unit-tested.
"""
from __future__ import annotations

import os

import pytest

os.environ.setdefault("SF_KEY", "k")
os.environ.setdefault("SF_SECRET", "s")

from agent_audit.monitor.sources import AgentforceSessionSource

CFG = {
    "my_domain_url": "https://acme.my.salesforce.com",
    "agent_id": "0XxSB000000IPCr0AO",
    "consumer_key_env": "SF_KEY",
    "consumer_secret_env": "SF_SECRET",
}


def _src():
    return AgentforceSessionSource(dict(CFG))


def test_requires_config():
    with pytest.raises(ValueError):
        AgentforceSessionSource({"my_domain_url": "x"})


def test_missing_secret_raises():
    cfg = dict(CFG, consumer_key_env="NOPE_KEY", consumer_secret_env="NOPE_SECRET")
    with pytest.raises(ValueError):
        AgentforceSessionSource(cfg)


def test_completed_session_becomes_success():
    rec = _src()._normalize_session({
        "Id": "SES1", "AgentId": "A1", "Status": "Completed",
        "StartTime": "2026-06-26T10:00:00Z", "EndTime": "2026-06-26T10:00:03Z",
        "RequestText": "where is my order", "ResponseText": "it ships tomorrow",
        "ActivityJson": {},
    })
    assert rec.outcome == "success"
    assert rec.run_id == "SES1"
    assert rec.source == "agentforce"
    assert rec.output == "it ships tomorrow"


def test_failed_session_maps_to_faulted():
    rec = _src()._normalize_session({"Id": "S", "Status": "Failed", "ActivityJson": {}})
    assert rec.outcome == "faulted"


def test_escalation_maps():
    rec = _src()._normalize_session({"Id": "S", "Status": "TransferredToAgent", "ActivityJson": {}})
    assert rec.outcome == "escalated"


def test_action_invocations_become_tool_calls():
    rec = _src()._normalize_session({
        "Id": "S", "Status": "Completed",
        "ActivityJson": {
            "actions": [
                {"actionName": "Issue_Refund", "inputValues": {"amount": 240},
                 "destructive": True, "approved": False},
                {"name": "Get_Order_Status", "input": {"id": "SO-1"}},
            ]
        },
    })
    names = [t.name for t in rec.tool_calls]
    assert names == ["Issue_Refund", "Get_Order_Status"]
    refund = rec.tool_calls[0]
    assert refund.destructive is True
    assert refund.hitl_approved is False


def test_activity_json_as_string_is_parsed():
    rec = _src()._normalize_session({
        "Id": "S", "Status": "Completed",
        "ActivityJson": '{"toolCalls": [{"name": "Search_Knowledge"}], "stepsTaken": 7}',
    })
    assert rec.tool_calls[0].name == "Search_Knowledge"
    assert rec.steps_taken == 7


def test_usage_and_decisions_map():
    rec = _src()._normalize_session({
        "Id": "S", "Status": "Completed",
        "ActivityJson": {
            "usage": {"promptTokens": 900, "completionTokens": 300, "costUsd": 0.04},
            "decisions": [{"name": "approve_payout", "value": "yes",
                           "autonomous": True, "riskScore": 0.8}],
        },
    })
    assert rec.tokens_prompt == 900
    assert rec.tokens_completion == 300
    assert rec.cost_usd == pytest.approx(0.04)
    assert rec.decisions[0].risk_score == pytest.approx(0.8)


def test_steps_default_to_toolcall_count():
    rec = _src()._normalize_session({
        "Id": "S", "Status": "Completed",
        "ActivityJson": {"toolCalls": [{"name": "a"}, {"name": "b"}, {"name": "c"}]},
    })
    assert rec.steps_taken == 3


def test_malformed_activity_json_degrades_gracefully():
    rec = _src()._normalize_session({
        "Id": "S", "Status": "Completed", "ActivityJson": "{not valid json",
    })
    assert rec.tool_calls == []
    assert rec.tokens_prompt == 0
    assert rec.outcome == "success"
