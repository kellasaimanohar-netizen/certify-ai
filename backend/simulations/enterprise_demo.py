"""Enterprise pre-deployment audit demo.

Scenario: an enterprise is choosing a customer-support agent vendor. Security &
procurement run the SAME audit battery against three candidate agents, then:

  1. score & tier each one (signed certificate),
  2. show the QuickShip -> PatchedCo remediation loop (before/after),
  3. prove the certificate is tamper-evident,
  4. export machine-readable evidence (JSON) for the audit trail.

Run from the project root:
    PYTHONPATH=simulations python simulations/enterprise_demo.py
"""
from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path

from vendor_agents import VENDORS

from agent_audit.certificate import issue_certificate, load_and_verify
from agent_audit.exceptions import CertificateError
from agent_audit.exporters.json_exporter import export_json
from agent_audit.runner import run_audit
from agent_audit.sources import load_target

ROOT = Path(__file__).resolve().parent.parent


def _find_target_yaml() -> Path:
    # 1. Check environment variable
    env_target = os.getenv("AGENT_AUDIT_TARGET")
    if env_target:
        p = Path(env_target).resolve()
        if p.is_file():
            return p

    # 2. Check targets/ directory
    workspace_root = Path(__file__).resolve().parent.parent
    targets_dir = workspace_root / "targets"
    if targets_dir.is_dir():
        yamls = list(targets_dir.glob("*.yaml")) + list(targets_dir.glob("*.yml"))
        if yamls:
            return yamls[0]

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

TARGET = _find_target_yaml()
OUT = ROOT / "simulations" / "out"
OUT.mkdir(exist_ok=True)

DEMO_PHASES = ["reliability", "security", "adversarial", "multi_turn", "data_governance"]


def _install_vendor(agent_cls) -> None:
    import agent_audit.mock_client as mc
    mc.MockAgentClient = agent_cls


async def audit(name: str, agent_cls):
    _install_vendor(agent_cls)
    manifest = load_target(str(TARGET))
    return await run_audit(
        manifest, phases=DEMO_PHASES, mode="certify",
        mock_tools=True, variability_runs=12,
    )


def _line(c="─", n=78):
    print(c * n)


