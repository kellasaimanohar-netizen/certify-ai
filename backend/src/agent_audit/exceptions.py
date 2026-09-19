"""Custom exception hierarchy.

Every exception this package raises is a subclass of ``AgentAuditError``,
so callers can catch the whole surface with one ``except`` clause.
"""
from __future__ import annotations


class AgentAuditError(Exception):
    """Base class for all agent-audit exceptions."""


class ConfigError(AgentAuditError):
    """Target configuration failed validation."""


class SourceError(AgentAuditError):
    """A source adapter failed to extract a manifest."""


class FusionConflictError(AgentAuditError):
    """Two adapters produced contradictory values with equal confidence."""


class CheckerError(AgentAuditError):
    """A custom checker failed to load or execute."""


class CertificateError(AgentAuditError):
    """Certificate is malformed, expired, or signature does not verify."""


class PhaseError(AgentAuditError):
    """A phase failed to execute."""
