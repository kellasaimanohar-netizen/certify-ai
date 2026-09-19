# Agent-Audit v8 — Live-Run Hardening (merge of v7 phases + v6 live-readiness enhancements)

## What v8 adds over v7

v7 added 5 new phases (voice, data_analysis, decision, security_agent, browser),
bringing the total to **76 controls across 17 phases**. But v7's live HTTP path
was identical to v6's: a bare `httpx.post` with no response normalization, no
cost ceiling, no rate-limit handling, and no guard against running destructive
probes at a production endpoint.

v8 keeps all 76 controls unchanged and makes the **live path production-safe**.

### New package: `agent_audit.live`

| Module | Responsibility |
|---|---|
| `adapters.py` | Normalize any agent response envelope (OpenAI / Anthropic / LangServe / raw text / SSE) into the one canonical shape every phase already reads. Buggy adapters are skipped, never fatal. Custom adapters via `register_adapter`. |
| `budget.py` | `CallBudget` — hard ceilings on total calls, total USD spend, and per-test calls. Concurrency-safe. Raises `BudgetExceededError` cleanly. |
| `safety.py` | `SafetyGate` + `TargetEnv` — refuses destructive/adversarial phases against a non-sandbox live endpoint. **Fails closed** when env is unknown. |
| `client.py` | `LiveAgentClient` — same `invoke()` interface as `MockAgentClient`; adds 429-aware retry (honours `Retry-After`), exponential backoff + jitter, pooled `httpx.AsyncClient`, and strips internal `_`-prefixed keys before they reach the real agent. |

### Wiring (no phase modules changed)
- `PhaseContext.call_agent` now routes the live branch through `LiveAgentClient`.
- `run_audit` builds a shared `CallBudget` + `SafetyGate`, authorizes each phase,
  converts budget/safety stops into clean findings, and records `budget_usage`
  and `live_safety` on the report.
- CLI gains `--target-env`, `--allow-destructive`, `--max-calls`, `--max-cost-usd`.

### Safety semantics
- Destructive phases: `adversarial, multi_turn, security_agent, browser, data_analysis`.
- Live + sandbox → allowed. Live + staging + `--allow-destructive` → allowed.
- Live + production → **always blocked** (override is staging-only). Live + unknown → blocked.
- Mock mode → everything allowed (no real side effects).

### Verification
`tests/test_live_hardening.py` — 25 assertion-backed checks across adapters,
budget, safety, and an end-to-end `LiveAgentClient` run against a fake HTTP
agent via `httpx.MockTransport` (confirms response normalization, cost
tracking, internal `_`-key stripping, fail-fast on 4xx with budget refund, and
that the production block short-circuits before any call). Full suite: 51 passed.

> Note (v8.0.1): the original `test_live_hardening.py` used a print-only `_check`
> helper that never raised, so pytest reported its 3 functions as passing
> regardless of outcome and `LiveAgentClient` had no coverage at all. The suite
> has been rewritten to use real `assert`s. Also fixed: a budget-refund leak
> (failed calls now release their reserved slot via `CallBudget.release`) and a
> global adapter-registry leak (tests now snapshot/restore via
> `snapshot_adapters`/`restore_adapters`). The spend ceiling is documented as a
> soft cap (the call that crosses it completes; the next is blocked).

---

## v8.0.2 — Certificate security hardening

A security review of the certificate/signing path (`SECURITY_REVIEW_certificates.md`)
found and fixed two forgery vectors:

1. **Hash not bound to fields** (High) — `load_and_verify` checked the signature
   over `content_hash` but never recomputed it from the certificate's fields, so
   editing `trust_score`/`tier` (leaving hash+signature intact) verified clean.
2. **No trust anchor — key substitution** (Critical) — the public key is embedded
   in the certificate and was trusted blindly, so an attacker could forge every
   field, sign with their *own* key, embed their *own* public key, and verify
   clean. The signature proved "someone signed this", never "the issuer signed it".

Fixes:
- Shared `_canonical_payload()` for issue + verify; hash rebound to fields on load.
- Issuer key fingerprint added to the signed payload and persisted on the cert.
- `load_and_verify(..., trusted_keys=, trusted_fingerprints=, allow_untrusted=)` —
  verifiers pin the issuer key; unpinned verification raises by default.
- Persistent issuer key via `$AGENT_AUDIT_SIGNING_KEY`; `generate_issuer_key_b64()`
  helper; CLI `verify --trusted-fingerprint/--trusted-key`, prints key fp, warns
  when unpinned.
- Coverage: `tests/test_certificate_security.py` (7 tests) + existing tamper test.
  Full suite: 59 passed.

Cert version bumped 4.1 → 4.2 (adds `key_fingerprint`).
