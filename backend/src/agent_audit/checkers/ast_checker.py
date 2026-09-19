"""AST-based code checker — pattern-based static analysis of agent source code.

Scans Python source files (as loaded by RepoAdapter) for code patterns that
violate security or agentic best practices. Uses Python's built-in ``ast``
module — no external tools required.

YAML config:
    - id: no_hardcoded_secrets
      kind: ast
      pattern: hardcoded_secrets
      applies_to: [source]
      severity: CRITICAL
      title: "Hardcoded secret detected in agent source code"
      remediation: "Move secrets to environment variables or a secrets manager."

Built-in pattern IDs:
  hardcoded_secrets      — string literals matching secret patterns (tokens, keys, passwords)
  eval_usage             — calls to eval() or exec() — code injection risk
  pickle_usage           — pickle.loads / pickle.load — deserialization attack surface
  subprocess_shell_true  — subprocess.run(shell=True) — shell injection risk
  raw_sql_format         — f-string or % format inside SQL-like strings — SQLi risk
  unrestricted_file_read — open() without path validation in tool functions
  missing_input_validation — tool functions accepting **kwargs without validation

Custom patterns can be added by registering new ASTPattern instances.
"""
from __future__ import annotations

import ast
import logging
import re
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from agent_audit.checkers.base import AppliesTo, CheckContext, Checker, CheckerKind
from agent_audit.exceptions import CheckerError
from agent_audit.findings import ArtifactRef, Evidence, Finding, StandardRef, fail_finding
from agent_audit.severity import Severity

log = logging.getLogger(__name__)

# Regex patterns for hardcoded secrets (quick scan before AST)
_SECRET_PATTERNS = re.compile(
    r"(?i)(password|passwd|secret|api[_-]?key|token|bearer|private[_-]?key|"
    r"access[_-]?key|client[_-]?secret)\s*=\s*['\"][^'\"]{8,}['\"]"
)

# SQL-like string detection
_SQL_KEYWORDS = re.compile(
    r"(?i)\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC)\b"
)


@dataclass(frozen=True)
class ASTViolation:
    """A single violation found by an AST pattern check."""
    line: int
    col: int
    message: str
    excerpt: str


@dataclass(slots=True)
class ASTChecker(Checker):
    """Check Python source code for dangerous patterns using AST analysis."""

    id: str
    pattern_id: str                    # Which built-in pattern to apply
    applies_to: tuple[AppliesTo, ...]
    severity: Severity
    title: str
    remediation: str = ""
    description: str = ""
    standards: list[StandardRef] = field(default_factory=list)
    cwe: list[str] = field(default_factory=list)
    mitre_atlas: list[str] = field(default_factory=list)
    kind: CheckerKind = CheckerKind.AST

    def check(self, ctx: CheckContext) -> Finding | None:
        t0 = time.perf_counter()

        if ctx.artifact_kind not in ("source", "prompt"):
            return None  # Only scan source files

        pattern_fn = _PATTERNS.get(self.pattern_id)
        if pattern_fn is None:
            log.warning("ast checker %s: unknown pattern_id %r", self.id, self.pattern_id)
            return None

        violations = pattern_fn(ctx.content, ctx.artifact_path or "<unknown>")
        if not violations:
            return None

        first = violations[0]
        artifact_ref = ArtifactRef(
            kind="source",
            path=ctx.artifact_path,
            line=first.line,
        ) if ctx.artifact_path else None

        # Show first 3 violations in evidence
        evidence_text = "\n".join(
            f"Line {v.line}: {v.message}\n  {v.excerpt}"
            for v in violations[:3]
        )

        return fail_finding(
            finding_id=self.id,
            phase="custom",
            test_name=self.id,
            severity=self.severity,
            title=f"{self.title} ({len(violations)} occurrence(s))",
            description=(
                f"{self.description}\n\n{evidence_text}"
                if self.description else evidence_text
            ).strip(),
            remediation=self.remediation,
            standards=self.standards,
            cwe=self.cwe,
            mitre_atlas=self.mitre_atlas,
            evidence=[Evidence(kind="source_excerpt", content=evidence_text)],
            artifact_refs=[artifact_ref] if artifact_ref else [],
            duration_ms=(time.perf_counter() - t0) * 1000,
        )

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> ASTChecker:
        required = {"id", "pattern", "applies_to", "severity", "title"}
        missing = required - set(data.keys())
        if missing:
            raise CheckerError(f"ast checker missing keys: {sorted(missing)}")

        applies_raw = data["applies_to"]
        if isinstance(applies_raw, str):
            applies_raw = [applies_raw]

        severity_str = str(data["severity"]).upper()
        try:
            severity = Severity(severity_str)
        except ValueError as exc:
            raise CheckerError(
                f"unknown severity {severity_str!r} in checker {data['id']!r}"
            ) from exc

        pattern_id = data["pattern"]
        if pattern_id not in _PATTERNS:
            raise CheckerError(
                f"ast checker {data['id']!r}: unknown pattern {pattern_id!r}. "
                f"Available: {sorted(_PATTERNS)}"
            )

        standards = [
            StandardRef.from_registry(s["framework"], s["id"])
            for s in data.get("standards", [])
        ]

        return cls(
            id=data["id"],
            pattern_id=pattern_id,
            applies_to=tuple(applies_raw),
            severity=severity,
            title=data["title"],
            remediation=data.get("remediation", ""),
            description=data.get("description", ""),
            standards=standards,
            cwe=list(data.get("cwe", [])),
            mitre_atlas=list(data.get("mitre_atlas", [])),
        )


