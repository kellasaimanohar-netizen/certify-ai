"""CertifyAI Guard broker — the in-path interceptor.

Wraps a real tool callable so every invocation is evaluated by the
:class:`PolicyEngine` *before* it runs. This is the piece that turns a decision
into enforcement:

  * ALLOW            → the real tool runs.
  * BLOCK            → the tool does NOT run; a ``BlockedActionError`` is raised
                       (or, in non-raising mode, a structured refusal is returned).
  * REQUIRE_APPROVAL → an approval handler is consulted; if it does not grant
                       approval, the call is treated as blocked.

Every decision is appended to an audit log so a certify run can *prove* the agent
respects the guard, and a monitored deployment has a record of what was stopped.

Deployment note (honest): this can only enforce calls that actually pass through
it. For agents CertifyAI drives, or platforms with a pre-execution tool-call hook
(OpenAI/Foundry-style ``requires_action``), that's natural. For a fully
autonomous in-process agent, the customer must route its tool calls through
``guard_tool``/``GuardedToolset`` — the guard cannot stop a call it never sees.
"""
from __future__ import annotations

import functools
import logging
from dataclasses import dataclass, field
from typing import Any, Callable

from agent_audit.guard import (
    Decision, GuardDecision, PolicyEngine, ProposedCall,
)
from agent_audit.guard.policy import default_rules, is_major

log = logging.getLogger(__name__)


class BlockedActionError(RuntimeError):
    """Raised when the guard blocks a tool call from executing."""
    def __init__(self, decision: GuardDecision) -> None:
        self.decision = decision
        super().__init__(decision.summary())


# An approval handler is asked to approve a held call. Returns True to allow.
# Default: deny (fail-safe) — approvals must be an explicit, deliberate choice.
ApprovalHandler = Callable[[GuardDecision], bool]


def _deny_by_default(_: GuardDecision) -> bool:
    return False


@dataclass
class GuardAuditLog:
    """In-memory record of every decision. Cheap; caller can persist it."""
    entries: list[dict] = field(default_factory=list)

    def record(self, d: GuardDecision, *, executed: bool) -> None:
        self.entries.append({
            "tool": d.call.name,
            "decision": d.decision.value,
            "executed": executed,
            "target_env": d.call.target_env,
            "reasons": [{"rule": r.rule, "decision": r.decision.value,
                         "reason": r.reason} for r in d.reasons],
        })

    @property
    def blocked(self) -> list[dict]:
        return [e for e in self.entries if e["decision"] == "block"]

    @property
    def held(self) -> list[dict]:
        return [e for e in self.entries if e["decision"] == "require_approval"]


class Guard:
    """Holds a policy engine + approval handler + audit log, and enforces."""

    def __init__(self, *, rules: "list | None" = None,
                 approval_handler: ApprovalHandler = _deny_by_default,
                 default: Decision = Decision.ALLOW,
                 audit_log: "GuardAuditLog | None" = None) -> None:
        self.engine = PolicyEngine(
            rules if rules is not None else default_rules(),
            default=default, major_predicate=is_major)
        self.approve = approval_handler
        self.audit = audit_log if audit_log is not None else GuardAuditLog()

    def decide(self, call: ProposedCall) -> GuardDecision:
        """Evaluate a proposed call without executing anything (dry-run)."""
        return self.engine.evaluate(call)

    def enforce(self, call: ProposedCall) -> GuardDecision:
        """Decide, consult the approval handler for held calls, and record.

        Returns the final GuardDecision (its ``.allowed`` says whether the caller
        may proceed). Does NOT itself run the tool — see ``guard_tool`` for the
        wrapper that runs the real callable on ALLOW.
        """
        decision = self.engine.evaluate(call)
        if decision.needs_approval:
            granted = False
            try:
                granted = bool(self.approve(decision))
            except Exception as exc:  # a broken approver must fail safe (deny)
                log.warning("approval handler errored — denying: %s", exc)
                granted = False
            if granted:
                decision = GuardDecision(
                    decision=Decision.ALLOW, call=call,
                    reasons=[*decision.reasons])
            else:
                decision = GuardDecision(
                    decision=Decision.BLOCK, call=call,
                    reasons=[*decision.reasons])
        self.audit.record(decision, executed=decision.allowed)
        return decision

    def guard_tool(self, fn: Callable, *, name: "str | None" = None,
                   target_env: str = "unknown") -> Callable:
        """Wrap a real tool callable so it only runs when the guard allows.

        The wrapped callable is invoked as ``wrapped(**kwargs)``; those kwargs are
        the arguments the policy inspects. On BLOCK (or unapproved hold) it raises
        ``BlockedActionError`` and the real function is never called.
        """
        tool_name = name or getattr(fn, "__name__", "tool")

        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            call = ProposedCall(name=tool_name, args=dict(kwargs),
                                target_env=target_env)
            decision = self.enforce(call)
            if not decision.allowed:
                raise BlockedActionError(decision)
            return fn(*args, **kwargs)

        wrapper.__guarded__ = True  # type: ignore[attr-defined]
        return wrapper


class GuardedToolset:
    """Convenience: wrap a dict of {name: callable} tools in one shared Guard."""

    def __init__(self, tools: dict[str, Callable], *, guard: "Guard | None" = None,
                 target_env: str = "unknown") -> None:
        self.guard = guard or Guard()
        self.tools = {
            name: self.guard.guard_tool(fn, name=name, target_env=target_env)
            for name, fn in tools.items()
        }

    def __getitem__(self, name: str) -> Callable:
        return self.tools[name]
