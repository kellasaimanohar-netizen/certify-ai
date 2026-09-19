"""Tests for CertifyAI Guard — in-path enforcement.

Covers the decision core (allow/approve/block, most-restrictive aggregation,
fail-closed on major actions, HITL downgrade) and the broker (real callable only
runs on ALLOW; BLOCK raises and never executes; approvals default-deny; audit
trail is recorded).
"""
from __future__ import annotations

import pytest

from agent_audit.guard import Decision, PolicyEngine, ProposedCall, RuleOutcome
from agent_audit.guard.policy import (
    default_rules, is_major, is_destructive,
    rule_block_destructive_broad_scope, rule_block_unscoped_mutation,
)
from agent_audit.guard.broker import Guard, GuardedToolset, BlockedActionError


def _call(name, **args):
    env = args.pop("_env", "unknown")
    approved = args.pop("_approved", None)
    return ProposedCall(name=name, args=args, target_env=env, hitl_approved=approved)


# ── policy decisions ─────────────────────────────────────────────────────────
class TestPolicyDecisions:
    def setup_method(self):
        self.engine = PolicyEngine(default_rules(), major_predicate=is_major)

    def test_benign_call_allowed(self):
        d = self.engine.evaluate(_call("get_order_status", order_id="SO-1"))
        assert d.decision is Decision.ALLOW

    def test_destructive_broad_scope_blocked(self):
        # the 'delete everything' / rm -rf / cp -> /dev/null class
        for c in [
            _call("delete_files", path="/"),
            _call("remove", target="/etc/passwd"),
            _call("copy", src="repo", dst="/dev/null"),
            _call("delete", scope="all"),
            _call("run", cmd="rm -rf /"),
        ]:
            d = self.engine.evaluate(c)
            assert d.decision is Decision.BLOCK, f"{c.name} not blocked"

    def test_unscoped_sql_mutation_blocked(self):
        d = self.engine.evaluate(_call("run_sql", query="DELETE FROM customers"))
        assert d.decision is Decision.BLOCK

    def test_scoped_sql_mutation_not_auto_blocked(self):
        # has a WHERE clause → not the mass-mutation rule (still destructive→approval)
        d = self.engine.evaluate(_call("run_sql", query="DELETE FROM customers WHERE id=5"))
        assert d.decision in (Decision.REQUIRE_APPROVAL, Decision.ALLOW)
        assert d.decision is not Decision.BLOCK

    def test_destructive_in_production_requires_approval(self):
        d = self.engine.evaluate(_call("delete_record", id="42", _env="production"))
        assert d.decision is Decision.REQUIRE_APPROVAL

    def test_ordinary_destructive_requires_approval(self):
        d = self.engine.evaluate(_call("cancel_subscription", id="7"))
        assert d.decision is Decision.REQUIRE_APPROVAL

    def test_hitl_preapproval_downgrades_approval_to_allow(self):
        d = self.engine.evaluate(_call("cancel_subscription", id="7", _approved=True))
        assert d.decision is Decision.ALLOW

    def test_hitl_preapproval_cannot_downgrade_a_block(self):
        # a broad-scope destroy is BLOCK even if a human "approved" it
        d = self.engine.evaluate(_call("delete_files", path="/", _approved=True))
        assert d.decision is Decision.BLOCK


# ── most-restrictive aggregation & fail-closed ───────────────────────────────
class TestAggregationAndFailure:
    def test_most_restrictive_wins(self):
        def approve_rule(c): return RuleOutcome(Decision.REQUIRE_APPROVAL, "a", "x")
        def block_rule(c): return RuleOutcome(Decision.BLOCK, "b", "y")
        eng = PolicyEngine([approve_rule, block_rule], major_predicate=is_major)
        assert eng.evaluate(_call("x")).decision is Decision.BLOCK

    def test_broken_rule_on_major_action_fails_closed(self):
        def boom(c): raise ValueError("rule bug")
        eng = PolicyEngine([boom], major_predicate=is_major)
        # major action (destructive verb) → broken rule must BLOCK
        assert eng.evaluate(_call("delete_account", id="1")).decision is Decision.BLOCK

    def test_broken_rule_on_benign_action_fails_open(self):
        def boom(c): raise ValueError("rule bug")
        eng = PolicyEngine([boom], major_predicate=is_major)
        # benign action → broken rule must not become an outage
        assert eng.evaluate(_call("get_status")).decision is Decision.ALLOW


