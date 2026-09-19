"""Security regression tests for the certificate / signing path.

These lock in the fixes for two vulnerabilities found during the v8 review:

  1. Hash not bound to fields — load_and_verify checked the signature over
     content_hash but never recomputed content_hash from the cert's fields, so
     editing trust_score/tier (leaving hash+sig intact) verified clean.
  2. No trust anchor (key substitution) — the public key travels inside the
     cert and was trusted blindly, so an attacker could forge every field, sign
     with their OWN key, embed their OWN public key, and verify clean. The
     signature proved "someone signed this", never "the issuer signed this".
"""
from __future__ import annotations

import base64
import hashlib
import json

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from agent_audit.certificate import (
    _canonical_payload,
    _key_fingerprint,
    issue_certificate,
    load_and_verify,
)
from agent_audit.exceptions import CertificateError


class _Report:
    """Minimal AuditReport stand-in with 3 criticals (NOT_CERTIFIED)."""
    agent_name = "victim-agent"
    audit_id = "deadbeef0001"
    findings = [object()] * 10
    trust_score = 10

    @property
    def critical_failures(self):
        return [object(), object(), object()]

    @property
    def warnings(self):
        return []

    @property
    def passes(self):
        return []

    @property
    def suppressed(self):
        return []


def _issuer():
    key = Ed25519PrivateKey.generate()
    pub = key.public_key().public_bytes(
        encoding=serialization.Encoding.Raw, format=serialization.PublicFormat.Raw)
    return key, _key_fingerprint(pub)


def _forge_with_own_key(cert_path, **field_overrides):
    """Produce a fully self-consistent forged cert signed by a NEW attacker key."""
    data = json.loads(cert_path.read_text())
    data.update(field_overrides)
    atk = Ed25519PrivateKey.generate()
    atk_pub = atk.public_key().public_bytes(
        encoding=serialization.Encoding.Raw, format=serialization.PublicFormat.Raw)
    data["key_fingerprint"] = _key_fingerprint(atk_pub)
    canon = _canonical_payload(
        agent_name=data["agent_name"], tier=data["tier"], trust_score=data["trust_score"],
        issued_at=data["issued_at"], expires_at=data["expires_at"],
        audit_version=data["audit_version"], cert_version=data["cert_version"],
        audit_id=data.get("audit_id", ""), findings_summary=data.get("findings_summary", {}),
        suppressions_embedded=data.get("suppressions_embedded", []),
        framework_validation_only=data.get("framework_validation_only", False),
        key_fingerprint=data["key_fingerprint"],
    )
    data["content_hash"] = hashlib.sha256(canon).hexdigest()
    data["signature_b64"] = base64.b64encode(atk.sign(data["content_hash"].encode())).decode()
    data["public_key_b64"] = base64.b64encode(atk_pub).decode()
    return data


class TestCertificateSecurity:
    def test_legit_cert_with_correct_pin_verifies(self, tmp_path):
        key, fp = _issuer()
        cert = issue_certificate(_Report(), signing_key=key)
        p = cert.save(tmp_path / "c.json")
        loaded = load_and_verify(p, trusted_fingerprints={fp})
        assert loaded.tier == "NOT_CERTIFIED"
        assert loaded.key_fingerprint == fp

    def test_key_substitution_forgery_rejected_when_pinned(self, tmp_path):
        key, fp = _issuer()
        cert = issue_certificate(_Report(), signing_key=key)
        p = cert.save(tmp_path / "c.json")
        forged = _forge_with_own_key(p, tier="CERTIFIED", trust_score=99,
                                     expires_at="2099-01-01T00:00:00Z")
        fpath = tmp_path / "forged.json"
        fpath.write_text(json.dumps(forged))
        with pytest.raises(CertificateError, match="UNTRUSTED key"):
            load_and_verify(fpath, trusted_fingerprints={fp})

    def test_field_tamper_rejected(self, tmp_path):
        key, fp = _issuer()
        cert = issue_certificate(_Report(), signing_key=key)
        p = cert.save(tmp_path / "c.json")
        data = json.loads(p.read_text())
        data["trust_score"] = 95
        data["tier"] = "CERTIFIED"
        fpath = tmp_path / "t.json"
        fpath.write_text(json.dumps(data))
        with pytest.raises(CertificateError):
            load_and_verify(fpath, trusted_fingerprints={fp})

    def test_unpinned_verify_refused_by_default(self, tmp_path):
        key, _ = _issuer()
        cert = issue_certificate(_Report(), signing_key=key)
        p = cert.save(tmp_path / "c.json")
        with pytest.raises(CertificateError, match="no trust anchor"):
            load_and_verify(p)

    def test_tofu_works_when_explicitly_opted_in(self, tmp_path):
        key, _ = _issuer()
        cert = issue_certificate(_Report(), signing_key=key)
        p = cert.save(tmp_path / "c.json")
        loaded = load_and_verify(p, allow_untrusted=True)
        assert loaded.agent_name == "victim-agent"

    def test_wrong_pin_rejects_genuine_cert(self, tmp_path):
        key, _ = _issuer()
        cert = issue_certificate(_Report(), signing_key=key)
        p = cert.save(tmp_path / "c.json")
        with pytest.raises(CertificateError, match="UNTRUSTED key"):
            load_and_verify(p, trusted_fingerprints={"deadbeef" * 4})

    def test_trusted_key_by_b64_also_works(self, tmp_path):
        key, _ = _issuer()
        pub_b64 = base64.b64encode(key.public_key().public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw)).decode()
        cert = issue_certificate(_Report(), signing_key=key)
        p = cert.save(tmp_path / "c.json")
        loaded = load_and_verify(p, trusted_keys={pub_b64})
        assert loaded.tier == "NOT_CERTIFIED"


def test_grade_tamper_is_rejected(tmp_path):
    """PENTEST v10.3: the displayed badge grade must match the signed score/findings.

    Regression for a finding where an attacker could change the standalone
    'grade' string (e.g. FAILED -> PLATINUM) while the signed score/tier/findings
    stayed honest, because grade is derived and not in the signed payload.
    load_and_verify now re-derives grade and rejects any mismatch.
    """
    import base64, json
    from pathlib import Path
    from agent_audit.certificate import load_and_verify, _key_fingerprint
    from agent_audit.exceptions import CertificateError

    src = Path(__file__).resolve().parents[1] / "targets" / "agentforce_agent.yaml"
    import subprocess, sys, os
    cert_path = tmp_path / "c.json"
    env = dict(os.environ, PYTHONPATH=str(Path(__file__).resolve().parents[1] / "src"), PYTHONIOENCODING="utf-8")
    subprocess.run(
        [sys.executable, "-m", "agent_audit.cli", "run", "--target", str(src),
         "--mode", "validate", "--cert-output", str(cert_path)],
        check=True, capture_output=True, env=env,
    )
    raw = json.loads(cert_path.read_text())
    fp = _key_fingerprint(base64.b64decode(raw["public_key_b64"]))
    # sanity: unmodified cert verifies
    load_and_verify(str(cert_path), trusted_fingerprints=[fp])
    # tamper only the badge grade
    raw["grade"] = "PLATINUM"
    bad = tmp_path / "bad.json"
    bad.write_text(json.dumps(raw))
    try:
        load_and_verify(str(bad), trusted_fingerprints=[fp])
        assert False, "grade tamper was NOT detected"
    except CertificateError as e:
        assert "grade" in str(e).lower()
