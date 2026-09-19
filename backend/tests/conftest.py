"""Shared fixtures for agent-audit tests."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

# Ensure src/ is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))


def _find_target_yaml() -> Path:
    # 1. Check environment variable
    env_target = os.getenv("AGENT_AUDIT_TARGET")
    if env_target:
        p = Path(env_target).resolve()
        if p.is_file():
            return p

    # 2. Check targets/ directory. Prefer a target that declares a top-level
    #    runtime endpoint (the shape the v3-compat smoke tests assert against);
    #    provider-based targets (e.g. agentforce) legitimately have no endpoint.
    workspace_root = Path(__file__).resolve().parent.parent
    targets_dir = workspace_root / "targets"
    if targets_dir.is_dir():
        yamls = sorted(targets_dir.glob("*.yaml")) + sorted(targets_dir.glob("*.yml"))
        if yamls:
            import yaml as _yaml

            def _has_endpoint(p: Path) -> bool:
                try:
                    raw = _yaml.safe_load(p.read_text(encoding="utf-8")) or {}
                except Exception:
                    return False
                # flat v3 endpoint, or nested under sources[].runtime
                if isinstance(raw, dict) and raw.get("endpoint"):
                    return True
                for src in (raw.get("sources") or []):
                    rt = (src or {}).get("runtime") or {}
                    if rt.get("endpoint"):
                        return True
                return False

            with_endpoint = [p for p in yamls if _has_endpoint(p)]
            if with_endpoint:
                return with_endpoint[0]
            # No endpoint-based target here — fall through to the root search
            # below rather than returning a provider-only target the smoke tests
            # can't assert an endpoint against.

    # 3. Check workspace root
    root_yamls = list(workspace_root.glob("*.yaml")) + list(workspace_root.glob("*.yml"))
    if root_yamls:
        return root_yamls[0]

    # 4. Check Customer_Agent 2 folder
    cust_path = Path("C:/Personal/Customer_Agent 2/customer_agent_v2_audit.yaml")
    if cust_path.is_file():
        return cust_path

    raise FileNotFoundError(
        "No agent target YAML file found. Please set the AGENT_AUDIT_TARGET environment variable."
    )


@pytest.fixture
def v3_target_path() -> Path:
    return _find_target_yaml()


@pytest.fixture
def v4_target_path() -> Path:
    return _find_target_yaml()