# ── broker enforcement (the in-path part) ────────────────────────────────────
class TestBrokerEnforcement:
    def test_allowed_tool_runs(self):
        g = Guard()
        ran = {}
        def real(**kw): ran.update(kw); return "ok"
        wrapped = g.guard_tool(real, name="get_status")
        assert wrapped(order_id="SO-1") == "ok"
        assert ran == {"order_id": "SO-1"}

    def test_blocked_tool_never_runs(self):
        g = Guard()
        ran = {"called": False}
        def real(**kw): ran["called"] = True
        wrapped = g.guard_tool(real, name="delete_files")
        with pytest.raises(BlockedActionError):
            wrapped(path="/")
        assert ran["called"] is False, "blocked tool executed anyway — critical"

    def test_held_tool_denied_by_default(self):
        g = Guard()  # default approval handler denies
        ran = {"called": False}
        def real(**kw): ran["called"] = True
        wrapped = g.guard_tool(real, name="cancel_subscription")
        with pytest.raises(BlockedActionError):
            wrapped(id="7")
        assert ran["called"] is False

    def test_held_tool_runs_when_approved(self):
        g = Guard(approval_handler=lambda d: True)
        def real(**kw): return "done"
        wrapped = g.guard_tool(real, name="cancel_subscription")
        assert wrapped(id="7") == "done"

    def test_broken_approval_handler_fails_safe(self):
        def boom(d): raise RuntimeError("approver down")
        g = Guard(approval_handler=boom)
        def real(**kw): return "done"
        wrapped = g.guard_tool(real, name="cancel_subscription")
        with pytest.raises(BlockedActionError):
            wrapped(id="7")   # broken approver → deny, not allow

    def test_audit_log_records_decisions(self):
        g = Guard()
        g.guard_tool(lambda **k: "ok", name="get_status")(x=1)
        try:
            g.guard_tool(lambda **k: None, name="delete_files")(path="/")
        except BlockedActionError:
            pass
        assert len(g.audit.entries) == 2
        assert len(g.audit.blocked) == 1
        assert g.audit.blocked[0]["tool"] == "delete_files"
        assert g.audit.blocked[0]["executed"] is False


class TestGuardedToolset:
    def test_toolset_wraps_all(self):
        called = []
        tools = {
            "read": lambda **k: called.append("read") or "r",
            "delete_all": lambda **k: called.append("delete_all"),
        }
        ts = GuardedToolset(tools)
        assert ts["read"](q="x") == "r"
        with pytest.raises(BlockedActionError):
            ts["delete_all"](scope="everything")
        assert "delete_all" not in called


# ── monitor integration: the guard-replay check ─────────────────────────────
class TestGuardMonitorBridge:
    def _run(self, tool_calls):
        from agent_audit.monitor.run_record import RunRecord, ToolCall
        return RunRecord(
            run_id="r1", agent_name="a", source="mock",
            started_at="", finished_at="", outcome="success",
            tool_calls=[ToolCall(name=n, args=ar) for n, ar in tool_calls],
        )

    def _baseline(self):
        from agent_audit.monitor.baseline import MonitorBaseline
        return MonitorBaseline(agent_name="a")

    def test_monitor_flags_would_block_catastrophic(self):
        from agent_audit.monitor.checks import check_guard_would_block
        run = self._run([("copy", {"dst": "/dev/null"})])   # benign name, deadly arg
        findings = check_guard_would_block(run, baseline=self._baseline())
        assert any(f.id == "MON-GUARD-001" and not f.passed for f in findings)

    def test_monitor_passes_clean_run(self):
        from agent_audit.monitor.checks import check_guard_would_block
        run = self._run([("get_order_status", {"id": "SO-1"})])
        findings = check_guard_would_block(run, baseline=self._baseline())
        assert any(f.id == "MON-GUARD-000" and f.passed for f in findings)
