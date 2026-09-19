# CertifyAI — Security Review: Certificate & Signing Path

**Scope:** the certification module (`certificate.py`), its CLI verify command,
and the drift monitor that consumes certificates.
**Method:** code review plus a written attack suite (six attack classes) run
against the live code.
**Outcome:** two vulnerabilities found and fixed — one of them critical. All
fixes are covered by permanent regression tests.

---

## Summary

A CertifyAI certificate is meant to be a trustworthy, offline-verifiable
statement: "this agent was audited and scored X." For that claim to mean
anything, a third party must be unable to manufacture a passing certificate.

The review found that, before the fix, **anyone could manufacture a passing
certificate.** The signature on the certificate proved only that *some* key had
signed it — not that *CertifyAI's* key had. Two distinct flaws combined to make
forgery trivial.

| # | Severity | Flaw | Status |
|---|----------|------|--------|
| 1 | High | Signed hash was never rebound to the certificate's visible fields, so editing the score/tier (leaving hash + signature intact) verified clean. | Fixed (session 2) |
| 2 | **Critical** | No trust anchor: the public key is embedded in the certificate and was trusted blindly, so an attacker could sign a fully-forged cert with their own key and embed their own public key. | Fixed (this review) |

---

## Vulnerability 1 — hash not bound to fields

**What it was.** `load_and_verify` checked that the signature was valid over the
stored `content_hash`, then returned the certificate's fields — but it never
recomputed `content_hash` from those fields. The hash and the displayed data
were never tied together at verification time.

**Exploit.** Edit `trust_score` to 99 and `tier` to `CERTIFIED`, leave
`content_hash` and `signature_b64` untouched. The signature still matches the
(stale) hash, so verification passes and the doctored score is returned.

**Fix.** Extracted a single `_canonical_payload()` builder used by *both* issue
and verify. On load, the hash is recomputed from the certificate's actual fields
and compared; any mismatch is rejected.

## Vulnerability 2 — no trust anchor (key-substitution forgery)  ★ critical

**What it was.** Ed25519 is sound, but a signature only answers "was this signed
by the private key matching *this* public key?" Because the public key travels
*inside* the certificate and was accepted without question, the answer was
always "yes" — including for an attacker's own key.

**Exploit (confirmed against the code).**
1. Take any genuine `NOT_CERTIFIED` certificate.
2. Rewrite every field: `tier = CERTIFIED`, `trust_score = 99`, far-future expiry.
3. Recompute `content_hash` over the new fields (now that Vuln 1 is fixed, the
   attacker must do this — but they can).
4. Generate a brand-new Ed25519 keypair, sign the new hash, and embed the
   attacker's own public key.
5. Verification passes cleanly. The forged certificate is indistinguishable
   from a real one.

This is the decisive flaw: the cryptography provided **no assurance about who
issued the certificate.**

**Fix — issuer-key pinning.**
- `_key_fingerprint()` derives a stable 32-hex-char fingerprint from the signing
  key; the fingerprint is included in the signed payload, so a key swap also
  breaks the hash.
- `load_and_verify(...)` gained `trusted_keys` / `trusted_fingerprints`. A
  verifier pins the issuer's key; a certificate signed by any other key is
  rejected as `UNTRUSTED key`, regardless of internal consistency.
- Verifying **without** a pin now raises by default. Trust-on-first-use is still
  available but only via an explicit `allow_untrusted=True` and is clearly
  labelled as not secure against forgery.
- A persistent issuer key can be supplied via `$AGENT_AUDIT_SIGNING_KEY`
  (base64 Ed25519 seed) so production certificates are all signed by one
  pinnable identity instead of a throwaway per-run key. `generate_issuer_key_b64()`
  helps operators bootstrap one.
- The CLI `verify` gained `--trusted-fingerprint` / `--trusted-key`, prints the
  key fingerprint, and warns loudly when a verification is unpinned.

---

## Attack suite — results after fix

All six run against the live code; all behave correctly now.

| Attack | Expected | Result |
|--------|----------|--------|
| Genuine cert + correct issuer pin | accept | ✓ accepted |
| Key-substitution forgery (attacker's own key), pinned | reject | ✓ rejected (`UNTRUSTED key`) |
| Field tamper (score/tier), issuer key kept | reject | ✓ rejected (hash mismatch) |
| Unpinned verify, no opt-in | reject | ✓ rejected (`no trust anchor`) |
| Unpinned verify, `allow_untrusted=True` | accept (integrity only) | ✓ accepted |
| Genuine cert pinned to the *wrong* key | reject | ✓ rejected (`UNTRUSTED key`) |

Permanent coverage: `tests/test_certificate_security.py` (7 tests) plus the
existing `test_certificate_tamper_rejected`. Each was confirmed to fail against
the pre-fix code and pass against the fix.

---

## Lower-severity observations (checked, acceptable as-is)

- **`findings_summary` tampering** — bound to the hash; rejected. Good.
- **Malformed public-key / signature bytes** — produce a clean
  `CertificateError`, not a crash. Good.
- **Expiry parsing** — strips a trailing `Z` and assumes UTC. Correct for the
  ISO strings the issuer writes, but brittle if a non-UTC offset ever appears.
  Low risk; worth hardening to a strict ISO-8601 parse later.
- **Drift monitor** uses `allow_untrusted=True` deliberately — it compares
  against the operator's *own* prior baseline cert, where trust-on-first-use is
  the intended model. Made explicit in code.

---

## Residual risk & recommended next steps

The crypto path is now sound *provided issuer keys are managed properly.* The
remaining risk is operational, not cryptographic:

1. **Key management.** Generate one issuer key per environment, store it in a
   secret manager, and distribute its fingerprint to verifiers out-of-band
   (e.g. in vendor onboarding docs). Never commit the private key.
2. **Key rotation / revocation.** There is currently no revocation list or
   rotation protocol. If an issuer key is compromised, the only recourse is
   re-issuing under a new pinned fingerprint. A documented rotation procedure
   (and optionally a short key-id + allowed-keys manifest) is the natural next
   step.
3. **Verifier defaults.** Consider making the CLI *require* a pin for any
   externally-supplied certificate, reserving unpinned mode for an explicit
   `--insecure` flag, so the secure path is the default path.

These are process recommendations; the code changes in this review close the
forgery vectors that existed in the certificate path itself.
