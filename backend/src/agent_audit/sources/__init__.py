"""Source adapters — the pluggable input layer.

Each adapter consumes one kind of input (YAML, repo, OpenAPI, MCP, traces…)
and emits a ``TargetManifest``. The runner then fuses manifests from multiple
sources into a single authoritative manifest, recording provenance and
surfacing contested facts as findings.
"""
from __future__ import annotations

from agent_audit.sources.base import SourceAdapter
from agent_audit.sources.loader import load_target
from agent_audit.sources.openapi_adapter import OpenAPIAdapter
from agent_audit.sources.repo_adapter import RepoAdapter
from agent_audit.sources.yaml_adapter import YamlAdapter

__all__ = [
    "OpenAPIAdapter",
    "RepoAdapter",
    "SourceAdapter",
    "YamlAdapter",
    "load_target",
]
