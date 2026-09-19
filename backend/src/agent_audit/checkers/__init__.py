"""Custom checker plugin system — v5 fully implemented.

Four plug-in kinds (see individual modules for details):

  * regex      — pattern match on request/response/source (RegexChecker)
  * ast        — Python AST static analysis on source code (ASTChecker)
  * rego       — OPA policy evaluation via subprocess (RegoChecker)
  * llm_judge  — semantic rubric via Claude API (LLMJudgeChecker)

Discovery: by entry-points (installed packages) and by directory scan
(``./checkers/*.yaml``).
"""
from __future__ import annotations

from agent_audit.checkers.base import CheckContext, Checker, CheckerKind
from agent_audit.checkers.registry import CheckerRegistry, load_checkers
from agent_audit.checkers.regex_checker import RegexChecker

__all__ = [
    "CheckContext",
    "Checker",
    "CheckerKind",
    "CheckerRegistry",
    "RegexChecker",
    "load_checkers",
]
