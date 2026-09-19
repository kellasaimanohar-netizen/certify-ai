"""Agent Audit v10 — AI agent pre-deployment certification.

Multi-source, standards-mapped, statistically honest.

Public API:
    from agent_audit import run_audit, load_target, Finding, Severity
"""
from __future__ import annotations

from agent_audit.findings import Finding, Severity, StandardRef
from agent_audit.manifest import TargetManifest
from agent_audit.runner import run_audit
from agent_audit.sources import load_target

__version__ = "10.3.0"

__all__ = [
    "Finding",
    "Severity",
    "StandardRef",
    "TargetManifest",
    "load_target",
    "run_audit",
    "__version__",
]
