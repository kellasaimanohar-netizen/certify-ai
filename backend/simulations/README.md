# Agent-Audit Simulations

Runnable demonstrations of what pre-deployment agent auditing catches and why
an enterprise cares. These run fully offline — no API keys, no network.

## What's here

| File | Purpose |
|---|---|
| `vendor_agents.py` | Three fictional vendor agents with different security postures (SecureCorp, QuickShip, PatchedCo), each a drop-in replacement for the mock client. |
| `run_vendor_audit.py` | Runs the real audit phases against each agent and prints a comparison scorecard. |
| `enterprise_demo.py` | Full demo: scorecard + signed certificates, the QuickShip→PatchedCo remediation loop, certificate tamper-evidence, and JSON evidence export. |
| `out/` | Generated reports + certificates from the last run. |

## Run

From the project root:

```bash
PYTHONPATH=simulations python simulations/enterprise_demo.py
```

## The three agents

- **SecureCorp** — refuses prompt injections, redacts PII, never echoes auth
  material, isolates sessions, honours timeouts and step caps. Trust ~71%.
- **QuickShip** — the "cheap vendor": obeys injections, prints SSNs/cards,
  leaks an `Authorization` header into tool args, uses one global memory so
  sessions bleed, ignores step/timeout caps. Trust 0%, 12 criticals.
- **PatchedCo** — QuickShip after one remediation sprint: 10 of 12 criticals
  cleared, trust 0%→56%, but the team missed the auth-header leak in the email
  tool's debug field — still blocks deployment.

## What the demo surfaces

1. **Vendor selection** on identical, standards-mapped criteria (OWASP LLM /
   Agentic, NIST AI RMF, EU AI Act, India DPDP) instead of a sales demo.
2. **Behavioral findings** — injection, PII/secret leakage, session bleed,
   missing caps — caught before the agent touches production tools.
3. **Remediation loop** — fix, re-audit, watch the score move; gate CI on
   "zero criticals" so regressions can't ship.
4. **Tamper-evident certificates** — editing a saved certificate's score/tier
   is detected on verification. (Building this demo surfaced a real bug in the
   framework: `load_and_verify` checked the signature over `content_hash` but
   never rebound the hash to the certificate's fields, so a forged score
   verified clean. Fixed in `certificate.py`; regression test in
   `tests/test_smoke.py::test_certificate_tamper_rejected`.)

## Note on shared findings

The "2 undeclared tools" critical and the consent/retention warnings are
**identical for all three agents** — they're static checks against the shared
target manifest (`delete_account` / `export_all_data` appear in the example
repo code but aren't declared in the target YAML, and the config has no consent
/ retention block). These are configuration/governance gaps the *enterprise*
owns, not vendor behavior — which is itself a useful thing for the audit to
separate out.
