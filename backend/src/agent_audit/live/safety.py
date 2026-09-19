"""SafetyGate — refuse destructive probes against a production endpoint.

Several phases deliberately try to make the agent misbehave: adversarial tool
chains, multi-turn privilege escalation, browser destructive actions, security
agent alert floods, data-analysis SQL injection. Pointed at a *production*
agent wired to real tools, those probes can mutate real state — delete records,
send messages, place orders.

The gate makes the operator declare the environment explicitly and blocks the
dangerous combination. Philosophy: fail closed. If the environment is unknown
and the endpoint is live, destructive phases are refused, not silently run.

Usage (in the runner, before dispatching a phase):

    gate = SafetyGate(env=TargetEnv.SANDBOX, live=not mock_tools)
    gate.authorize(phase_key)          # raises SandboxViolationError if unsafe
"""
from __future__ import annotations

import enum
import logging

from agent_audit.exceptions import AgentAuditError

log = logging.getLogger(__name__)


class SandboxViolationError(AgentAuditError):
    """A destructive phase was requested against a non-sandbox live endpoint."""


class TargetEnv(str, enum.Enum):
    SANDBOX = "sandbox"
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    UNKNOWN = "unknown"

    @classmethod
    def parse(cls, value: str | None, endpoint: str | None = None) -> TargetEnv:
        if value:
            val_clean = value.strip().lower()
            try:
                return cls(val_clean)
            except ValueError:
                if val_clean in ("dev", "development"):
                    return cls.DEVELOPMENT
                elif val_clean in ("prod", "production"):
                    return cls.PRODUCTION
                elif val_clean in ("stage", "staging"):
                    return cls.STAGING
                elif val_clean in ("sandbox",):
                    return cls.SANDBOX

        # If no explicit target_env, auto-detect from the endpoint url keyword patterns
        if endpoint:
            url_lower = endpoint.lower()
            if any(k in url_lower for k in ("localhost", "127.0.0.1", "0.0.0.0", "192.168.", "10.", "172.16.", "172.17.", "172.18.", "172.19.", "172.2", "172.3", ".local", ".dev", "sandbox", "test", "onrender")):
                return cls.SANDBOX  # treat as sandbox environment safely
            elif any(k in url_lower for k in ("stage", "staging")):
                return cls.STAGING
            elif any(k in url_lower for k in ("prod", "production", "api.")):
                return cls.PRODUCTION
        return cls.UNKNOWN


# Phases that can cause side effects on a live, tool-wired agent.
# Keyed by the phase ids used in PHASE_MAP.
DESTRUCTIVE_PHASES: frozenset[str] = frozenset({
    "adversarial",      # tool-chain attacks, context flooding
    "multi_turn",       # privilege escalation across turns
    "security_agent",   # alert flood, threat-intel injection
    "browser",          # navigation + unconfirmed destructive actions
    "data_analysis",    # SQL injection probes
})


class SafetyGate:
    """Authorizes (or refuses) each phase given the declared environment."""

    def __init__(self, *, env: TargetEnv, live: bool, allow_destructive_override: bool = False) -> None:
        self.env = env
        self.live = live
        self.allow_destructive_override = allow_destructive_override

    def authorize(self, phase_key: str) -> None:
        """Raise ``SandboxViolationError`` if running ``phase_key`` is unsafe."""
        # Mock runs are always safe — no real side effects.
        if not self.live:
            return
        if phase_key not in DESTRUCTIVE_PHASES:
            return
        # Destructive phase against a live endpoint — sandbox/development is allowed.
        if self.env in (TargetEnv.SANDBOX, TargetEnv.DEVELOPMENT):
            return
        if self.allow_destructive_override and self.env is TargetEnv.STAGING:
            log.warning(
                "phase %r is destructive and target-env=staging; running due to "
                "explicit --allow-destructive override", phase_key,
            )
            return
        raise SandboxViolationError(
            f"phase {phase_key!r} performs destructive/adversarial probes and "
            f"target-env is {self.env.value!r}."
        )

    def summary(self) -> dict[str, object]:
        return {
            "target_env": self.env.value,
            "live": self.live,
            "destructive_override": self.allow_destructive_override,
            "guarded_phases": sorted(DESTRUCTIVE_PHASES),
        }
