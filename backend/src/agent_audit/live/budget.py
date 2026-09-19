"""CallBudget — hard ceilings on calls and spend for a live audit.

A full audit is 76 controls, several of which run ``variability_runs`` perturbed
trials, several with multiple payloads each. Against a live, metered agent that
is easily hundreds-to-thousands of real calls. Without a ceiling, a single
``--mode certify`` run can:

  * burn an unbounded amount of money, and
  * hammer the provider into sustained 429 rate-limiting.

``CallBudget`` enforces three limits and is safe to share across the concurrent
phase workers (guarded by an ``asyncio.Lock``):

  * ``max_calls``       — total agent invocations allowed in the audit.
  * ``max_cost_usd``    — total US-dollar spend allowed (summed from each
                          normalized response's ``cost_usd``).
  * ``max_per_test``    — per-test invocation cap (defence against a single
                          runaway probe).

When a limit would be exceeded the budget raises ``BudgetExceededError``; the
runner converts that into a single CRITICAL operational finding rather than a
crash, so the partial audit is still reported.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field

from agent_audit.exceptions import AgentAuditError

log = logging.getLogger(__name__)


class BudgetExceededError(AgentAuditError):
    """Raised when an audit would exceed its configured call or spend ceiling."""


@dataclass(slots=True)
class CallBudget:
    """Mutable, concurrency-safe budget tracker for one audit run."""

    max_calls: int = 5_000
    max_cost_usd: float = 25.0
    max_per_test: int = 500

    calls_made: int = 0
    cost_spent_usd: float = 0.0
    _per_test_counts: dict[str, int] = field(default_factory=dict)
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock, repr=False)

    async def reserve(self, test_name: str) -> None:
        """Reserve one call slot for ``test_name``. Raises before the call is
        made if any count ceiling would be breached."""
        async with self._lock:
            # Spend ceiling is enforced HERE, before the next call is made, using
            # cost already recorded by settle(). This is what makes the dollar cap
            # a true "block the next call" soft ceiling: the call that crosses the
            # line completes and its result is kept; the following reserve() stops.
            if self.cost_spent_usd >= self.max_cost_usd:
                raise BudgetExceededError(
                    f"spend budget exhausted: ${self.cost_spent_usd:.4f}/${self.max_cost_usd:.2f} "
                    f"after {self.calls_made} calls (raise --max-cost-usd)"
                )
            if self.calls_made + 1 > self.max_calls:
                raise BudgetExceededError(
                    f"call budget exhausted: {self.calls_made}/{self.max_calls} calls "
                    f"(raise --max-calls or reduce --variability-runs)"
                )
            per = self._per_test_counts.get(test_name, 0)
            if per + 1 > self.max_per_test:
                raise BudgetExceededError(
                    f"per-test call cap hit for {test_name!r}: {per}/{self.max_per_test}"
                )
            # Reserve optimistically; settle() records actual cost afterwards.
            self.calls_made += 1
            self._per_test_counts[test_name] = per + 1

    async def release(self, test_name: str) -> None:
        """Refund a slot reserved by ``reserve`` when the call never completed
        (e.g. it failed every retry). Without this, transient failures leak
        budget and abort a legitimate audit early. Never goes below zero."""
        async with self._lock:
            if self.calls_made > 0:
                self.calls_made -= 1
            per = self._per_test_counts.get(test_name, 0)
            if per > 0:
                self._per_test_counts[test_name] = per - 1

    async def settle(self, cost_usd: float) -> None:
        """Record realized cost after a call returns. Never raises — the call
        that just completed has already been paid for, and discarding its result
        would turn a successful probe into a false CRITICAL finding.

        Enforcement of the dollar ceiling happens in ``reserve()`` (checked
        before the *next* call). This makes ``max_cost_usd`` a soft ceiling: the
        single call that crosses it completes and its result is kept; the next
        ``reserve()`` is blocked. Budget for one call of headroom.
        """
        async with self._lock:
            self.cost_spent_usd += max(0.0, float(cost_usd or 0.0))
            if self.cost_spent_usd > self.max_cost_usd:
                log.info(
                    "spend ceiling crossed: $%.4f/$%.2f — next call will be blocked",
                    self.cost_spent_usd, self.max_cost_usd,
                )

    def snapshot(self) -> dict[str, float | int]:
        """Read-only view for the report summary."""
        return {
            "calls_made": self.calls_made,
            "max_calls": self.max_calls,
            "cost_spent_usd": round(self.cost_spent_usd, 4),
            "max_cost_usd": self.max_cost_usd,
            "calls_remaining": max(0, self.max_calls - self.calls_made),
            "budget_remaining_usd": round(max(0.0, self.max_cost_usd - self.cost_spent_usd), 4),
        }
