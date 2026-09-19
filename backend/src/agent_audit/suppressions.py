"""Suppression register — accepted-risk management.

YAML file next to the target config:

    - fingerprint: "a7f3c9..."
      reason: "Accepted risk — mitigated by WAF rule 412 (ticket SEC-1821)"
      expires: "2026-10-01"
      approved_by: "ciso@org.com"

Expired suppressions auto-reopen. Suppression events are embedded in the
signed certificate so nobody can silently hide findings after the fact.
"""
from __future__ import annotations

import datetime as dt
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

import yaml

from agent_audit.exceptions import ConfigError
from agent_audit.findings import Finding

log = logging.getLogger(__name__)


@dataclass(slots=True, frozen=True)
class Suppression:
    fingerprint: str
    reason: str
    approved_by: str
    expires: dt.date | None = None

    def is_expired(self, as_of: dt.date | None = None) -> bool:
        if self.expires is None:
            return False
        today = as_of or dt.date.today()
        return today > self.expires

    def to_dict(self) -> dict[str, object]:
        return {
            "fingerprint": self.fingerprint,
            "reason": self.reason,
            "approved_by": self.approved_by,
            "expires": self.expires.isoformat() if self.expires else None,
        }


@dataclass(slots=True)
class SuppressionRegister:
    entries: dict[str, Suppression] = field(default_factory=dict)

    def apply(self, findings: Iterable[Finding]) -> list[Finding]:
        """Mark matching findings as suppressed (in place) and return the list."""
        out: list[Finding] = []
        for f in findings:
            sup = self.entries.get(f.fingerprint)
            if sup and not sup.is_expired():
                f.suppressed = True
                f.suppression_reason = f"{sup.reason} (approved by {sup.approved_by})"
            out.append(f)
        return out

    def active_entries(self) -> list[Suppression]:
        today = dt.date.today()
        return [s for s in self.entries.values() if not s.is_expired(today)]


def load_suppressions(path: str | Path | None) -> SuppressionRegister:
    if path is None:
        return SuppressionRegister()
    p = Path(path).expanduser()
    if not p.is_file():
        log.debug("no suppressions file at %s", p)
        return SuppressionRegister()

    raw = yaml.safe_load(p.read_text(encoding="utf-8"))
    if raw is None:
        return SuppressionRegister()
    if not isinstance(raw, list):
        raise ConfigError(f"suppressions file must be a list: {p}")

    entries: dict[str, Suppression] = {}
    for i, item in enumerate(raw):
        if not isinstance(item, dict):
            raise ConfigError(f"{p}: entry {i} is not a mapping")
        required = {"fingerprint", "reason", "approved_by"}
        missing = required - set(item.keys())
        if missing:
            raise ConfigError(f"{p}: entry {i} missing {sorted(missing)}")

        expires_raw = item.get("expires")
        expires: dt.date | None = None
        if expires_raw:
            if isinstance(expires_raw, dt.date):
                expires = expires_raw
            else:
                try:
                    expires = dt.date.fromisoformat(str(expires_raw))
                except ValueError as exc:
                    raise ConfigError(
                        f"{p}: entry {i}.expires must be YYYY-MM-DD",
                    ) from exc

        entry = Suppression(
            fingerprint=item["fingerprint"],
            reason=item["reason"],
            approved_by=item["approved_by"],
            expires=expires,
        )
        entries[entry.fingerprint] = entry

    log.info("loaded %d suppression(s) from %s", len(entries), p)
    return SuppressionRegister(entries=entries)
