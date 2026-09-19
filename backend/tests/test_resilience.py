"""Resilience validation — does CertifyAI fail CLOSED under partial failure?

A security control that fails OPEN (allows when it errors) is worse than none.
These tests inject faults and assert the safe outcome. They use the real
Guard.guard_tool(fn, name=..., target_env=...) API.
"""
import time
import pytest
from agent_audit.guard import ProposedCall, Decision
from agent_audit.guard.broker import Guard, BlockedActionError


@pytest.fixture
def engine():
    return Guard().engine


def test_malformed_call_fails_safe_not_allow(engine):
    d = engine.evaluate(ProposedCall(name=None, args={"query": "DROP TABLE users"}, target_env="prod"))
    assert d.decision == Decision.BLOCK


def test_approval_handler_that_raises_does_not_open():
    # If the approval callback throws, the guarded action must NOT execute.
    def exploding_handler(call, decision):
        raise RuntimeError("approval service unavailable")
    g = Guard(approval_handler=exploding_handler)
    ran = {"v": False}
    def issue_refund(**k):
        ran["v"] = True
        return "done"
    guarded = g.guard_tool(issue_refund, name="issue_refund", target_env="production")
    with pytest.raises(Exception):
        guarded(amount=500)
    assert ran["v"] is False, "action executed despite approval failure — FAILED OPEN"


def test_default_approval_is_deny():
    # No approval handler configured -> REQUIRE_APPROVAL defaults to DENY.
    g = Guard()
    ran = {"v": False}
    def issue_refund(**k):
        ran["v"] = True
    guarded = g.guard_tool(issue_refund, name="issue_refund", target_env="production")
    with pytest.raises(BlockedActionError):
        guarded(amount=100)
    assert ran["v"] is False, "defaulted to allow with no approver — FAILED OPEN"


def test_block_terminal_with_garbage_env(engine):
    d = engine.evaluate(ProposedCall(name="run_sql", args={"query": "DELETE FROM t"}, target_env=str({"weird": 1})))
    assert d.decision == Decision.BLOCK


def test_huge_payload_degrades_gracefully(engine):
    payload = {"dst": "/dev/null", "blob": "x" * 1_000_000}
    t0 = time.time()
    d = engine.evaluate(ProposedCall(name="copy", args=payload, target_env="prod"))
    assert time.time() - t0 < 3.0
    assert d.decision == Decision.BLOCK


def test_block_beats_allow_when_rules_conflict(engine):
    # A call that trips both an allow-ish and a block rule must resolve to BLOCK
    # (most-restrictive-wins), even under mixed signals.
    d = engine.evaluate(ProposedCall(name="lookup_order", args={"id": "ok", "cmd": "rm -rf /"}, target_env="prod"))
    assert d.decision == Decision.BLOCK