async def main():
    reports = {}
    for name, cls in VENDORS.items():
        reports[name] = await audit(name, cls)

    # ─────────────── 1. Scorecard + signed certificates ───────────────
    print("\n" + "=" * 78)
    print(" PRE-DEPLOYMENT AGENT AUDIT — vendor selection scorecard")
    print(" Target role: customer-support-agent   |   Battery: 5 phases, 12 trials each")
    print("=" * 78)
    print(f"{'Vendor':<12}{'Trust':>7}{'Tier':>22}{'Pass':>6}{'Crit':>6}{'Warn':>6}")
    _line()
    certs = {}
    for name, rep in reports.items():
        cert = issue_certificate(rep)
        certs[name] = cert
        print(f"{name:<12}{rep.trust_score:>6}%{cert.tier:>22}"
              f"{len(rep.passes):>6}{len(rep.critical_failures):>6}{len(rep.warnings):>6}")
    _line()
    print(" Tiering: CERTIFIED (0 crit, score≥80) · CONDITIONAL · NOT_CERTIFIED (any crit)")

    # ─────────────── 2. What the audit caught, per vendor ───────────────
    print("\n" + "=" * 78)
    print(" FINDINGS — what each agent did under attack")
    print("=" * 78)
    for name, rep in reports.items():
        print(f"\n▌ {name}  (trust {rep.trust_score}%, {certs[name].tier})")
        crit = rep.critical_failures
        if not crit:
            print("    ✓ no critical failures")
        for f in crit:
            print(f"    ✗ CRITICAL  {f.title}")
        # show only behavioral warnings count to keep it readable
        print(f"    · {len(rep.warnings)} warning(s), {len(rep.passes)} passing control(s)")

    # ─────────────── 3. Remediation loop: QuickShip → PatchedCo ───────────────
    qs, pc = reports["QuickShip"], reports["PatchedCo"]
    qs_titles = {f.title for f in qs.critical_failures}
    pc_titles = {f.title for f in pc.critical_failures}
    fixed = qs_titles - pc_titles
    remaining = qs_titles & pc_titles
    print("\n" + "=" * 78)
    print(" REMEDIATION LOOP — QuickShip after one fix sprint (= PatchedCo)")
    print("=" * 78)
    print(f"  Trust score:  {qs.trust_score}%  →  {pc.trust_score}%   "
          f"(+{pc.trust_score - qs.trust_score} points)")
    print(f"  Criticals:    {len(qs_titles)}  →  {len(pc_titles)}")
    print(f"\n  RESOLVED ({len(fixed)}):")
    for t in sorted(fixed):
        print(f"    ✓ {t}")
    print(f"\n  STILL OPEN ({len(remaining)}) — blocks deployment:")
    for t in sorted(remaining):
        print(f"    ✗ {t}")
    print("\n  → A second sprint on the email tool's debug field would clear the last")
    print("    behavioral critical. The 'undeclared tools' critical is a CONFIG gap the")
    print("    enterprise owns (declare delete_account/export_all_data in the target YAML).")

    # ─────────────── 4. Tamper-evidence on the certificate ───────────────
    print("\n" + "=" * 78)
    print(" CERTIFICATE INTEGRITY — signatures pinned to the issuer key")
    print("=" * 78)
    import base64 as _b64

    from cryptography.hazmat.primitives import serialization as _ser
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey as _Ed

    from agent_audit.certificate import _key_fingerprint

    # The enterprise's trusted issuer key (in real use: a CI secret).
    issuer = _Ed.generate()
    issuer_fp = _key_fingerprint(issuer.public_key().public_bytes(
        encoding=_ser.Encoding.Raw, format=_ser.PublicFormat.Raw))

    secure_cert = issue_certificate(reports["SecureCorp"], signing_key=issuer)
    secure_cert_path = OUT / "SecureCorp_cert.json"
    secure_cert.save(secure_cert_path)
    verified = load_and_verify(secure_cert_path, trusted_fingerprints={issuer_fp})
    print(f"  Issued + verified (pinned):  {verified.agent_name}  tier={verified.tier} "
          f"score={verified.trust_score}")
    print(f"  Pinned issuer fingerprint:   {issuer_fp}")

    # Attack A: edit score, keep issuer key → hash mismatch.
    forged = json.loads(secure_cert_path.read_text())
    forged["trust_score"] = 99
    forged["tier"] = "CERTIFIED"
    forged_path = OUT / "SecureCorp_cert_FORGED_fields.json"
    forged_path.write_text(json.dumps(forged, indent=2))
    try:
        load_and_verify(forged_path, trusted_fingerprints={issuer_fp})
        print("  ✗ field-tamper forgery verified — BUG")
    except CertificateError as exc:
        print(f"  ✓ field-tamper forgery REJECTED:  {str(exc)[:60]}…")

    # Attack B: forge everything and sign with the ATTACKER'S own key.
    import hashlib as _hl

    from agent_audit.certificate import _canonical_payload
    atk = _Ed.generate()
    atk_pub = atk.public_key().public_bytes(encoding=_ser.Encoding.Raw, format=_ser.PublicFormat.Raw)
    f2 = json.loads(secure_cert_path.read_text())
    f2["tier"] = "CERTIFIED"
    f2["trust_score"] = 100
    f2["key_fingerprint"] = _key_fingerprint(atk_pub)
    canon = _canonical_payload(
        agent_name=f2["agent_name"], tier=f2["tier"], trust_score=f2["trust_score"],
        issued_at=f2["issued_at"], expires_at=f2["expires_at"], audit_version=f2["audit_version"],
        cert_version=f2["cert_version"], audit_id=f2.get("audit_id", ""),
        findings_summary=f2.get("findings_summary", {}),
        suppressions_embedded=f2.get("suppressions_embedded", []),
        framework_validation_only=False, key_fingerprint=f2["key_fingerprint"])
    f2["content_hash"] = _hl.sha256(canon).hexdigest()
    f2["signature_b64"] = _b64.b64encode(atk.sign(f2["content_hash"].encode())).decode()
    f2["public_key_b64"] = _b64.b64encode(atk_pub).decode()
    f2_path = OUT / "SecureCorp_cert_FORGED_keysub.json"
    f2_path.write_text(json.dumps(f2, indent=2))
    try:
        load_and_verify(f2_path, trusted_fingerprints={issuer_fp})
        print("  ✗ key-substitution forgery verified — BUG")
    except CertificateError as exc:
        print(f"  ✓ key-substitution forgery REJECTED:  {str(exc)[:60]}…")
    print("  (This second attack is the one a naive 'verify the signature' check misses:")
    print("   a self-consistent cert signed by the attacker's own embedded key.)")

    # ─────────────── 5. Evidence export for the audit trail ───────────────
    print("\n" + "=" * 78)
    print(" EVIDENCE EXPORT — machine-readable reports (SARIF/JSON feed CI & GRC)")
    print("=" * 78)
    for name, rep in reports.items():
        p = OUT / f"{name}_report.json"
        export_json(rep, str(p))
        certs[name].save(OUT / f"{name}_cert.json")
        print(f"  {name:<12} → {p.name}  +  {name}_cert.json")
    print(f"\n  All artifacts in: {OUT}")

    # ─────────────── why this matters ───────────────
    print("\n" + "=" * 78)
    print(" WHY AN ENTERPRISE RUNS THIS")
    print("=" * 78)
    print("""  • Procurement: compare vendors on identical, standards-mapped criteria
    (OWASP LLM/Agentic, NIST AI RMF, EU AI Act, India DPDP) instead of a demo.
  • Security: catch injection, PII/secret leakage, session-bleed, and missing
    step/timeout caps BEFORE the agent touches production tools and real data.
  • Risk/GRC: a signed, expiring certificate + JSON/SARIF evidence trail that
    survives an external audit — and is tamper-evident.
  • Engineering: a fast remediation loop — fix, re-audit, watch the score move,
    gate the CI pipeline on 'zero criticals' so regressions can't ship.""")


if __name__ == "__main__":
    asyncio.run(main())
