"""Severity levels for findings.

Kept in its own module so ``findings.py`` and ``phases/*`` can import it
without a circular dependency.
"""
from __future__ import annotations

from enum import Enum


class Severity(str, Enum):
    """Finding severity. String-valued so it serialises cleanly."""

    CRITICAL = "CRITICAL"
    WARNING = "WARNING"
    INFO = "INFO"
    PASS = "PASS"
    # Honest uncertainty: variability CI was too wide to decide.
    HIGH_UNCERTAINTY = "HIGH_UNCERTAINTY"

    @property
    def sarif_level(self) -> str:
        """Map to SARIF 2.1.0 level enum."""
        return {
            Severity.CRITICAL: "error",
            Severity.WARNING: "warning",
            Severity.HIGH_UNCERTAINTY: "warning",
            Severity.INFO: "note",
            Severity.PASS: "none",
        }[self]
