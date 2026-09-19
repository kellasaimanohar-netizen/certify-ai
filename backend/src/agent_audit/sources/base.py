"""Abstract base for source adapters."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from agent_audit.manifest import TargetManifest


class SourceAdapter(ABC):
    """Base class for all input-source adapters.

    Subclasses declare their ``source_type`` and ``default_confidence``, then
    implement ``extract`` to turn a config-block dict into a partial manifest.

    Confidence semantics:
      - 1.0 = explicitly declared by a human (YAML, config file)
      - 0.8 = spec-documented (OpenAPI, model card)
      - 0.6 = statically inferred from code (RepoAdapter)
      - 0.4 = heuristic / observed (traces, logs)
    """

    source_type: str
    default_confidence: float = 1.0

    @abstractmethod
    def extract(self, spec: dict[str, Any], *, agent_name: str) -> TargetManifest:
        """Build a partial ``TargetManifest`` from one source spec block."""

    def __repr__(self) -> str:  # pragma: no cover - trivial
        return f"<{type(self).__name__} source_type={self.source_type!r}>"
