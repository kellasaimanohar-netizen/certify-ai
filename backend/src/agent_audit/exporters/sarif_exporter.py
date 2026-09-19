"""SARIF 2.1.0 exporter — drops into GitHub Security tab, Azure DevOps, etc.

Spec: https://docs.oasis-open.org/sarif/sarif/v2.1.0/os/sarif-v2.1.0-os.html
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

from agent_audit import __version__
from agent_audit.findings import Finding
from agent_audit.runner import AuditReport

log = logging.getLogger(__name__)

SARIF_SCHEMA = "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json"
SARIF_VERSION = "2.1.0"


def export_sarif(report: AuditReport, path: str | Path) -> Path:
    """Write a SARIF 2.1.0 log of the audit report."""
    out_path = Path(path).expanduser()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    rules = _build_rules(report.findings)
    results = [_finding_to_result(f) for f in report.findings if not f.passed and not f.suppressed]

    doc = {
        "$schema": SARIF_SCHEMA,
        "version": SARIF_VERSION,
        "runs": [{
            "tool": {
                "driver": {
                    "name": "agent-audit",
                    "version": __version__,
                    "informationUri": "https://github.com/your-org/agent-audit",
                    "rules": rules,
                },
            },
            "invocations": [{
                "startTimeUtc": report.started_at,
                "endTimeUtc": report.finished_at,
                "executionSuccessful": True,
            }],
            "results": results,
            "properties": {
                "agent_name": report.agent_name,
                "mode": report.mode,
                "enterprise_ready": report.enterprise_ready,
            },
        }],
    }

    out_path.write_text(json.dumps(doc, indent=2), encoding="utf-8")
    log.info("SARIF report written to %s", out_path)
    return out_path


def _build_rules(findings: list[Finding]) -> list[dict]:
    """One rule per unique finding.id."""
    seen: dict[str, Finding] = {}
    for f in findings:
        if f.id not in seen:
            seen[f.id] = f
    rules: list[dict] = []
    for f in seen.values():
        rule = {
            "id": f.id,
            "name": f.test_name,
            "shortDescription": {"text": f.title or f.test_name},
            "fullDescription": {"text": f.description or f.title},
            "helpUri": f.references[0] if f.references else "",
            "defaultConfiguration": {"level": f.severity.sarif_level},
            "properties": {
                "phase": f.phase,
                "standards": [f"{s.framework}/{s.identifier}" for s in f.standards],
                "cwe": f.cwe,
                "mitre_atlas": f.mitre_atlas,
            },
        }
        rules.append(rule)
    return rules


def _finding_to_result(f: Finding) -> dict:
    locations = []
    for ref in f.artifact_refs:
        if ref.kind == "source" and ref.path:
            loc = {
                "physicalLocation": {
                    "artifactLocation": {"uri": ref.path},
                },
            }
            if ref.line:
                loc["physicalLocation"]["region"] = {"startLine": ref.line}
            locations.append(loc)
        elif ref.identifier:
            locations.append({
                "logicalLocations": [{"name": ref.identifier, "kind": ref.kind}],
            })

    result = {
        "ruleId": f.id,
        "level": f.severity.sarif_level,
        "message": {
            "text": f.description or f.title,
        },
        "partialFingerprints": {"agentAuditFingerprint/v1": f.fingerprint},
        "properties": {
            "confidence": f.confidence,
            "test_name": f.test_name,
            "phase": f.phase,
        },
    }
    if locations:
        result["locations"] = locations
    if f.remediation:
        result["fixes"] = [{"description": {"text": f.remediation}}]
    return result
