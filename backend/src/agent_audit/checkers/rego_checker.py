"""OPA/Rego policy checker.

Evaluates an OPA (Open Policy Agent) Rego policy against agent content.
OPA must be installed and available on PATH as ``opa``.

YAML config:
    - id: no_pii_in_output
      kind: rego
      policy_path: ./policies/no_pii.rego
      query: "data.agent.pii.violation"
      applies_to: [response]
      severity: CRITICAL
      title: "PII detected by OPA policy"
      remediation: "Apply output PII redaction filter."

The policy receives ``input.content`` (the content string being checked)
and ``input.artifact_kind`` (e.g. "response").

It should evaluate to true when a violation is found.

Example policy (no_pii.rego):
    package agent.pii

    violation {
        regex.match("\\d{3}-\\d{2}-\\d{4}", input.content)  # SSN
    }
    violation {
        regex.match("\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}", input.content)
    }

OPA binary: install from https://www.openpolicyagent.org/docs/latest/#running-opa
or ``brew install opa`` / ``apt install opa``.
"""
from __future__ import annotations

import json
import logging
import subprocess
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from agent_audit.checkers.base import AppliesTo, CheckContext, Checker, CheckerKind
from agent_audit.exceptions import CheckerError
from agent_audit.findings import ArtifactRef, Evidence, Finding, StandardRef, fail_finding
from agent_audit.severity import Severity

log = logging.getLogger(__name__)

_OPA_NOT_FOUND_MSG = (
    "OPA binary not found on PATH. "
    "Install from https://www.openpolicyagent.org/docs/latest/#running-opa "
    "or skip rego checkers by removing them from the config."
)


@dataclass(slots=True)
class RegoChecker(Checker):
    """Evaluate an OPA Rego policy against agent content."""

    id: str
    policy_path: Path
    query: str
    applies_to: tuple[AppliesTo, ...]
    severity: Severity
    title: str
    remediation: str = ""
    description: str = ""
    standards: list[StandardRef] = field(default_factory=list)
    cwe: list[str] = field(default_factory=list)
    mitre_atlas: list[str] = field(default_factory=list)
    kind: CheckerKind = CheckerKind.REGO

    # OPA binary path — resolved once at init
    _opa_bin: str = field(default="opa", init=False, repr=False)

    def __post_init__(self) -> None:
        if not self.policy_path.is_file():
            raise CheckerError(
                f"rego checker {self.id!r}: policy not found: {self.policy_path}"
            )
        self._opa_bin = _find_opa()

    def check(self, ctx: CheckContext) -> Finding | None:
        t0 = time.perf_counter()
        input_doc = {
            "content": ctx.content,
            "artifact_kind": ctx.artifact_kind,
            "artifact_path": ctx.artifact_path,
        }

        try:
            result = _run_opa(
                opa_bin=self._opa_bin,
                policy_path=self.policy_path,
                query=self.query,
                input_doc=input_doc,
            )
        except CheckerError as exc:
            log.warning("rego checker %s failed to evaluate: %s", self.id, exc)
            return None

        # OPA eval returns {"result": [{"expressions": [{"value": <bool>}]}]}
        violation = _extract_bool_result(result)

        if not violation:
            return None

        artifact_ref = None
        if ctx.artifact_path:
            artifact_ref = ArtifactRef(
                kind="source" if ctx.artifact_kind in ("source", "prompt") else "config",
                path=ctx.artifact_path,
                line=ctx.artifact_line,
            )

        excerpt = ctx.content[:200] if len(ctx.content) > 200 else ctx.content

        return fail_finding(
            finding_id=self.id,
            phase="custom",
            test_name=self.id,
            severity=self.severity,
            title=self.title,
            description=self.description or f"OPA policy violated: {self.query}",
            remediation=self.remediation,
            standards=self.standards,
            cwe=self.cwe,
            mitre_atlas=self.mitre_atlas,
            evidence=[Evidence(kind="source_excerpt", content=excerpt)],
            artifact_refs=[artifact_ref] if artifact_ref else [],
            duration_ms=(time.perf_counter() - t0) * 1000,
        )

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> RegoChecker:
        required = {"id", "policy_path", "query", "applies_to", "severity", "title"}
        missing = required - set(data.keys())
        if missing:
            raise CheckerError(f"rego checker missing keys: {sorted(missing)}")

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

        standards = [
            StandardRef.from_registry(s["framework"], s["id"])
            for s in data.get("standards", [])
        ]

        return cls(
            id=data["id"],
            policy_path=Path(data["policy_path"]).expanduser(),
            query=data["query"],
            applies_to=tuple(applies_raw),
            severity=severity,
            title=data["title"],
            remediation=data.get("remediation", ""),
            description=data.get("description", ""),
            standards=standards,
            cwe=list(data.get("cwe", [])),
            mitre_atlas=list(data.get("mitre_atlas", [])),
        )


# ── OPA subprocess helpers ────────────────────────────────────────────────

def _find_opa() -> str:
    """Find the OPA binary or raise CheckerError."""
    import shutil
    opa = shutil.which("opa")
    if opa is None:
        raise CheckerError(_OPA_NOT_FOUND_MSG)
    return opa


def _run_opa(
    *,
    opa_bin: str,
    policy_path: Path,
    query: str,
    input_doc: dict[str, Any],
    timeout_s: float = 10.0,
) -> dict[str, Any]:
    """Run ``opa eval`` and return the parsed JSON result."""
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", delete=False, encoding="utf-8"
    ) as tmp:
        json.dump(input_doc, tmp)
        tmp_path = tmp.name

    try:
        proc = subprocess.run(
            [opa_bin, "eval",
             "--format", "json",
             "--data", str(policy_path),
             "--input", tmp_path,
             query],
            capture_output=True,
            text=True,
            timeout=timeout_s,
        )
    except subprocess.TimeoutExpired as exc:
        raise CheckerError(f"OPA eval timed out after {timeout_s}s") from exc
    except FileNotFoundError as exc:
        raise CheckerError(_OPA_NOT_FOUND_MSG) from exc
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    if proc.returncode != 0:
        raise CheckerError(
            f"OPA eval failed (rc={proc.returncode}): {proc.stderr[:300]}"
        )

    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise CheckerError(f"OPA returned invalid JSON: {exc}") from exc


def _extract_bool_result(opa_output: dict[str, Any]) -> bool:
    """Extract the boolean violation flag from OPA eval output."""
    try:
        results = opa_output.get("result", [])
        if not results:
            return False
        value = results[0]["expressions"][0]["value"]
        if isinstance(value, bool):
            return value
        # Some policies return a set — non-empty set = violation
        if isinstance(value, list):
            return len(value) > 0
        return bool(value)
    except (KeyError, IndexError, TypeError):
        return False