# ── Built-in pattern implementations ─────────────────────────────────────

def _check_hardcoded_secrets(source: str, path: str) -> list[ASTViolation]:
    violations: list[ASTViolation] = []
    for i, line in enumerate(source.splitlines(), 1):
        m = _SECRET_PATTERNS.search(line)
        if m:
            violations.append(ASTViolation(
                line=i, col=m.start(),
                message="Hardcoded secret-like assignment",
                excerpt=line.strip()[:120],
            ))
    return violations


def _check_eval_usage(source: str, path: str) -> list[ASTViolation]:
    violations: list[ASTViolation] = []
    try:
        tree = ast.parse(source, filename=path)
    except SyntaxError:
        return violations

    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            func = node.func
            name = ""
            if isinstance(func, ast.Name):
                name = func.id
            elif isinstance(func, ast.Attribute):
                name = func.attr
            if name in ("eval", "exec", "compile"):
                violations.append(ASTViolation(
                    line=node.lineno, col=node.col_offset,
                    message=f"Call to {name}() — code injection risk",
                    excerpt=f"{name}(...) at line {node.lineno}",
                ))
    return violations


def _check_pickle_usage(source: str, path: str) -> list[ASTViolation]:
    violations: list[ASTViolation] = []
    try:
        tree = ast.parse(source, filename=path)
    except SyntaxError:
        return violations

    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            func = node.func
            if isinstance(func, ast.Attribute):
                if func.attr in ("loads", "load") and isinstance(func.value, ast.Name):
                    if func.value.id == "pickle":
                        violations.append(ASTViolation(
                            line=node.lineno, col=node.col_offset,
                            message="pickle.loads/load() — deserialization attack surface",
                            excerpt=f"pickle.{func.attr}(...) at line {node.lineno}",
                        ))
    return violations


def _check_subprocess_shell_true(source: str, path: str) -> list[ASTViolation]:
    violations: list[ASTViolation] = []
    try:
        tree = ast.parse(source, filename=path)
    except SyntaxError:
        return violations

    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            func = node.func
            is_subprocess_call = (
                (isinstance(func, ast.Attribute) and
                 func.attr in ("run", "call", "Popen", "check_output", "check_call"))
                or (isinstance(func, ast.Name) and func.id in ("Popen",))
            )
            if is_subprocess_call:
                for kw in node.keywords:
                    if kw.arg == "shell" and isinstance(kw.value, ast.Constant):
                        if kw.value.value is True:
                            violations.append(ASTViolation(
                                line=node.lineno, col=node.col_offset,
                                message="subprocess call with shell=True — shell injection risk",
                                excerpt=f"subprocess(..., shell=True) at line {node.lineno}",
                            ))
    return violations


