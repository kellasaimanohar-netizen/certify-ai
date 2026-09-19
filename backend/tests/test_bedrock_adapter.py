"""Tests for the AWS Bedrock source adapter (offline config mode).

We feed the adapter the shape boto3 would return, so no AWS calls are made.
The live path (boto3) is exercised only for its error handling when config is
absent and creds/lib are missing.
"""
from __future__ import annotations

import pytest

from agent_audit.exceptions import SourceError
from agent_audit.sources.bedrock_adapter import BedrockAdapter, _provider_for, _looks_destructive

CONFIG = {
    "agent": {
        "agentName": "OrderBot",
        "foundationModel": "anthropic.claude-3-5-sonnet-20241022-v2:0",
        "instruction": "You help customers with orders. Escalate refunds.",
    },
    "action_groups": [
        {
            "actionGroupName": "OrderActions",
            "functionSchema": {"functions": [
                {"name": "get_order_status"},
                {"name": "issue_refund"},
                {"name": "cancel_order"},
            ]},
        },
        {
            "actionGroupName": "KbActions",
            "apiSchema": {"payload": {"paths": {
                "/search": {"get": {}},
            }}},
        },
    ],
}


def test_provider_inference():
    assert _provider_for("anthropic.claude-3-5-sonnet") == "anthropic"
    assert _provider_for("amazon.titan-text") == "amazon"
    assert _provider_for("meta.llama3-70b") == "meta"
    assert _provider_for("something-unknown") == "aws"


def test_destructive_detection():
    assert _looks_destructive("issue_refund") is True
    assert _looks_destructive("cancel_order") is True
    assert _looks_destructive("get_order_status") is False


def test_extract_offline_config():
    m = BedrockAdapter().extract({"config": CONFIG}, agent_name="fallback")
    # agent name comes from the config, not the fallback
    assert m.agent_name == "OrderBot"
    # tools from both function schema and openapi schema
    names = {t.name for t in m.capabilities.tools}
    assert {"get_order_status", "issue_refund", "cancel_order"} <= names
    assert any(n.startswith("GET /search") for n in names)
    # destructive flags propagate
    refund = next(t for t in m.capabilities.tools if t.name == "issue_refund")
    assert refund.destructive is True
    # model + provider
    assert m.models[0].provider == "anthropic"
    assert "claude" in m.models[0].model_id
    # instruction becomes a system prompt
    assert m.prompts[0].role == "system"
    assert "orders" in m.prompts[0].content.lower()


def test_live_mode_requires_agent_id_and_region():
    with pytest.raises(SourceError):
        BedrockAdapter().extract({}, agent_name="x")


def test_registered_in_loader():
    from agent_audit.sources.loader import _BUILTIN_ADAPTERS
    assert _BUILTIN_ADAPTERS.get("bedrock") is BedrockAdapter
