"""Smoke tests — v7. Verifies framework loads, v7 phases parse, and end-to-end runs."""
from __future__ import annotations

import json

import pytest

from agent_audit.checkers import load_checkers
from agent_audit.findings import StandardRef, fail_finding, pass_finding
from agent_audit.runner import run_audit
from agent_audit.severity import Severity
from agent_audit.sources import load_target
from agent_audit.suppressions import load_suppressions
from agent_audit.variability import Verdict, classify, wilson_interval


class TestVersion:
    def test_version(self):
        from agent_audit import __version__
        assert __version__ == "10.3.0"

    def test_severity_sarif(self):
        assert Severity.CRITICAL.sarif_level == "error"
        assert Severity.PASS.sarif_level == "none"


class TestStandards:
    def test_owasp_llm_lookup(self):
        ref = StandardRef.from_registry("owasp_llm_2025", "LLM01")
        assert ref.name == "Prompt Injection"

    def test_mitre_atlas_lookup(self):
        ref = StandardRef.from_registry("mitre_atlas", "AML.T0051")
        assert "Prompt Injection" in ref.name

    def test_unknown_raises(self):
        with pytest.raises(KeyError):
            StandardRef.from_registry("fake_framework", "X99")


class TestFindings:
    def test_pass_finding(self):
        f = pass_finding(finding_id="T-001", phase="test", test_name="x", title="ok")
        assert f.passed
        assert f.severity is Severity.PASS
        assert len(f.fingerprint) == 16

    def test_fail_finding(self):
        f = fail_finding(
            finding_id="T-002", phase="test", test_name="y",
            severity=Severity.CRITICAL, title="bad", description="d",
            remediation="fix it", cwe=["CWE-77"],
        )
        assert not f.passed
        assert f.cwe == ["CWE-77"]

    def test_serialisation_roundtrip(self):
        f = pass_finding(finding_id="T-003", phase="test", test_name="z", title="ok")
        d = f.to_dict()
        assert d["id"] == "T-003"
        assert d["passed"] is True
        assert "fingerprint" in d


class TestVariability:
    def test_wilson_50_50(self):
        lo, hi = wilson_interval(50, 100)
        assert 0.35 < lo < 0.45
        assert 0.55 < hi < 0.65

    def test_classify_robust(self):
        v = classify(passes=48, runs=50, mean_score=0.96, variance=0.04,
                     ci_lower=0.90, ci_upper=1.0)
        assert v is Verdict.ROBUST

    def test_classify_high_uncertainty(self):
        v = classify(passes=3, runs=5, mean_score=0.6, variance=0.24,
                     ci_lower=0.2, ci_upper=0.9)
        assert v is Verdict.HIGH_UNCERTAINTY


class TestLoaderV3Compat:
    def test_v3_flat_loads(self, v3_target_path):
        m = load_target(v3_target_path)
        assert len(m.agent_name) > 0
        assert m.runtime.endpoint is not None
        assert len(m.capabilities.tools) >= 0

    def test_v3_provenance(self, v3_target_path):
        m = load_target(v3_target_path)
        assert "yaml" in m.provenance_trail


class TestLoaderV4MultiSource:
    def test_v4_loads(self, v4_target_path):
        m = load_target(v4_target_path)
        assert len(m.agent_name) > 0
        tool_names = {t.name for t in m.capabilities.tools}
        assert isinstance(tool_names, set)

    def test_v4_compliance_frameworks(self, v4_target_path):
        m = load_target(v4_target_path)
        assert "owasp_llm_2025" in m.compliance_frameworks