def _check_raw_sql_format(source: str, path: str) -> list[ASTViolation]:
    """Detect f-strings or %-formatting used inside SQL-looking strings."""
    violations: list[ASTViolation] = []
    try:
        tree = ast.parse(source, filename=path)
    except SyntaxError:
        return violations

    for node in ast.walk(tree):
        # f-strings containing SQL keywords
        if isinstance(node, ast.JoinedStr):
            # Reconstruct approximate source line for display
            line_src = source.splitlines()[node.lineno - 1] if node.lineno <= len(source.splitlines()) else ""
            if _SQL_KEYWORDS.search(line_src):
                violations.append(ASTViolation(
                    line=node.lineno, col=node.col_offset,
                    message="f-string containing SQL keyword — potential SQL injection",
                    excerpt=line_src.strip()[:120],
                ))
        # % formatting: "SELECT ... %s" % user_input
        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Mod):
            if isinstance(node.left, ast.Constant) and isinstance(node.left.value, str):
                if _SQL_KEYWORDS.search(node.left.value):
                    line_src = source.splitlines()[node.lineno - 1] if node.lineno <= len(source.splitlines()) else ""
                    violations.append(ASTViolation(
                        line=node.lineno, col=node.col_offset,
                        message="%-formatted string containing SQL keyword — potential SQL injection",
                        excerpt=line_src.strip()[:120],
                    ))
    return violations


def _check_missing_input_validation(source: str, path: str) -> list[ASTViolation]:
    """Tool functions that accept **kwargs without type-checking are validation gaps."""
    violations: list[ASTViolation] = []
    try:
        tree = ast.parse(source, filename=path)
    except SyntaxError:
        return violations

    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue

        # Check if function has @tool decorator
        is_tool = any(
            (isinstance(d, ast.Name) and d.id == "tool")
            or (isinstance(d, ast.Attribute) and d.attr == "tool")
            for d in node.decorator_list
        )
        if not is_tool:
            continue

        # Check for **kwargs without validation (any type: dict without annotation)
        args = node.args
        if args.kwarg is not None and args.kwarg.annotation is None:
            violations.append(ASTViolation(
                line=node.lineno, col=node.col_offset,
                message=f"Tool function {node.name!r} accepts **kwargs without type annotation",
                excerpt=f"def {node.name}(**{args.kwarg.arg}): at line {node.lineno}",
            ))

    return violations


def _check_unrestricted_file_read(source: str, path: str) -> list[ASTViolation]:
    """open() calls inside tool functions without path validation."""
    violations: list[ASTViolation] = []
    try:
        tree = ast.parse(source, filename=path)
    except SyntaxError:
        return violations

    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue

        is_tool = any(
            (isinstance(d, ast.Name) and d.id in ("tool", "function_tool"))
            or (isinstance(d, ast.Attribute) and d.attr in ("tool", "function_tool"))
            for d in node.decorator_list
        )
        if not is_tool:
            continue

        # Find open() calls within this function
        for child in ast.walk(node):
            if isinstance(child, ast.Call):
                func = child.func
                if isinstance(func, ast.Name) and func.id == "open":
                    violations.append(ASTViolation(
                        line=child.lineno, col=child.col_offset,
                        message=f"open() call in tool function {node.name!r} without visible path validation",
                        excerpt=f"open(...) in {node.name}() at line {child.lineno}",
                    ))

    return violations


# ── Pattern registry ──────────────────────────────────────────────────────
PatternFn = Callable[[str, str], list[ASTViolation]]

_PATTERNS: dict[str, PatternFn] = {
    "hardcoded_secrets":       _check_hardcoded_secrets,
    "eval_usage":              _check_eval_usage,
    "pickle_usage":            _check_pickle_usage,
    "subprocess_shell_true":   _check_subprocess_shell_true,
    "raw_sql_format":          _check_raw_sql_format,
    "missing_input_validation": _check_missing_input_validation,
    "unrestricted_file_read":  _check_unrestricted_file_read,
}


def available_patterns() -> list[str]:
    """List all registered AST pattern IDs."""
    return sorted(_PATTERNS)
