"""Checker discovery and registry.

Two mechanisms:

1. **Entry points** — third-party packages register via
   ``[project.entry-points."agent_audit.checkers"] my_pkg = "my_pkg:register"``
   The ``register(registry)`` callable appends Checker instances.

2. **Directory scan** — ``./checkers/*.yaml`` next to the target config.
   Each YAML file defines one or more checkers by ``kind``.
"""
from __future__ import annotations

import logging
from importlib.metadata import entry_points
from pathlib import Path
from typing import Any

import yaml

from agent_audit.checkers.base import AppliesTo, CheckContext, Checker, CheckerKind
from agent_audit.checkers.regex_checker import RegexChecker
from agent_audit.exceptions import CheckerError
from agent_audit.findings import Finding

log = logging.getLogger(__name__)

ENTRY_POINT_GROUP = "agent_audit.checkers"


class CheckerRegistry:
    """Holds loaded checkers and dispatches content to them."""

    def __init__(self) -> None:
        self._checkers: list[Checker] = []

    def register(self, checker: Checker) -> None:
        if any(c.id == checker.id for c in self._checkers):
            raise CheckerError(f"duplicate checker id: {checker.id}")
        self._checkers.append(checker)

    def __len__(self) -> int:
        return len(self._checkers)

    def __iter__(self):
        return iter(self._checkers)

    def checkers_for(self, artifact_kind: AppliesTo) -> list[Checker]:
        return [c for c in self._checkers if c.can_run_on(artifact_kind)]

    def run(self, ctx: CheckContext) -> list[Finding]:
        """Run every applicable checker and collect findings."""
        findings: list[Finding] = []
        for checker in self.checkers_for(ctx.artifact_kind):
            try:
                f = checker.check(ctx)
            except Exception as exc:
                log.exception("checker %s raised", checker.id)
                raise CheckerError(f"checker {checker.id!r} failed: {exc}") from exc
            if f is not None:
                findings.append(f)
        return findings


def load_checkers(
    *, from_config: list[dict[str, Any]] | None = None,
    from_dir: Path | None = None,
    from_entry_points: bool = True,
) -> CheckerRegistry:
    """Build a registry from all enabled discovery sources."""
    registry = CheckerRegistry()

    if from_entry_points:
        _load_entry_points(registry)

    if from_config:
        for raw in from_config:
            registry.register(_build_from_dict(raw))

    if from_dir and from_dir.is_dir():
        for yaml_file in sorted(from_dir.glob("*.yaml")):
            for raw in _load_yaml_file(yaml_file):
                registry.register(_build_from_dict(raw))

    log.info("loaded %d checker(s)", len(registry))
    return registry


def _load_entry_points(registry: CheckerRegistry) -> None:
    try:
        eps = entry_points(group=ENTRY_POINT_GROUP)
    except TypeError:  # pragma: no cover - py3.9 fallback
        eps = entry_points().get(ENTRY_POINT_GROUP, [])

    for ep in eps:
        try:
            fn = ep.load()
            fn(registry)
            log.info("loaded checkers from entry-point %s", ep.name)
        except Exception as exc:
            log.error("entry-point %s failed to load: %s", ep.name, exc)


def _load_yaml_file(path: Path) -> list[dict[str, Any]]:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if data is None:
        return []
    if isinstance(data, dict):
        return [data]
    if isinstance(data, list):
        return data
    raise CheckerError(f"{path}: expected mapping or list, got {type(data).__name__}")


def _build_from_dict(data: dict[str, Any]) -> Checker:
    kind_str = data.get("kind")
    if not kind_str:
        raise CheckerError(f"checker missing 'kind': {data}")
    try:
        kind = CheckerKind(kind_str)
    except ValueError as exc:
        raise CheckerError(f"unknown checker kind: {kind_str!r}") from exc

    if kind is CheckerKind.REGEX:
        return RegexChecker.from_dict(data)
    if kind is CheckerKind.REGO:
        from agent_audit.checkers.rego_checker import RegoChecker
        return RegoChecker.from_dict(data)
    if kind is CheckerKind.LLM_JUDGE:
        from agent_audit.checkers.llm_judge_checker import LLMJudgeChecker
        return LLMJudgeChecker.from_dict(data)
    if kind is CheckerKind.AST:
        from agent_audit.checkers.ast_checker import ASTChecker
        return ASTChecker.from_dict(data)
    raise CheckerError(f"unhandled checker kind: {kind}")  # pragma: no cover
