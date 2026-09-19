"""Abstract base for custom checkers.

A checker is a small, focused rule that produces zero or one Finding per
artifact it inspects. Unlike a *phase*, a checker is user-authored, loaded
at runtime, and scoped to a single content type.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Any, Literal

from agent_audit.findings import Finding
from agent_audit.manifest import TargetManifest


class CheckerKind(str, Enum):
    REGEX = "regex"
    AST = "ast"
    REGO = "rego"
    LLM_JUDGE = "llm_judge"


AppliesTo = Literal[
    "request", "response", "tool_args", "tool_result",
    "source", "prompt", "manifest", "log",
]


@dataclass(slots=True)
class CheckContext:
    """Read-only context passed to every checker invocation."""

    manifest: TargetManifest
    artifact_kind: AppliesTo
    content: str
    artifact_path: str | None = None
    artifact_line: int | None = None
    extra: dict[str, Any] | None = None


class Checker(ABC):
    """Base class for all checkers."""

    id: str
    kind: CheckerKind
    applies_to: tuple[AppliesTo, ...]

    @abstractmethod
    def check(self, ctx: CheckContext) -> Finding | None:
        """Return a Finding if the check triggers, otherwise None."""

    def can_run_on(self, artifact_kind: AppliesTo) -> bool:
        return artifact_kind in self.applies_to

    def __repr__(self) -> str:  # pragma: no cover
        return f"<{type(self).__name__} id={self.id!r} kind={self.kind.value}>"