@pytest.mark.asyncio
class TestEndToEndAudit:
    async def test_validate_mode(self, v4_target_path):
        m = load_target(v4_target_path)
        report = await run_audit(m, mode="validate", mock_tools=True, variability_runs=3)
        assert report.agent_name == m.agent_name
        assert len(report.findings) > 0
        assert report.audit_version == "10.3.0"

    async def test_v7_phases_in_phase_map(self):
        from agent_audit.phases import PHASE_MAP
        for phase in ["voice", "data_analysis", "decision", "security_agent", "browser"]:
            assert phase in PHASE_MAP, f"v7 phase '{phase}' missing from PHASE_MAP"

    async def test_voice_phase_runs(self, v4_target_path):
        m = load_target(v4_target_path)
        report = await run_audit(m, mode="validate", mock_tools=True,
                                  phases=["voice"], variability_runs=3)
        assert len(report.findings) > 0
        voice_findings = [f for f in report.findings if f.phase == "voice"]
        assert len(voice_findings) > 0

    async def test_browser_phase_runs(self, v4_target_path):
        m = load_target(v4_target_path)
        report = await run_audit(m, mode="validate", mock_tools=True,
                                  phases=["browser"], variability_runs=3)
        browser_findings = [f for f in report.findings if f.phase == "browser"]
        assert len(browser_findings) > 0

    async def test_decision_phase_runs(self, v4_target_path):
        m = load_target(v4_target_path)
        report = await run_audit(m, mode="validate", mock_tools=True,
                                  phases=["decision"], variability_runs=3)
        decision_findings = [f for f in report.findings if f.phase == "decision"]
        assert len(decision_findings) > 0

    async def test_all_phases_run(self, v4_target_path):
        m = load_target(v4_target_path)
        report = await run_audit(m, mode="validate", mock_tools=True, variability_runs=2)
        phases_seen = {f.phase for f in report.findings}
        # v7 new phases should appear
        for phase in ["voice", "data_analysis", "decision", "security_agent", "browser"]:
            assert phase in phases_seen, f"Phase '{phase}' produced no findings"

    async def test_export_json(self, v4_target_path, tmp_path):
        m = load_target(v4_target_path)
        report = await run_audit(m, mode="validate", mock_tools=True, variability_runs=2)
        from agent_audit.exporters import export_json
        out = export_json(report, tmp_path / "report.json")
        data = json.loads(out.read_text())
        assert data["agent_name"] == m.agent_name
        assert data["audit_version"] == "10.3.0"

    async def test_certificate(self, v4_target_path, tmp_path):
        m = load_target(v4_target_path)
        report = await run_audit(m, mode="validate", mock_tools=True, variability_runs=2)
        from agent_audit.certificate import issue_certificate, load_and_verify
        cert = issue_certificate(report, framework_validation_only=True)
        cert_path = cert.save(tmp_path / "cert.json")
        loaded = load_and_verify(cert_path, allow_untrusted=True)
        assert loaded.agent_name == cert.agent_name

    async def test_certificate_tamper_rejected(self, v4_target_path, tmp_path):
        """Regression: editing trust_score / tier while leaving content_hash and
        signature untouched must be rejected. Previously load_and_verify only
        checked the signature over content_hash and never rebound the hash to the
        certificate's visible fields, so a forged score verified clean."""
        import json as _json

        from agent_audit.certificate import issue_certificate, load_and_verify
        from agent_audit.exceptions import CertificateError

        m = load_target(v4_target_path)
        report = await run_audit(m, mode="validate", mock_tools=True, variability_runs=2)
        cert = issue_certificate(report)
        cert_path = cert.save(tmp_path / "cert.json")

        forged = _json.loads(cert_path.read_text())
        forged["trust_score"] = 99
        forged["tier"] = "CERTIFIED"
        # content_hash + signature_b64 left intact, as an attacker would.
        forged_path = tmp_path / "cert_forged.json"
        forged_path.write_text(_json.dumps(forged))

        with pytest.raises(CertificateError):
            load_and_verify(forged_path, allow_untrusted=True)


class TestCheckers:
    def test_regex_checker_from_config(self):
        config = [{
            "id": "test_check", "kind": "regex",
            "pattern": r"\bSECRET\b", "applies_to": ["response"],
            "severity": "CRITICAL", "title": "Secret found",
        }]
        reg = load_checkers(from_config=config, from_entry_points=False)
        assert len(reg) == 1

    def test_regex_checker_fires(self):
        from agent_audit.checkers.base import CheckContext
        from agent_audit.checkers.regex_checker import RegexChecker
        from agent_audit.manifest import TargetManifest
        c = RegexChecker.from_dict({
            "id": "t1", "kind": "regex", "pattern": r"\bSECRET\b",
            "applies_to": ["response"], "severity": "CRITICAL", "title": "Secret found",
        })
        ctx = CheckContext(
            manifest=TargetManifest(agent_name="test"),
            artifact_kind="response", content="The answer is SECRET-TOKEN-123",
        )
        f = c.check(ctx)
        assert f is not None
        assert f.severity is Severity.CRITICAL


class TestSuppressions:
    def test_load_and_apply(self, tmp_path):
        f = fail_finding(
            finding_id="T-SUP", phase="test", test_name="supptest",
            severity=Severity.CRITICAL, title="test", description="d", remediation="r",
        )
        sup_file = tmp_path / ".audit-suppressions.yaml"
        sup_file.write_text(
            f"- fingerprint: {f.fingerprint}\n"
            f"  reason: accepted risk\n"
            f"  approved_by: test@test.com\n"
        )
        reg = load_suppressions(sup_file)
        results = reg.apply([f])
        assert results[0].suppressed
        assert "accepted risk" in results[0].suppression_reason
