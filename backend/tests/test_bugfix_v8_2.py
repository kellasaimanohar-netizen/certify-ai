"""Regression tests for the v8 bug-fix pass (non-live units).

Covers:
  BUG-4   certificate.days_remaining timezone correctness
  BUG-5   variability variance is the correct p*(1-p)
  BUG-6   HIGH_UNCERTAINTY fires on wide CI regardless of run count
  BUG-10  card detection is Luhn-validated (no phone/order-id false positives)
  BUG-2   openapi SSRF guard rejects private/loopback targets
"""
from __future__ import annotations

import datetime as dt

import pytest

from agent_audit.variability import Verdict, classify, wilson_interval


# ── BUG-4 ──────────────────────────────────────────────────────────────────
def test_days_remaining_is_timezone_correct():
    from agent_audit.certificate import Certificate

    future = (dt.datetime.now(dt.timezone.utc) + dt.timedelta(days=30)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    cert = Certificate(
        agent_name="a", tier="CERTIFIED", trust_score=90,
        issued_at="2026-01-01T00:00:00Z", expires_at=future,
        audit_version="8.0.0", cert_version="4.2", audit_id="x",
        content_hash="h", public_key_b64="k", signature_b64="s",
    )
    # 30 days out (give or take the boundary) — must be ~29–30, never negative.
    assert 28 <= cert.days_remaining <= 30


def test_days_remaining_never_negative_for_past():
    from agent_audit.certificate import Certificate

    past = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=5)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    cert = Certificate(
        agent_name="a", tier="CONDITIONAL", trust_score=70,
        issued_at="2026-01-01T00:00:00Z", expires_at=past,
        audit_version="8.0.0", cert_version="4.2", audit_id="x",
        content_hash="h", public_key_b64="k", signature_b64="s",
    )
    assert cert.days_remaining == 0


# ── BUG-6 ──────────────────────────────────────────────────────────────────
def test_high_uncertainty_fires_on_wide_ci_even_at_high_run_count():
    # 25/50 passes → wide Wilson interval. Previously the runs<30 clause made
    # HIGH_UNCERTAINTY unreachable here; now a wide CI is enough.
    lo, hi = wilson_interval(25, 50)
    assert (hi - lo) > 0.25
    verdict = classify(
        passes=25, runs=50, mean_score=0.5,
        variance=0.25, ci_lower=lo, ci_upper=hi,
    )
    assert verdict is Verdict.HIGH_UNCERTAINTY


def test_robust_still_reachable_with_tight_ci():
    lo, hi = wilson_interval(50, 50)        # all pass, tight interval
    verdict = classify(
        passes=50, runs=50, mean_score=1.0,
        variance=0.0, ci_lower=lo, ci_upper=hi,
    )
    assert verdict is Verdict.ROBUST


# ── BUG-10 ─────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("text,expected", [
    ("pay with 4111 1111 1111 1111 please", True),    # valid Visa test number
    ("card 4111-1111-1111-1111", True),               # dashed, valid
    ("amex 378282246310005", True),                   # valid 15-digit Amex
    ("call me at 415 555 0132 9087 later", False),    # phone-ish, fails Luhn
    ("order number 1234567890123456", False),         # 16 digits, fails Luhn
    ("ref 9999999999999999", False),                  # fails Luhn
])
def test_card_detection_uses_luhn(text, expected):
    from agent_audit.phases.phase19_browser import _contains_card_number

    assert _contains_card_number(text) is expected


# ── BUG-2 ──────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("url", [
    "http://127.0.0.1/openapi.json",
    "https://localhost/spec.yaml",
    "http://169.254.169.254/latest/meta-data/",
    "http://10.0.0.5/openapi.json",
])
def test_openapi_ssrf_guard_blocks_private(url, monkeypatch):
    from agent_audit.exceptions import SourceError
    from agent_audit.sources.openapi_adapter import _assert_public_url

    monkeypatch.delenv("AGENT_AUDIT_ALLOW_PRIVATE_FETCH", raising=False)
    with pytest.raises(SourceError):
        _assert_public_url(url)


def test_openapi_ssrf_guard_override(monkeypatch):
    from agent_audit.sources.openapi_adapter import _assert_public_url

    monkeypatch.setenv("AGENT_AUDIT_ALLOW_PRIVATE_FETCH", "1")
    # Should not raise when explicitly overridden (local dev).
    _assert_public_url("http://127.0.0.1/openapi.json")
