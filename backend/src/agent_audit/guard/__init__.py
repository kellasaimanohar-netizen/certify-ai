"""CertifyAI Guard — in-path policy enforcement for agent tool calls.

The monitor (``agent_audit.monitor``) is *post-hoc*: it judges a run that already
happened, so it can detect a destructive action but never stop it. The Guard is
the complement: a synchronous, deterministic broker that a tool call passes
through *before* it executes, with the authority to ALLOW, BLOCK, or hold it for
human approval (REQUIRE_APPROVAL).

Design invariants (do not weaken without a security review):

  * **Deterministic & offline.** Policy evaluation is a pure function of the
    proposed call + the policy. No network, no clock-dependent behaviour, no I/O
    in the decision path — the guard must never be the thing that hangs or
    breaks the agent.
  * **Fail-closed for major actions.** If evaluation raises, an action assessed
    as destructive/major is BLOCKED, not allowed. Benign actions fail-open so the
    guard is not an availability outage. The posture is keyed to assessed risk.
  * **Argument-aware, not just verb-name.** The danger is usually in the
    arguments (``delete`` with no filter, ``path=/``, a production target), not
    the verb alone. Rules see the full call.
  * **Decisions are evidence.** Every decision is recorded so a certify run can
    prove the agent respects the guard, and a monitored deployment has an audit
    trail of what was stopped.

This module is the decision core. The interceptor that wraps real tool callables
lives in ``agent_audit.guard.broker``; reusable rules live in
``agent_audit.guard.policy``.
"""
from __future__ import annotations

import enum
from dataclasses import dataclass, field
from typing import Any, Callable


class Decision(enum.Enum):
    ALLOW = "allow"
    REQUIRE_APPROVAL = "require_approval"
    BLOCK = "block"


# Ordering so we can take the most-restrictive decision across many rules.
_SEVERITY_ORDER = {Decision.ALLOW: 0, Decision.REQUIRE_APPROVAL: 1, Decision.BLOCK: 2}


@dataclass(frozen=True)
class ProposedCall:
    """A tool/action the agent wants to execute, seen BEFORE execution."""
    name: str
    args: dict[str, Any] = field(default_factory=dict)
    # optional context the caller can supply to sharpen rules
    target_env: str = "unknown"          # e.g. "production" | "sandbox"
    hitl_approved: bool | None = None     # did a human already approve?


@dataclass(frozen=True)
class RuleOutcome:
    """One rule's verdict on a proposed call."""
    decision: Decision
    rule: str
    reason: str


@dataclass
class GuardDecision:
    """The final, aggregated decision returned to the broker."""
    decision: Decision
    call: ProposedCall
    reasons: list[RuleOutcome] = field(default_factory=list)

    @property
    def allowed(self) -> bool:
        return self.decision is Decision.ALLOW

    @property
    def blocked(self) -> bool:
        return self.decision is Decision.BLOCK

    @property
    def needs_approval(self) -> bool:
        return self.decision is Decision.REQUIRE_APPROVAL

    def summary(self) -> str:
        top = "; ".join(f"{r.rule}: {r.reason}" for r in self.reasons
                        if r.decision is self.decision) or "no rule triggered"
        return f"{self.decision.value.upper()} — {top}"


# A rule is a pure function: ProposedCall -> RuleOutcome | None (None = abstain).
Rule = Callable[[ProposedCall], "RuleOutcome | None"]


class PolicyEngine:
    """Aggregates rules into a single decision (most-restrictive wins).

    Fail-closed contract: if a rule raises, the engine treats it as a BLOCK when
    the call is assessed major (see ``is_major``), else it records the error and
    continues (fail-open for benign calls).
    """

    def __init__(self, rules: list[Rule], *,
                 default: Decision = Decision.ALLOW,
                 major_predicate: "Callable[[ProposedCall], bool] | None" = None) -> None:
        self._rules = list(rules)
        self._default = default
        self._is_major = major_predicate or (lambda c: False)

    def evaluate(self, call: ProposedCall) -> GuardDecision:
        outcomes: list[RuleOutcome] = []
        final = self._default
        for rule in self._rules:
            try:
                out = rule(call)
            except Exception as exc:  # a broken rule must not open the gate
                if self._is_major(call):
                    out = RuleOutcome(Decision.BLOCK, getattr(rule, "__name__", "rule"),
                                      f"rule errored on a major action → fail-closed: {exc}")
                else:
                    out = RuleOutcome(Decision.ALLOW, getattr(rule, "__name__", "rule"),
                                      f"rule errored on a benign action → fail-open: {exc}")
            if out is None:
                continue
            outcomes.append(out)
            if _SEVERITY_ORDER[out.decision] > _SEVERITY_ORDER[final]:
                final = out.decision
        # A human pre-approval downgrades REQUIRE_APPROVAL to ALLOW, but can
        # never downgrade a BLOCK (some things are never allowed).
        if final is Decision.REQUIRE_APPROVAL and call.hitl_approved is True:
            outcomes.append(RuleOutcome(Decision.ALLOW, "hitl",
                                        "human pre-approved this action"))
            final = Decision.ALLOW
        return GuardDecision(decision=final, call=call, reasons=outcomes)
