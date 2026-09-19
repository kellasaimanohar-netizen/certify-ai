"""Regex-based custom checkers.

Loaded from YAML:

    - id: internal_codename_leak
      kind: regex
      pattern: "(?i)\\b(project_atlas|bluewhale)\\b"
      applies_to: [response, tool_args]
      severity: CRITICAL
      title: "Internal codename leaked in agent output"
      remediation: "Add output filter to strip internal codenames."
      standards:
        - { framework: owasp_llm_2025, id: LLM02 }
      cwe: ["CWE-200"]
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from agent_audit.checkers.base import AppliesTo, CheckContext, Checker, CheckerKind
from agent_audit.exceptions import CheckerError
from agent_audit.findings import (
    ArtifactRef,
    Evidence,
    Finding,
    StandardRef,
    fail_finding,
)
from agent_audit.severity import Severity


@dataclass(slots=True)
class RegexChecker(Checker):
    """Flag content matching a compiled regex."""

    id: str
    pattern: str
    applies_to: tuple[AppliesTo, ...]
    severity: Severity
    title: str
    remediation: str = ""
    description: str = ""
    standards: list[StandardRef] = field(default_factory=list)
    cwe: list[str] = field(default_factory=list)
    mitre_atlas: list[str] = field(default_factory=list)
    kind: CheckerKind = CheckerKind.REGEX
    _compiled: re.Pattern[str] = field(init=False)

    def __post_init__(self) -> None:
        try:
            self._compiled = re.compile(self.pattern)
        except re.error as exc:
            raise CheckerError(f"invalid regex in checker {self.id!r}: {exc}") from exc

    def check(self, ctx: CheckContext) -> Finding | None:
        m = self._compiled.search(ctx.content)
        if not m:
            return None

        excerpt_start = max(0, m.start() - 40)
        excerpt_end = min(len(ctx.content), m.end() + 40)
        excerpt = ctx.content[excerpt_start:excerpt_end]

        artifact_ref = None
        if ctx.artifact_path:
            artifact_ref = ArtifactRef(
                kind="source" if ctx.artifact_kind in ("source", "prompt") else "config",
                path=ctx.artifact_path,
                line=ctx.artifact_line,
            )

        return fail_finding(
            finding_id=self.id,
            phase="custom",
            test_name=self.id,
            severity=self.severity,
            title=self.title,
            description=self.description or f"Pattern matched: {self.pattern}",
            remediation=self.remediation,
            standards=self.standards,
            cwe=self.cwe,
            mitre_atlas=self.mitre_atlas,
            evidence=[Evidence(kind="source_excerpt", content=excerpt)],
            artifact_refs=[artifact_ref] if artifact_ref else [],
        )

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> RegexChecker:
        """Build a RegexChecker from a YAML-loaded mapping."""
        required = {"id", "pattern", "applies_to", "severity", "title"}
        missing = required - set(data.keys())
        if missing:
            raise CheckerError(f"regex checker missing keys: {sorted(missing)}")

        applies_raw = data["applies_to"]
        if isinstance(applies_raw, str):
            applies_raw = [applies_raw]

        severity_str = str(data["severity"]).upper()
        try:
            severity = Severity(severity_str)
        except ValueError as exc:
            raise CheckerError(
                f"unknown severity {severity_str!r} in checker {data['id']!r}",
            ) from exc

        standards = [
            StandardRef.from_registry(s["framework"], s["id"])
            for s in data.get("standards", [])
        ]

        return cls(
            id=data["id"],
            pattern=data["pattern"],
            applies_to=tuple(applies_raw),
            severity=severity,
            title=data["title"],
            remediation=data.get("remediation", ""),
            description=data.get("description", ""),
            standards=standards,
            cwe=list(data.get("cwe", [])),
            mitre_atlas=list(data.get("mitre_atlas", [])),
        )
